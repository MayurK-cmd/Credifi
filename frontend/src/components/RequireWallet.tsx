import type { ReactNode } from "react";
import { useWallet } from "@/lib/wallet-store";
import { WalletButton } from "./WalletButton";

export function RequireWallet({ children }: { children: ReactNode }) {
  const { address } = useWallet();
  if (!address) {
    return (
      <div className="max-w-md mx-auto mt-24 text-center px-6">
        <h2 className="font-display text-2xl font-semibold">Connect your wallet</h2>
        <p className="text-sm text-muted-foreground mt-2 mb-6">
          You need to connect a wallet on HSK Chain to view this page.
        </p>
        <div className="flex justify-center">
          <WalletButton size="lg" />
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
