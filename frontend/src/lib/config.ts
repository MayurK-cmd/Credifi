/**
 * Centralized env reader for the frontend.
 *
 * Vite injects `import.meta.env.VITE_*` at build time. We validate at module
 * load with mock/demo defaults so the hackathon UI can run in preview without
 * requiring local env setup. Real API / contract wiring can still override
 * these with VITE_* values when integration starts.
 *
 * Source-of-truth values live in `frontend/.env.example` (the template the
 * user copies to `.env.local`). Defaults are sensible for local dev against
 * the testnet contracts deployed at `contracts/deployments/hskTestnet.json`.
 */
function readEnv(key: string): string | undefined {
  // Vite exposes env vars via a Proxy on import.meta.env; bracket access is
  // the only way to keep TS happy about custom keys.
  const v = (import.meta.env as unknown as Record<string, string | undefined>)[key];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

const DEMO_DEFAULTS = {
  VITE_API_URL: "http://localhost:3001",
  VITE_ORACLE_ADDRESS: "0x6345Ec7861cDCf8798F5D40348d91Cdbe077544B",
  VITE_POOL_ADDRESS: "0x0bFeE39682e4a5CA057A33838d06Ca7b43bF42Cc",
  VITE_HSK_RPC_URL: "https://testnet.hsk.xyz",
  VITE_CHAIN_ID: "133",
  // Placeholder WalletConnect projectId so dev builds don't crash. RainbowKit
  // will warn in the console but the injected (MetaMask) connector still works.
  VITE_WALLETCONNECT_PROJECT_ID: "your-walletconnect-project-id-here",
} as const;

function readConfig(key: keyof typeof DEMO_DEFAULTS): string {
  return readEnv(key) ?? DEMO_DEFAULTS[key];
}

function asAddress(value: string, key: string): `0x${string}` {
  if (!/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new Error(`Env var ${key} must be a 0x-prefixed 20-byte hex address. Got: ${value}`);
  }
  return value as `0x${string}`;
}

const apiUrlRaw = readConfig("VITE_API_URL");
const apiUrl = apiUrlRaw.replace(/\/+$/, ""); // strip trailing slash
const chainId = Number(readConfig("VITE_CHAIN_ID"));
if (!Number.isInteger(chainId) || chainId <= 0) {
  throw new Error(`Env var VITE_CHAIN_ID must be a positive integer. Got: ${chainId}`);
}

export const config = {
  apiUrl,
  oracleAddress: asAddress(readConfig("VITE_ORACLE_ADDRESS"), "VITE_ORACLE_ADDRESS"),
  poolAddress: asAddress(readConfig("VITE_POOL_ADDRESS"), "VITE_POOL_ADDRESS"),
  rpcUrl: readConfig("VITE_HSK_RPC_URL"),
  chainId,
  walletConnectProjectId: readConfig("VITE_WALLETCONNECT_PROJECT_ID"),
} as const;
