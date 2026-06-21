import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { getEthereum } from "@/lib/chain";
import { truncate } from "@/lib/mockData";
import { useWallet, walletStore } from "@/lib/wallet-store";
import { connectWallet } from "@/lib/wallet-actions";
import { Button } from "@/components/ui/button";

export function WalletButton({ size = "sm" }: { size?: "sm" | "lg" }) {
  const { address } = useWallet();
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // SSR-safe: window.ethereum is only present after hydration. The button
  // still renders during SSR; the disabled state surfaces a helpful message.
  const hasWallet = typeof window !== "undefined" && getEthereum() !== null;

  const onConnect = async () => {
    setLoading(true);
    try {
      const { address } = await connectWallet();
      walletStore.setAddress(address);
      toast.success("Wallet connected", { description: truncate(address) });
      navigate({ to: "/dashboard" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to connect wallet.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const onDisconnect = () => {
    walletStore.setAddress(null);
    toast("Wallet disconnected");
  };

  if (address) {
    return (
      <button
        onClick={onDisconnect}
        className="group flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:border-primary/50 transition"
      >
        <span className="size-2 rounded-full bg-[var(--success)] shadow-[0_0_8px_var(--success)]" />
        <span className="font-mono">{truncate(address)}</span>
      </button>
    );
  }

  return (
    <Button
      onClick={onConnect}
      disabled={loading || !hasWallet}
      size={size === "lg" ? "lg" : "default"}
      title={!hasWallet ? "No HSK wallet detected. Install MetaMask." : undefined}
      className="bg-primary text-primary-foreground hover:bg-primary/90"
    >
      {loading ? "Connecting…" : hasWallet ? "Connect Wallet" : "No wallet"}
    </Button>
  );
}
