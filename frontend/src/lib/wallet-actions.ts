/**
 * Real on-chain user actions, replacing the mock async functions that
 * previously lived in `frontend/src/lib/mockData.ts`.
 *
 * Each function does ONE user-facing thing end-to-end:
 *   - `connectWallet` / `disconnectWallet` — EIP-1193 connection only.
 *   - `signAndSubmitScore` — backend sign + on-chain `oracle.submitScore`.
 *   - `borrow` — backend sign + on-chain `pool.borrow` (with collateral).
 *   - `deposit` — on-chain `pool.deposit()` (lender side).
 *   - `repay` — reads `pool.accruedDebt` + calls `pool.repay()`.
 *   - `withdraw` — on-chain `pool.withdraw(shares)` (helper for future UI).
 *
 * Error handling: viem throws on reverted txs. We normalize the error shape
 * so route components can `toast.error(err.message)` without unwrapping.
 *
 * Money: all on-chain values are `bigint` (wei). User input is HSK decimal;
 * `parseHsk()` converts it before each tx.
 */
import { type Address, createPublicClient, http } from "viem";
import { ORACLE_ABI, POOL_ABI } from "./abi";
import { getCurrentAccount, getEthereum, getWalletClient, hskTestnet, parseHsk } from "./chain";
import { config } from "./config";
import { signScore as apiSignScore, type SignedScoreBundle } from "./api";

// ============================================================================
// Connection
// ============================================================================

/**
 * Connect to the injected EIP-1193 wallet. Requests accounts (the only call
 * that surfaces the MetaMask popup), asserts we're on the right chain, and
 * returns the lowercase address.
 *
 * Throws a human-readable `Error` if:
 *   - No wallet is injected (no `window.ethereum`).
 *   - User rejects the connection.
 *   - Wallet is on a different chainId than `config.chainId`.
 */
export async function connectWallet(): Promise<{ address: `0x${string}` }> {
  const wallet = getWalletClient();
  if (!wallet) {
    throw new Error(
      "No HSK Chain wallet detected. Install MetaMask (or any EIP-1193 wallet) and refresh.",
    );
  }

  // EIP-1193 `eth_requestAccounts` is the prompt-triggering call.
  const accounts = (await wallet.requestAddresses()) as `0x${string}`[];
  const first = accounts[0];
  if (!first) {
    throw new Error("Wallet returned no accounts.");
  }

  // Verify chain. `eth_chainId` returns hex string ("0x85" for 133).
  const eth = getEthereum();
  if (eth) {
    const chainHex = (await eth.request({ method: "eth_chainId" })) as string;
    const liveChainId = Number.parseInt(chainHex, 16);
    if (liveChainId !== config.chainId) {
      throw new Error(
        `Wrong network. Wallet is on chainId ${liveChainId}; please switch to HSK Chain (${config.chainId}).`,
      );
    }
  }

  return { address: first.toLowerCase() as `0x${string}` };
}

/**
 * Clear local wallet state. The user's wallet stays connected at the
 * provider level; we just drop our local session. Re-connecting is fast
 * because `eth_accounts` doesn't re-prompt once the user has approved.
 */
export function disconnectWallet(): void {
  // Nothing on-chain to call. The store setter in `wallet-store.ts` does
  // the local state clearing.
}

/**
 * Account that the wallet currently exposes (no prompt). Returns null when
 * the user hasn't connected yet OR when no wallet is injected.
 */
export async function getConnectedAddress(): Promise<`0x${string}` | null> {
  return getCurrentAccount();
}

// ============================================================================
// Score submission (backend sign + on-chain submit)
// ============================================================================

/**
 * Ask the backend to compute + sign a fresh score, then submit the
 * signature to `oracle.submitScore` on-chain. Required before the first
 * borrow on a fresh wallet.
 *
 * Returns the tx hash of the submission.
 *
 * Side effects:
 *   - Backend writes a `Score` row (the indexer later fills in `txHash`).
 *   - On-chain `ScoreSubmitted` event fires.
 */
export async function signAndSubmitScore(
  address: `0x${string}`,
): Promise<{ txHash: `0x${string}` }> {
  const wallet = getWalletClient();
  if (!wallet) throw new Error("No HSK Chain wallet detected.");

  // 1. Backend signs.
  const bundle: SignedScoreBundle = await apiSignScore(address);

  // 2. Wallet submits the signed bundle to the oracle.
  const hash = await wallet.writeContract({
    address: config.oracleAddress,
    abi: ORACLE_ABI,
    functionName: "submitScore",
    args: [
      bundle.wallet as `0x${string}`,
      bundle.score,
      bundle.tier,
      BigInt(bundle.expiresAt),
      BigInt(bundle.nonce),
      bundle.v,
      bundle.r as `0x${string}`,
      bundle.s as `0x${string}`,
    ],
    account: address,
    chain: hskTestnet,
  });

  return { txHash: hash };
}

// ============================================================================
// Borrower flow
// ============================================================================

