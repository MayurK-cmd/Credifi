import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown, LogOut, Wallet as WalletIcon, X } from "lucide-react";
import { getEthereum } from "@/lib/chain";
import { truncate } from "@/lib/mockData";
import { useWallet, walletStore } from "@/lib/wallet-store";
import { connectWallet } from "@/lib/wallet-actions";

export function WalletButton({ size = "sm" }: { size?: "sm" | "lg" }) {
  const { address } = useWallet();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  const hasWallet = typeof window !== "undefined" && getEthereum() !== null;

  const doConnect = async (walletKey: string) => {
    setLoading(walletKey);
    try {
      const { address } = await connectWallet();
      walletStore.setAddress(address);
      toast.success("Wallet connected", { description: truncate(address) });
      setOpen(false);
      navigate({ to: "/dashboard" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to connect wallet.";
      toast.error(msg);
    } finally {
      setLoading(null);
    }
  };

  const onDisconnect = () => {
    walletStore.setAddress(null);
    setMenuOpen(false);
    toast("Wallet disconnected");
  };

  if (address) {
    return (
      <div className="relative">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="group flex items-center gap-2 rounded-md border border-border bg-card/60 pl-2 pr-2.5 py-1.5 text-sm hover:border-primary/50 transition"
        >
          <span className="flex items-center gap-1.5 rounded-sm bg-background/60 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            <span className="size-1.5 rounded-full bg-primary" style={{ boxShadow: "0 0 8px var(--primary)" }} />
            HSK
          </span>
          <span className="font-mono text-xs">{truncate(address)}</span>
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 top-full mt-2 w-56 rounded-lg border border-border bg-popover shadow-xl z-40 overflow-hidden">
              <div className="px-3 py-2.5 border-b border-border">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Connected</div>
                <div className="font-mono text-xs mt-0.5 break-all">{address}</div>
              </div>
              <button
                onClick={onDisconnect}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent transition-colors"
              >
                <LogOut className="size-3.5" /> Disconnect
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`btn-primary-cta inline-flex items-center justify-center gap-1.5 rounded-md ${
          size === "lg" ? "h-11 px-5 text-sm" : "h-9 px-4 text-sm"
        }`}
      >
        <WalletIcon className="size-4" />
        Connect Wallet
      </button>
      {open && (
        <WalletModal
          onClose={() => setOpen(false)}
          onPick={doConnect}
          loading={loading}
          hasWallet={hasWallet}
        />
      )}
    </>
  );
}

function WalletModal({
  onClose,
  onPick,
  loading,
  hasWallet,
}: {
  onClose: () => void;
  onPick: (k: string) => void;
  loading: string | null;
  hasWallet: boolean;
}) {
  const WALLETS = [
    { key: "metamask", label: "MetaMask", desc: "Most popular browser wallet", glyph: "🦊" },
    { key: "walletconnect", label: "WalletConnect", desc: "Scan with mobile wallet", glyph: "🔗" },
    { key: "coinbase", label: "Coinbase Wallet", desc: "Self-custody Coinbase", glyph: "🅒" },
  ];
  return (
    <div className="fixed inset-0 z-50 grid place-items-center px-4 fade-up">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md surface-card p-6 shadow-2xl">
        <div className="flex items-start justify-between mb-1">
          <div>
            <h2 className="font-display text-xl font-semibold">Connect a wallet</h2>
            <p className="text-xs text-muted-foreground mt-1">
              CrediFi will read your public on-chain history on HashKey Chain.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-5 space-y-2">
          {WALLETS.map((w) => {
            const isLoading = loading === w.key;
            return (
              <button
                key={w.key}
                onClick={() => onPick(w.key)}
                disabled={loading !== null}
                className="w-full flex items-center gap-3 rounded-lg border border-border bg-card/60 p-3 text-left hover:border-primary/50 hover:bg-card transition disabled:opacity-50"
              >
                <span className="size-10 rounded-md bg-background grid place-items-center text-lg border border-border">
                  {w.glyph}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium">{w.label}</span>
                  <span className="block text-[11px] text-muted-foreground">{w.desc}</span>
                </span>
                {isLoading ? (
                  <span className="text-xs font-mono text-primary">Connecting…</span>
                ) : (
                  <span className="text-xs text-muted-foreground">→</span>
                )}
              </button>
            );
          })}
        </div>

        {!hasWallet && (
          <p className="mt-4 text-[11px] text-muted-foreground text-center">
            No injected wallet detected — install MetaMask to connect for real.
          </p>
        )}

        <div className="mt-5 pt-4 border-t border-border/60 flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
          <span>By connecting you agree to terms.</span>
          <span className="font-mono">v1 · Testnet</span>
        </div>
      </div>
    </div>
  );
}
