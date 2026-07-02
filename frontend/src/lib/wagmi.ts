/**
 * wagmi + RainbowKit configuration.
 *
 * The config wires two connectors out of the box:
 *   - Injected (MetaMask, Rabby, OKX wallet, etc. — anything that exposes
 *     `window.ethereum` per EIP-1193)
 *   - WalletConnect v2 (mobile wallets via QR scan)
 *
 * `getDefaultConfig` from RainbowKit does the heavy lifting: it instantiates
 * the injected connector, sets up WalletConnect v2 with the projectId, picks
 * sensible SSR / batch / polling defaults, and returns a `wagmi.Config` you
 * can pass straight into `<WagmiProvider config={wagmiConfig}>`.
 *
 * The chain is HSK Chain (mainnet 177 by default, testnet 133 in `.env.local`).
 * We pass the same `hskChain` viem chain definition used elsewhere in the app
 * so the RPC URL, native currency, and decimals stay consistent between read
 * calls (`getPublicClient`) and write calls (the wallet client wagmi builds
 * for the active connector).
 *
 * The `projectId` is required by WalletConnect v2 — the placeholder in
 * `.env.example` is enough for dev (the injected connector still works,
 * RainbowKit logs a console warning). Get a real one at
 * https://cloud.walletconnect.com before shipping.
 */
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "viem";
import { hskChain } from "./chain";
import { config } from "./config";

export const wagmiConfig = getDefaultConfig({
  appName: "CrediFi",
  appDescription: "AI credit scores for HSK Chain lending",
  appUrl: "https://credifi.xyz",
  projectId: config.walletConnectProjectId,
  chains: [hskChain],
  transports: {
    [hskChain.id]: http(config.rpcUrl),
  },
  // Disable WalletConnect telemetry pings that have a long delay on a
  // single-chain demo. Not strictly necessary; speeds up boot.
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