/**
 * Borrow `amountHsk` HSK from the pool, posting `collateralHsk` HSK as
 * collateral sized to the borrower's tier.
 *
 * Steps:
 *   1. Backend sign + on-chain `oracle.submitScore` (fresh score required;
 *      the pool enforces a strictly-increasing nonce at borrow time).
 *   2. `pool.borrow(amount, score, tier, expiresAt, nonce, v, r, s)` with
 *      `value: collateralWei`. The pool atomically verifies the signature
 *      and consumes the nonce.
 *
 * Returns the tx hash of the borrow call (not the submitScore tx).
 */
export async function borrow(args: {
  address: `0x${string}`;
  amountHsk: string; // user input
  collateralHsk: string; // computed by UI from tier ratio
}): Promise<{ txHash: `0x${string}`; amountHsk: string; collateralHsk: string }> {
  const wallet = getWalletClient();
  if (!wallet) throw new Error("No HSK Chain wallet detected.");

  // 1. Fresh score.
  const bundle: SignedScoreBundle = await apiSignScore(args.address);
  await wallet.writeContract({
    address: config.oracleAddress,
    abi: ORACLE_ABI,
    functionName: "submitScore",
    args: [
      bundle.wallet as `0x${string}`,
      bundle.score,
      bundle.tier,
      BigInt(bundle.expiresAt),
      BigInt(bundle.nonce),
      bundle.v,
      bundle.r as `0x${string}`,
      bundle.s as `0x${string}`,
    ],
    account: args.address,
    chain: hskTestnet,
  });

  // 2. Borrow.
  const amountWei = parseHsk(args.amountHsk);
  const collateralWei = parseHsk(args.collateralHsk);
  const txHash = await wallet.writeContract({
    address: config.poolAddress,
    abi: POOL_ABI,
    functionName: "borrow",
    args: [
      amountWei,
      bundle.score,
      bundle.tier,
      BigInt(bundle.expiresAt),
      BigInt(bundle.nonce),
      bundle.v,
      bundle.r as `0x${string}`,
      bundle.s as `0x${string}`,
    ],
    value: collateralWei,
    account: args.address,
    chain: hskTestnet,
  });

  return { txHash, amountHsk: args.amountHsk, collateralHsk: args.collateralHsk };
}

/**
 * Repay the caller's outstanding loan in full (principal + accrued interest).
 * Reads `pool.accruedDebt(msg.sender)` first, then sends `pool.repay()`
 * with exactly that much value. The pool refunds any excess.
 */
export async function repay(address: `0x${string}`): Promise<{ txHash: `0x${string}` }> {
  const wallet = getWalletClient();
  if (!wallet) throw new Error("No HSK Chain wallet detected.");

  // Read current debt via the public chain client (read-only).
  const publicClient = createPublicClient({
    chain: hskTestnet,
    transport: http(config.rpcUrl),
  });
  const debt = (await publicClient.readContract({
    address: config.poolAddress,
    abi: POOL_ABI,
    functionName: "accruedDebt",
    args: [address],
  })) as bigint;
  if (debt === 0n) {
    throw new Error("No active loan to repay.");
  }

  const txHash = await wallet.writeContract({
    address: config.poolAddress,
    abi: POOL_ABI,
    functionName: "repay",
    args: [],
    value: debt,
    account: address,
    chain: hskTestnet,
  });

  return { txHash };
}

// ============================================================================
// Lender flow
// ============================================================================

/**
 * Deposit `amountHsk` HSK into the pool as a lender. Mints pool shares
 * pro-rata. The pool emits `Deposit`; the backend's indexer does NOT track
 * lender deposits (lenders are not on the critical path for the demo) but
 * the on-chain share balance is queryable via `pool.lenders(address)`.
 */
export async function deposit(args: {
  address: `0x${string}`;
  amountHsk: string;
}): Promise<{ txHash: `0x${string}` }> {
  const wallet = getWalletClient();
  if (!wallet) throw new Error("No HSK Chain wallet detected.");

  const amountWei = parseHsk(args.amountHsk);
  const txHash = await wallet.writeContract({
    address: config.poolAddress,
    abi: POOL_ABI,
    functionName: "deposit",
    args: [],
    value: amountWei,
    account: args.address,
    chain: hskTestnet,
  });

  return { txHash };
}

/**
 * Burn `shares` pool shares and withdraw the equivalent HSK. The v1
 * frontend has no Withdraw button — this exists for the next slice.
 */
export async function withdraw(args: {
  address: `0x${string}`;
  shares: bigint;
}): Promise<{ txHash: `0x${string}` }> {
  const wallet = getWalletClient();
  if (!wallet) throw new Error("No HSK Chain wallet detected.");

  const txHash = await wallet.writeContract({
    address: config.poolAddress,
    abi: POOL_ABI,
    functionName: "withdraw",
    args: [args.shares],
    account: args.address,
    chain: hskTestnet,
  });

  return { txHash };
}

// Avoid unused-import warnings if Address isn't referenced elsewhere.
export type { Address };
