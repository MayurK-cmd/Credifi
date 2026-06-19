import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { WalletButton } from "./WalletButton";

const NAV = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/borrow", label: "Borrow" },
  { to: "/lend", label: "Lend" },
  { to: "/repay", label: "Repay" },
] as const;

export function Layout({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2">
            <Logo />
            <span className="font-display text-lg font-semibold tracking-tight">CrediFi</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1 text-sm">
            {NAV.map((n) => {
              const active = path === n.to;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`px-3 py-1.5 rounded-md transition-colors ${
                    active
                      ? "text-foreground bg-accent"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  }`}
                >
                  {n.label}
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
                    active ? "bg-accent text-foreground" : "text-muted-foreground"
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
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <div>© 2026 CrediFi · Built on HSK Chain</div>
          <div>AI credit scores for on-chain lending</div>
        </div>
      </footer>
    </div>
  );
}

function Logo() {
  return (
    <div className="size-8 rounded-lg bg-primary/15 border border-primary/30 grid place-items-center">
      <div className="size-3 rounded-sm bg-primary shadow-[0_0_12px_var(--primary)]" />
    </div>
  );
}
