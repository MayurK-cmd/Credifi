import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Layout } from "@/components/Layout";
import { RequireWallet } from "@/components/RequireWallet";
import { SectionCard } from "@/components/SectionCard";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TIER_RATIOS } from "@/lib/mockData";
import { useWallet, walletStore } from "@/lib/wallet-store";
import { borrow } from "@/lib/wallet-actions";

export const Route = createFileRoute("/borrow")({
  head: () => ({ meta: [{ title: "Borrow — CrediFi" }] }),
  component: () => (
    <Layout>
      <RequireWallet>
        <BorrowPage />
      </RequireWallet>
    </Layout>
  ),
});

function BorrowPage() {
  const { profile, address } = useWallet();
  const [amount, setAmount] = useState("100");
  const [loading, setLoading] = useState(false);
  const ratio = TIER_RATIOS[profile.tier];
  const collateral = useMemo(() => {
    const n = parseFloat(amount);
    return Number.isFinite(n) && n > 0 ? n * ratio : 0;
  }, [amount, ratio]);
  const n = parseFloat(amount);
  const valid = Number.isFinite(n) && n > 0;

  const onBorrow = async () => {
    if (!valid) return toast.error("Enter a valid amount");
    if (!address) return toast.error("Connect a wallet first");
    setLoading(true);
    try {
      const result = await borrow({
        address: address as `0x${string}`,
        amountHsk: amount,
        collateralHsk: collateral.toFixed(4),
      });
      walletStore.addLoan(n, collateral);
      toast.success(`Borrowed ${result.amountHsk} HSK`, {
        description: `Collateral locked: ${Number(result.collateralHsk).toFixed(2)} HSK`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Borrow failed.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6 fade-up">
      <PageHeader
        eyebrow="Borrow"
        title="Borrow native HSK against your credit tier."
        sub={`Your current tier: ${profile.tier} · Collateral ratio ${Math.round(ratio * 100)}%`}
      />

      <div className="grid lg:grid-cols-5 gap-6">
        <SectionCard
          title="Loan Amount"
          subtitle="How much HSK do you want?"
          className="lg:col-span-3"
        >
          <div className="rounded-lg border border-border bg-background/40 p-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Amount to borrow
              </label>
              <button
                onClick={() => setAmount("1000")}
                className="text-[10px] font-mono uppercase tracking-wider text-primary hover:underline"
              >
                MAX
              </button>
            </div>
            <div className="flex items-baseline gap-2">
              <Input
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-12 text-3xl font-mono font-medium border-0 bg-transparent px-0 focus-visible:ring-0 shadow-none"
              />
              <span className="font-mono text-sm text-muted-foreground">HSK</span>
            </div>
            <div className="font-mono text-[11px] text-muted-foreground mt-1">
              ≈ ${(valid ? n * 0.42 : 0).toFixed(2)} USD
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-primary/30 bg-primary/[0.04] p-4 flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Collateral required
              </div>
              <div className="font-mono text-2xl font-medium mt-1">
                {collateral.toFixed(2)}
                <span className="text-sm text-muted-foreground ml-1.5">HSK</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                At tier {profile.tier}
              </div>
              <div className="font-mono text-sm mt-1">{Math.round(ratio * 100)}% of loan</div>
            </div>
          </div>

          <div className="mt-4 text-xs text-muted-foreground leading-relaxed">
            You will receive <span className="font-mono text-foreground">{valid ? n.toFixed(2) : "0.00"} HSK</span> and
            must lock <span className="font-mono text-foreground">{collateral.toFixed(2)} HSK</span> as
            collateral at your current <span className="text-foreground">Tier {profile.tier}</span> rate
            ({Math.round(ratio * 100)}%).
          </div>

          <Button
            onClick={onBorrow}
            disabled={loading || !valid}
            className="btn-primary-cta mt-5 w-full h-12 text-sm"
          >
            {loading ? "Submitting…" : "Borrow HSK"}
          </Button>
        </SectionCard>

        <SectionCard
          title="Your Tier"
          subtitle="Score → collateral ratio"
          className="lg:col-span-2"
        >
          <div className="space-y-2.5">
            {(["A", "B", "C", "D"] as const).map((t) => {
              const active = t === profile.tier;
              const r = TIER_RATIOS[t];
              return (
                <div
                  key={t}
                  className={`flex items-center justify-between rounded-lg px-3.5 py-3 border transition-colors ${
                    active
                      ? "border-primary/60 bg-primary/[0.06]"
                      : "border-border bg-background/40"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="font-display text-xl font-semibold w-6"
                      style={{ color: `var(--tier-${t.toLowerCase()})` }}
                    >
                      {t}
                    </span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {t === "A" && "800–1000"}
                      {t === "B" && "650–799"}
                      {t === "C" && "450–649"}
                      {t === "D" && "0–449"}
                    </span>
                  </div>
                  <span className="font-mono font-medium text-sm">
                    {Math.round(r * 100)}%
                  </span>
                </div>
              );
            })}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function PageHeader({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">{eyebrow}</div>
      <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight mt-1.5">{title}</h1>
      {sub && <p className="text-sm text-muted-foreground mt-2">{sub}</p>}
    </div>
  );
}


