import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, TrendingUp } from "lucide-react";
import { Layout } from "@/components/Layout";
import { RequireWallet } from "@/components/RequireWallet";
import { SectionCard } from "@/components/SectionCard";
import { ScoreGauge } from "@/components/ScoreGauge";
import { Button } from "@/components/ui/button";
import { useWallet, walletStore } from "@/lib/wallet-store";
import { useWalletQueries } from "@/hooks/use-wallet-queries";
import { repay } from "@/lib/wallet-actions";
import { tierFromScore } from "@/lib/mockData";

export const Route = createFileRoute("/repay")({
  head: () => ({ meta: [{ title: "Repay — CrediFi" }] }),
  component: () => (
    <Layout>
      <RequireWallet>
        <RepayPage />
      </RequireWallet>
    </Layout>
  ),
});

function RepayPage() {
  const { loan, profile, address } = useWallet();
  useWalletQueries(address);
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [celebration, setCelebration] = useState<{ before: number; after: number } | null>(null);

  const onRepay = async () => {
    if (!loan) return;
    if (!address) return toast.error("Connect a wallet first");
    setLoading(true);
    try {
      // repay() now waits for the on-chain receipt before resolving. If the
      // tx reverts, an error is thrown and we land in the catch below.
      await repay(address as `0x${string}`);
      const before = profile.score;
      const after = Math.min(1000, before + 15);
      // Optimistic UI updates so the user sees instant feedback.
      walletStore.bumpScore(15);
      walletStore.clearLoan();
      // Tell react-query the loan + score are stale. The queries hook will
      // refetch, the backend indexer will have seen the Repaid event by then
      // (it fires in the same tx as pool.repay), and the store will reflect
      // on-chain truth within a second or two.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["loan", address] }),
        queryClient.invalidateQueries({ queryKey: ["score", address] }),
      ]);
      setCelebration({ before, after });
      if (tierFromScore(after) !== tierFromScore(before)) {
        toast.success("Tier upgraded!", { description: `${tierFromScore(before)} → ${tierFromScore(after)}` });
      } else {
        toast.success("Loan repaid", { description: `Score: ${before} → ${after}` });
      }
    } catch (err) {
      // "No active loan" is the recovery path: a previous repay on this
      // address already closed the position, but the indexer hadn't
      // caught up when this page mounted so we still rendered the loan
      // card. Treat it as a no-op success — clear the local loan state
      // and re-fetch so the UI shows the truth.
      const msg = err instanceof Error ? err.message : "Repay failed.";
      if (msg.includes("No active loan")) {
        walletStore.clearLoan();
        await queryClient.invalidateQueries({ queryKey: ["loan", address] });
        toast.success("Loan already repaid", {
          description: "Updated local state to match on-chain.",
        });
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  if (celebration) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 sm:py-16 fade-up">
        <div className="surface-card p-8 sm:p-10 relative overflow-hidden text-center">
          <div className="absolute inset-0 dot-grid opacity-30" />
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-primary/15 blur-3xl" />
          <div className="relative">
            <div className="inline-flex items-center justify-center size-14 rounded-full bg-primary/15 border border-primary/40 mb-5">
              <CheckCircle2 className="size-7 text-primary" strokeWidth={2} />
            </div>
            <h2 className="font-display text-3xl font-semibold">Loan repaid.</h2>
            <p className="text-sm text-muted-foreground mt-2">
              Your on-chain repayment history just improved.
            </p>

            <div className="mt-8 flex justify-center">
              <ScoreGauge score={profile.score} tier={profile.tier} />
            </div>

            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-1.5 text-sm font-mono">
              <TrendingUp className="size-4 text-primary" />
              <span className="text-muted-foreground">Score:</span>
              <span>{celebration.before}</span>
              <span className="text-primary">→</span>
              <span className="text-primary font-semibold">{celebration.after}</span>
            </div>

            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link to="/dashboard" className="btn-primary-cta inline-flex items-center justify-center rounded-md h-10 px-5 text-sm">
                Back to dashboard
              </Link>
              <Link
                to="/borrow"
                className="inline-flex items-center justify-center rounded-md border border-border bg-card/40 px-5 h-10 text-sm font-medium hover:bg-card hover:border-border/80 transition"
              >
                Borrow again
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6 fade-up">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">Repay</div>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight mt-1.5">
          Repay to boost your score.
        </h1>
      </div>

      <SectionCard
        title="Active loan"
        subtitle={loan ? "Repay to boost your credit score" : "No active loans"}
      >
        {!loan ? (
          <div className="py-12 text-center">
            <div className="text-sm text-muted-foreground">
              You don't have any open positions.
            </div>
            <Link
              to="/borrow"
              className="mt-4 inline-flex items-center justify-center rounded-md border border-border bg-card/40 px-4 h-9 text-sm hover:border-primary/50 transition"
            >
              Go to Borrow →
            </Link>
          </div>
        ) : (
          <>
            <div className="grid sm:grid-cols-3 gap-3">
              <Box label="Borrowed" value={`${loan.borrowed.toFixed(2)} HSK`} />
              <Box label="Collateral locked" value={`${loan.collateral.toFixed(2)} HSK`} />
              <Box label="Interest accrued" value={`${loan.interestAccrued.toFixed(2)} HSK`} />
            </div>

            <div className="mt-5 rounded-lg border border-primary/30 bg-primary/[0.04] p-4 flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Total due
                </div>
                <div className="font-mono text-2xl font-medium mt-1">
                  {(loan.borrowed + loan.interestAccrued).toFixed(2)}
                  <span className="text-sm text-muted-foreground ml-1.5">HSK</span>
                </div>
              </div>
              <div className="text-right text-[11px] text-muted-foreground">
                <div>Health</div>
                <div className="text-primary font-mono mt-0.5">Healthy</div>
              </div>
            </div>

            <Button
              onClick={onRepay}
              disabled={loading}
              className="btn-primary-cta mt-5 w-full h-12 text-sm"
            >
              {loading ? "Submitting…" : "Repay loan"}
            </Button>
            <p className="mt-3 text-[11px] text-muted-foreground text-center">
              On-time repayments improve your CrediFi score.
            </p>
          </>
        )}
      </SectionCard>
    </div>
  );
}

function Box({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background/40 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-mono text-lg font-medium mt-1">{value}</div>
    </div>
  );
}
