import { ConnectButton } from "@rainbow-me/rainbowkit";

/**
 * CrediFi's header / hero wallet button.
 *
 * Thin wrapper around RainbowKit's `<ConnectButton />` so the call sites
 * (`Layout`, `RequireWallet`, landing hero, how-it-works CTA) stay
 * identical. RainbowKit owns the connection lifecycle, modal, chain
 * switching, and disconnect; the active account is mirrored into our
 * local `walletStore` by `AccountBridge` in `__root.tsx` so the rest of
 * the app keeps reading via `useWallet()` exactly like before.
 *
 * The `size` prop mirrors the previous custom button: `lg` for hero /
 * pre-connect call-to-action surfaces, `sm` for the header pill. We
 * forward both to RainbowKit's `chainStatus` and `accountStatus` props
 * for consistent sizing.
 */
export function WalletButton({ size = "sm" }: { size?: "sm" | "lg" }) {
  // RainbowKit's <ConnectButton /> renders an inline pill (connect
  // button when disconnected, account chip when connected). We keep
  // our previous visual baseline:
  //   - "sm" (header): compact chip, "Connect Wallet" only
  //   - "lg" (hero / CTA): larger, shows account balance too
  //
  // The literal types are inlined (vs. pulled from the variable) so
  // TS narrows them to the union ConnectButton expects; otherwise
  // `size === "lg" ? "address" : "address"` widens to `string`.
  return (
    <ConnectButton
      accountStatus="address"
      chainStatus="icon"
      showBalance={size === "lg"}
      label="Connect Wallet"
    />
  );
}
