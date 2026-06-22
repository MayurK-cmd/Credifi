import type { ReactNode } from "react";
import { useWallet } from "@/lib/wallet-store";
import { WalletButton } from "./WalletButton";

export function RequireWallet({ children }: { children: ReactNode }) {
  const { address } = useWallet();
  if (!address) {
    return (
      <div className="max-w-md mx-auto mt-20 sm:mt-28 text-center px-6 fade-up">
        <div className="inline-flex items-center justify-center size-12 rounded-xl bg-primary/10 border border-primary/30 mb-5">
          <div className="size-3 rounded-sm bg-primary" style={{ boxShadow: "0 0 10px var(--primary)" }} />
        </div>
        <h2 className="font-display text-2xl font-semibold">Connect your wallet</h2>
        <p className="text-sm text-muted-foreground mt-2 mb-6">
          Connect a wallet on HashKey Chain to view your credit score and access lending.
        </p>
        <div className="flex justify-center">
          <WalletButton size="lg" />
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
