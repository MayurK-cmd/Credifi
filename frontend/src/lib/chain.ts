/**
 * viem client helpers for HSK Chain.
 *
 *   getPublicClient()  — read-only RPC client, used by `readContract` calls.
 *   getWalletClient()  — EIP-1193 wallet wrapper (window.ethereum), used by
 *                        writeContract / signature requests.
 *
 * Both clients are singletons built once per browser session. They share the
 * `hskTestnet` chain definition below so viem formats values (wei/HSK,
 * chainId in tx params) correctly without `viem/chains` (which would pin us
 * to whatever's upstream at build time).
 *
 * SSR safety:
 *   - `window.ethereum` is read lazily inside `getWalletClient()` so the
 *     import doesn't throw during server-side rendering.
 *   - If the browser hasn't injected a wallet, `getWalletClient()` returns
 *     `null`; UI surfaces that as "No HSK wallet detected".
 */
import {
  type Chain,
  type PublicClient,
  type WalletClient,
  createPublicClient,
  createWalletClient,
  custom,
  defineChain,
  formatEther,
  http,
  parseEther,
} from "viem";
import { config } from "./config";

const HSK_NATIVE = { name: "HSK", symbol: "HSK", decimals: 18 } as const;

export const hskTestnet: Chain = defineChain({
  id: config.chainId,
  name: config.chainId === 133 ? "HSK Chain Testnet" : "HSK Chain",
  nativeCurrency: HSK_NATIVE,
  rpcUrls: {
    default: {
      http: config.rpcUrl ? [config.rpcUrl] : [],
    },
  },
  blockExplorers: undefined,
  testnet: config.chainId === 133,
});

// ---- Public client (read-only) ----

let publicClient: PublicClient | null = null;

export function getPublicClient(): PublicClient {
  if (!publicClient) {
    publicClient = createPublicClient({
      chain: hskTestnet,
      transport: http(config.rpcUrl),
    });
  }
  return publicClient;
}

// ---- Wallet client (EIP-1193) ----

// Minimal EIP-1193 surface we use. We type-narrow `window.ethereum` to this
// so viem's `custom()` transport is happy without pulling @types/eip1193.
interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
}

export function getEthereum(): EthereumProvider | null {
  if (typeof window === "undefined") return null;
  // The wallet-injected property is named `ethereum` per EIP-1193.
  const w = window as unknown as { ethereum?: EthereumProvider };
  return w.ethereum ?? null;
}

export function getWalletClient(): WalletClient | null {
  const eth = getEthereum();
  if (!eth) return null;
  return createWalletClient({
    chain: hskTestnet,
    transport: custom({
      // viem calls into this object; we forward EIP-1193 methods.
      request: ({ method, params }) =>
        eth.request({ method, params: params as unknown[] | undefined }),
    }),
  });
}

/**
 * Read-only convenience used by the WalletButton. Returns the currently
 * selected account (EIP-1193 `eth_accounts` does not prompt) or null.
 */
export async function getCurrentAccount(): Promise<`0x${string}` | null> {
  const eth = getEthereum();
  if (!eth) return null;
  const accounts = (await eth.request({ method: "eth_accounts" })) as string[];
  const first = accounts[0];
  return first ? (first as `0x${string}`) : null;
}

/**
 * Read-only convenience for `eth_chainId`. Returns a decimal string.
 */
export async function getChainIdHex(): Promise<string | null> {
  const eth = getEthereum();
  if (!eth) return null;
  return (await eth.request({ method: "eth_chainId" })) as string;
}

// ---- Formatting helpers ----

/** Format a wei bigint as an HSK string with up to `decimals` fractional digits. */
export function formatHsk(wei: bigint, decimals = 4): string {
  const full = formatEther(wei);
  const [whole, frac = ""] = full.split(".");
  if (decimals === 0) return whole ?? "0";
  const trimmed = (frac + "0".repeat(decimals)).slice(0, decimals);
  return `${whole ?? "0"}.${trimmed}`;
}

/** Parse a user-typed HSK amount (decimal string) to wei bigint. Throws on invalid. */
export function parseHsk(hsk: string): bigint {
  return parseEther(hsk);
}
