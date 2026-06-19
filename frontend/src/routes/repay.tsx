import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Layout } from "@/components/Layout";
import { RequireWallet } from "@/components/RequireWallet";
import { SectionCard } from "@/components/SectionCard";
import { Button } from "@/components/ui/button";
import { repay } from "@/lib/mockData";
import { useWallet, walletStore } from "@/lib/wallet-store";

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
  const { loan, profile } = useWallet();
  const [loading, setLoading] = useState(false);

  const onRepay = async () => {
    if (!loan) return;
    setLoading(true);
    try {
      const { scoreDelta } = await repay();
      const before = profile.score;
      walletStore.bumpScore(scoreDelta);
      walletStore.clearLoan();
      toast.success("Loan repaid", {
        description: `Score increased: ${before} → ${before + scoreDelta}`,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
      <SectionCard title="Active loan" subtitle={loan ? "Repay to boost your credit score" : "No active loans"}>
        {!loan ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            You don't have any open positions. Head to <span className="text-foreground">Borrow</span> to take out a loan.
          </div>
        ) : (
          <>
            <div className="grid sm:grid-cols-3 gap-3">
              <Box label="Borrowed" value={`${loan.borrowed.toFixed(2)} HSK`} />
              <Box label="Collateral locked" value={`${loan.collateral.toFixed(2)} HSK`} />
              <Box label="Interest accrued" value={`${loan.interestAccrued.toFixed(2)} HSK`} />
            </div>

            <div className="mt-5 rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
              <div className="text-muted-foreground">Total due</div>
              <div className="font-display text-2xl tabular-nums mt-1">
                {(loan.borrowed + loan.interestAccrued).toFixed(2)} <span className="text-base text-muted-foreground">HSK</span>
              </div>
            </div>

            <Button
              onClick={onRepay}
              disabled={loading}
              className="mt-5 w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {loading ? "Submitting…" : "Repay loan"}
            </Button>
            <p className="mt-3 text-xs text-muted-foreground text-center">
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
    <div className="rounded-md border border-border bg-muted/30 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-display tabular-nums mt-1">{value}</div>
    </div>
  );
}
