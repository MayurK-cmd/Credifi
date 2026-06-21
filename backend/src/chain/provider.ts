/**
 * ethers v6 provider singleton + minimal hand-written ABIs for the two
 * contracts the backend talks to.
 *
 * Why hand-written ABIs instead of pulling typechain-types from
 * `contracts/`:
 *  - The backend only needs ~10 functions/events total.
 *  - Keeping the ABIs here means the backend is self-contained — no
 *    cross-package typechain sharing, no fragile build-order coupling.
 *  - Each fragment is annotated with the contract source line it mirrors.
 *
 * CRITICAL: if the corresponding Solidity function or event signature
 * changes, update the fragment here too. Mismatched ABIs throw at runtime
 * with a "no matching function" error from ethers.
 */
import { Contract, JsonRpcProvider, Wallet } from "ethers";
import { config } from "../config.js";

// ============================================================================
// CrediFiOracle ABI
// ============================================================================

/**
 * Mirrors:
 *   contracts/CrediFiOracle.sol:
 *     - signer() returns address              [view]
 *     - submitScore(...) external              [writes; relayer-only]
 *     - currentScore(address) returns Score    [view]
 *     - computeTier(uint16) returns uint8      [pure]
 *     - eip712Domain() returns EIP712Domain    [view]
 *
 * ScoreSubmitted event:
 *   event ScoreSubmitted(address indexed wallet, uint16 score, uint8 tier, uint64 expiresAt, uint256 nonce);
 */
export const ORACLE_ABI = [
  // View functions
  "function signer() view returns (address)",
  "function computeTier(uint16 score) pure returns (uint8)",
  "function currentScore(address wallet) view returns (tuple(uint16 score, uint8 tier, uint64 expiresAt, uint256 nonce))",
  "function eip712Domain() view returns (bytes32 fields, string name, string version, uint256 chainId, address verifyingContract, bytes32 salt, uint256[] extensions)",
  // External writes (not used by the backend, but listed for completeness / typechain parity)
  "function submitScore(address wallet, uint16 score, uint8 tier, uint64 expiresAt, uint256 nonce, uint8 v, bytes32 r, bytes32 s)",
  // Events
  "event ScoreSubmitted(address indexed wallet, uint16 score, uint8 tier, uint64 expiresAt, uint256 nonce)",
] as const;

/**
 * Mirrors:
 *   contracts/CrediFiPool.sol:
 *     - poolTotalAssets() view returns uint256
 *     - availableLiquidity() view returns uint256
 *     - totalBorrows() view returns uint256
 *     - totalShares() view returns uint256
 *     - DEFAULT_BORROW_RATE_BPS() view returns uint256
 *     - PROTOCOL_FEE_BPS() view returns uint256
 *
 *   events:
 *     event Deposit(address indexed lender, uint256 amount, uint256 shares);
 *     event Withdrawn(address indexed lender, uint256 burnedShares, uint256 amountOut);
 *     event Borrow(address indexed borrower, uint256 amount, uint256 collateral, uint16 score, uint8 tier, uint256 scoreNonce);
 *     event Repaid(address indexed borrower, uint256 principal, uint256 interest, uint256 treasuryFee);
 *     event Liquidated(address indexed borrower, address indexed liquidator, uint256 debt, uint256 collateralSeized);
 */
export const POOL_ABI = [
  // View functions used by /api/pool/stats
  "function poolTotalAssets() view returns (uint256)",
  "function availableLiquidity() view returns (uint256)",
  "function totalBorrows() view returns (uint256)",
  "function totalShares() view returns (uint256)",
  "function DEFAULT_BORROW_RATE_BPS() view returns (uint256)",
  "function PROTOCOL_FEE_BPS() view returns (uint256)",
  // Events for the indexer
  "event Deposit(address indexed lender, uint256 amount, uint256 shares)",
  "event Withdrawn(address indexed lender, uint256 burnedShares, uint256 amountOut)",
  "event Borrow(address indexed borrower, uint256 amount, uint256 collateral, uint16 score, uint8 tier, uint256 scoreNonce)",
  "event Repaid(address indexed borrower, uint256 principal, uint256 interest, uint256 treasuryFee)",
  "event Liquidated(address indexed borrower, address indexed liquidator, uint256 debt, uint256 collateralSeized)",
] as const;

// ============================================================================
// Singletons
// ============================================================================

const globalForChain = globalThis as unknown as {
  provider: JsonRpcProvider | undefined;
  relayer: Wallet | undefined;
  oracle: Contract | undefined;
  pool: Contract | undefined;
};

function buildProvider(): JsonRpcProvider {
  return new JsonRpcProvider(config.rpcUrl, config.chainId);
}

function buildRelayer(provider: JsonRpcProvider): Wallet {
  return new Wallet(config.relayerPrivateKey, provider);
}

export function getProvider(): JsonRpcProvider {
  if (!globalForChain.provider) {
    globalForChain.provider = buildProvider();
  }
  return globalForChain.provider;
}

export function getRelayer(): Wallet {
  if (!globalForChain.relayer) {
    globalForChain.relayer = buildRelayer(getProvider());
  }
  return globalForChain.relayer;
}

export function getOracle(): Contract {
  if (!globalForChain.oracle) {
    globalForChain.oracle = new Contract(config.oracleAddress, ORACLE_ABI, getProvider());
  }
  return globalForChain.oracle;
}

export function getPool(): Contract {
  if (!globalForChain.pool) {
    globalForChain.pool = new Contract(config.poolAddress, POOL_ABI, getProvider());
  }
  return globalForChain.pool;
}

/**
 * Tear down singletons. Called on graceful shutdown so Prisma connections
 * and the ethers provider close cleanly.
 */
export function closeChain(): void {
  globalForChain.provider = undefined;
  globalForChain.relayer = undefined;
  globalForChain.oracle = undefined;
  globalForChain.pool = undefined;
}

/** Async helper: fetch the chain ID the RPC actually serves (for sanity checks). */
export async function fetchLiveChainId(): Promise<number> {
  const net = await getProvider().getNetwork();
  return Number(net.chainId);
}
