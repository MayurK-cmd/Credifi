/**
 * Centralized env reader for the frontend.
 *
 * Vite injects `import.meta.env.VITE_*` at build time. We validate at module
 * load with mainnet defaults (the live deployment as of 2026-07-02) so a
 * fresh checkout builds against the production app out of the box. Local
 * dev against testnet is still supported — copy `frontend/.env.example`
 * (or .env.local) to override the values.
 *
 * Source-of-truth values:
 *   - Mainnet: `contracts/deployments/hskMainnet.json`, `contracts/MAINNET.md`
 *   - Testnet: `contracts/deployments/hskTestnet.json`
 */
function readEnv(key: string): string | undefined {
  // Vite exposes env vars via a Proxy on import.meta.env; bracket access is
  // the only way to keep TS happy about custom keys.
  const v = (import.meta.env as unknown as Record<string, string | undefined>)[key];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

const MAINNET_DEFAULTS = {
  VITE_API_URL: "http://localhost:3001",
  // Live mainnet addresses (chainId 177, 2026-07-02 deploy).
  VITE_ORACLE_ADDRESS: "0xEe39002BF9783DB5dac224Df968D0e3c5CE39a2B",
  VITE_POOL_ADDRESS: "0xDFf2C28CBb78C14Edc0d6F39cb624553D091297f",
  VITE_HSK_RPC_URL: "https://mainnet.hsk.xyz",
  VITE_CHAIN_ID: "177",
  // Placeholder WalletConnect projectId so dev builds don't crash. RainbowKit
  // will warn in the console but the injected (MetaMask) connector still works.
  VITE_WALLETCONNECT_PROJECT_ID: "your-walletconnect-project-id-here",
} as const;

function readConfig(key: keyof typeof MAINNET_DEFAULTS): string {
  return readEnv(key) ?? MAINNET_DEFAULTS[key];
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
