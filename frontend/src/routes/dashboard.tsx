import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, RefreshCw, TrendingUp, Wallet, PiggyBank } from "lucide-react";
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
  const { address, profile, loan, pool } = useWallet();
  useWalletQueries(address);
  const ratio = TIER_RATIOS[profile.tier];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6 fade-up">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="font-mono text-xs px-2 py-1 rounded border border-border bg-card/60 inline-flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-primary" style={{ boxShadow: "0 0 8px var(--primary)" }} />
            HashKey Chain · {config.chainId}
          </div>
          <div className="font-mono text-xs text-muted-foreground">{truncate(address!)}</div>
        </div>
        <button className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition px-2 py-1 rounded border border-transparent hover:border-border">
          <RefreshCw className="size-3" /> Refresh score
        </button>
      </div>

      {/* Hero score row */}
      <div className="grid lg:grid-cols-3 gap-6">
        <SectionCard
          title="Credit Score"
          subtitle="AI-derived from on-chain activity"
          className="lg:col-span-1"
        >
          <div className="flex justify-center py-3">
            <ScoreGauge score={profile.score} tier={profile.tier} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <MiniStat label="Tier collateral" value={`${Math.round(ratio * 100)}%`} />
            <MiniStat
              label="Active loan"
              value={loan ? `${loan.borrowed.toFixed(0)} HSK` : "None"}
              accent={!!loan}
            />
          </div>
        </SectionCard>

        <SectionCard
          title="Score Breakdown"
          subtitle="Contributing factors"
          className="lg:col-span-1"
        >
          <ScoreBreakdown factors={profile.factors} />
        </SectionCard>

        <SectionCard
          title="Score History"
          subtitle="Last 30 days"
          className="lg:col-span-1"
          action={
            <span className="inline-flex items-center gap-1 text-[11px] text-primary font-medium">
              <TrendingUp className="size-3" /> +15
            </span>
          }
        >
          <ScoreHistoryChart data={profile.history} />
          <div className="mt-3 text-[11px] text-muted-foreground flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-primary" />
            Score ticked up after most recent repayment.
          </div>
        </SectionCard>
      </div>

      {/* Active position */}
      {loan && (
        <SectionCard title="Active Position" subtitle="Your open loan">
          <div className="grid sm:grid-cols-4 gap-3">
            <PositionStat label="Borrowed" value={`${loan.borrowed.toFixed(2)} HSK`} />
            <PositionStat label="Collateral locked" value={`${loan.collateral.toFixed(2)} HSK`} />
            <PositionStat label="Interest accrued" value={`${loan.interestAccrued.toFixed(2)} HSK`} />
            <Link
              to="/repay"
              className="btn-primary-cta inline-flex items-center justify-center rounded-lg h-full min-h-12"
            >
              Repay loan →
            </Link>
          </div>
        </SectionCard>
      )}

      {/* Action cards */}
      <div className="grid sm:grid-cols-2 gap-6">
        <ActionCard
          to="/borrow"
          icon={Wallet}
          title="Borrow"
          body="Tap your credit tier for lower-collateral loans."
          teaser={`Your rate: ${Math.round(ratio * 100)}% collateral (Tier ${profile.tier})`}
        />
        <ActionCard
          to="/lend"
          icon={PiggyBank}
          title="Lend / Supply"
          body="Provide liquidity to the pool and earn yield."
          teaser={`Current APY: ${pool.supplyApy.toFixed(2)}%`}
        />
      </div>
    </div>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-md bg-background/40 border border-border p-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-mono text-sm font-medium mt-0.5 ${accent ? "text-primary" : ""}`}>
        {value}
      </div>
    </div>
  );
}

function PositionStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-background/40 border border-border p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-mono text-lg mt-1">{value}</div>
    </div>
  );
}

function ActionCard({
  to,
  icon: Icon,
  title,
  body,
  teaser,
}: {
  to: "/borrow" | "/lend";
  icon: typeof Wallet;
  title: string;
  body: string;
  teaser: string;
}) {
  return (
    <Link
      to={to}
      className="surface-card surface-card-hover p-6 group relative overflow-hidden"
    >
      <div className="flex items-start justify-between">
        <div className="inline-flex items-center justify-center size-10 rounded-lg bg-primary/10 border border-primary/30 text-primary">
          <Icon className="size-5" strokeWidth={2} />
        </div>
        <ArrowUpRight className="size-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
      </div>
      <h3 className="font-display text-xl font-semibold mt-4">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1.5">{body}</p>
      <div className="mt-5 pt-4 border-t border-border/60 font-mono text-[11px] uppercase tracking-wider text-primary">
        {teaser}
      </div>
    </Link>
  );
}
