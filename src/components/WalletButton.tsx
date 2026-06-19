import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { connectWallet, truncate } from "@/lib/mockData";
import { useWallet, walletStore } from "@/lib/wallet-store";
import { Button } from "@/components/ui/button";

export function WalletButton({ size = "sm" }: { size?: "sm" | "lg" }) {
  const { address } = useWallet();
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onConnect = async () => {
    setLoading(true);
    try {
      const { address } = await connectWallet();
      walletStore.setAddress(address);
      toast.success("Wallet connected");
      navigate({ to: "/dashboard" });
    } finally {
      setLoading(false);
    }
  };

  if (address) {
    return (
      <button
        onClick={() => {
          walletStore.setAddress(null);
          toast("Wallet disconnected");
        }}
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
      disabled={loading}
      size={size === "lg" ? "lg" : "default"}
      className="bg-primary text-primary-foreground hover:bg-primary/90"
    >
      {loading ? "Connecting…" : "Connect Wallet"}
    </Button>
  );
}
