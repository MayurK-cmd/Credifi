import { createFileRoute, Link } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { RequireWallet } from "@/components/RequireWallet";
import { SectionCard } from "@/components/SectionCard";
import { ScoreGauge } from "@/components/ScoreGauge";
import { ScoreBreakdown } from "@/components/ScoreBreakdown";
import { ScoreHistoryChart } from "@/components/ScoreHistoryChart";
import { useWalletQueries } from "@/hooks/use-wallet-queries";
import { useWallet } from "@/lib/wallet-store";
import { config } from "@/lib/config";
import { truncate, TIER_RATIOS } from "@/lib/mockData";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — CrediFi" }] }),
  component: () => (
    <Layout>
      <RequireWallet>
        <Dashboard />
      </RequireWallet>
    </Layout>
  ),
});

function Dashboard() {
  const { address, profile, loan } = useWallet();
  // Mount the queries hook so score/history/loan/pool data flow from the
  // backend into the store. The hook is no-op-friendly when `address` is null.
  useWalletQueries(address);
  const ratio = TIER_RATIOS[profile.tier];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Connected</div>
          <div className="font-mono text-sm mt-1">{truncate(address!)}</div>
        </div>
        <div className="text-xs text-muted-foreground">HSK Chain · Chain {config.chainId}</div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <SectionCard title="Credit Score" subtitle="AI-derived from on-chain activity" className="lg:col-span-1">
          <div className="flex justify-center py-2">
            <ScoreGauge score={profile.score} tier={profile.tier} />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-center text-xs">
            <div className="rounded-md bg-muted/60 p-2">
              <div className="text-muted-foreground">Tier collateral</div>
              <div className="font-medium mt-0.5">{Math.round(ratio * 100)}%</div>
            </div>
            <div className="rounded-md bg-muted/60 p-2">
              <div className="text-muted-foreground">Active loan</div>
              <div className="font-medium mt-0.5">{loan ? `${loan.borrowed} HSK` : "None"}</div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Score Breakdown" subtitle="What's driving your number" className="lg:col-span-1">
          <ScoreBreakdown factors={profile.factors} />
        </SectionCard>

        <SectionCard title="Score History" subtitle="Last 6 updates" className="lg:col-span-1">
          <ScoreHistoryChart data={profile.history} />
          <div className="mt-2 text-xs text-muted-foreground">
            Score trending up after recent repayment.
          </div>
        </SectionCard>
      </div>

      <div className="grid sm:grid-cols-2 gap-6">
        <ActionCard
          to="/borrow"
          title="Borrow"
          body="Tap your credit tier for lower-collateral loans in native HSK."
          cta="Open borrow →"
        />
        <ActionCard
          to="/lend"
          title="Lend / Supply"
          body="Provide liquidity to the pool and earn the current supply APY."
          cta="Supply liquidity →"
        />
      </div>
    </div>
  );
}

function ActionCard({ to, title, body, cta }: { to: "/borrow" | "/lend"; title: string; body: string; cta: string }) {
  return (
    <Link to={to} className="surface-card p-6 group hover:border-primary/50 transition-colors">
      <h3 className="font-display text-xl font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground mt-2">{body}</p>
      <div className="mt-6 text-sm text-primary group-hover:translate-x-1 transition-transform">{cta}</div>
    </Link>
  );
}
