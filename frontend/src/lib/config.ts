/**
 * Centralized env reader for the frontend.
 *
 * Vite injects `import.meta.env.VITE_*` at build time. We validate at module
 * load so a misconfigured deploy fails fast with a readable message instead
 * of "undefined.split is not a function" deep in a render.
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

function required(key: string): string {
  const v = readEnv(key);
  if (!v) {
    throw new Error(
      `Missing required env var ${key}. Copy frontend/.env.example to frontend/.env.local and fill it in.`,
    );
  }
  return v;
}

function asAddress(value: string, key: string): `0x${string}` {
  if (!/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new Error(`Env var ${key} must be a 0x-prefixed 20-byte hex address. Got: ${value}`);
  }
  return value as `0x${string}`;
}

const apiUrlRaw = required("VITE_API_URL");
const apiUrl = apiUrlRaw.replace(/\/+$/, ""); // strip trailing slash
const chainId = Number(readEnv("VITE_CHAIN_ID") ?? "133");
if (!Number.isInteger(chainId) || chainId <= 0) {
  throw new Error(`Env var VITE_CHAIN_ID must be a positive integer. Got: ${chainId}`);
}

export const config = {
  apiUrl,
  oracleAddress: asAddress(required("VITE_ORACLE_ADDRESS"), "VITE_ORACLE_ADDRESS"),
  poolAddress: asAddress(required("VITE_POOL_ADDRESS"), "VITE_POOL_ADDRESS"),
  rpcUrl: readEnv("VITE_HSK_RPC_URL") ?? "",
  chainId,
} as const;
