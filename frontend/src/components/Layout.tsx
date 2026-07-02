import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { WalletButton } from "./WalletButton";
import { config } from "@/lib/config";

const NAV = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/borrow", label: "Borrow" },
  { to: "/lend", label: "Lend" },
  { to: "/repay", label: "Repay" },
  { to: "/how-it-works", label: "How It Works" },
  { to: "/status", label: "Status" },
] as const;

export function Layout({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2.5 group">
            <Logo />
            <span className="font-display text-lg font-semibold tracking-tight">
              Credi<span className="text-primary">Fi</span>
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-0.5 text-sm">
            {NAV.map((n) => {
              const active = path === n.to;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`relative px-3 py-1.5 rounded-md transition-colors ${
                    active
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {n.label}
                  {active && (
                    <span className="absolute left-3 right-3 -bottom-[17px] h-px bg-primary" />
                  )}
                </Link>
              );
            })}
          </nav>
          <WalletButton />
        </div>
        <nav className="md:hidden border-t border-border/60 overflow-x-auto">
          <div className="flex gap-1 px-4 py-2 text-xs whitespace-nowrap">
            {NAV.map((n) => {
              const active = path === n.to;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`px-3 py-1.5 rounded-md ${
                    active ? "bg-primary/10 text-primary" : "text-muted-foreground"
                  }`}
                >
                  {n.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border/60 mt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2.5">
            <Logo small />
            <span>
              © 2026 CrediFi · Built on{" "}
              <span className="text-foreground">HashKey Chain</span>
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link to="/how-it-works" className="hover:text-foreground transition-colors">How It Works</Link>
            <Link to="/status" className="hover:text-foreground transition-colors">Status</Link>
            <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            <a href="#" className="hover:text-foreground transition-colors">GitHub</a>
            <a href="#" className="hover:text-foreground transition-colors">Docs</a>
            <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border border-border">
              {config.chainId === 133 ? "Testnet · Experimental" : "Mainnet"}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Logo({ small }: { small?: boolean }) {
  const s = small ? "size-5" : "size-8";
  const inner = small ? "size-2" : "size-3";
  return (
    <div className={`${s} rounded-lg bg-primary/10 border border-primary/30 grid place-items-center`}>
      <div
        className={`${inner} rounded-[2px] bg-primary`}
        style={{ boxShadow: "0 0 10px var(--primary)" }}
      />
    </div>
  );
}
