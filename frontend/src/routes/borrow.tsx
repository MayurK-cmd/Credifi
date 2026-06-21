import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Layout } from "@/components/Layout";
import { RequireWallet } from "@/components/RequireWallet";
import { SectionCard } from "@/components/SectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TIER_RATIOS, type Tier } from "@/lib/mockData";
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
  const { profile } = useWallet();
  const [amount, setAmount] = useState("100");
  const [loading, setLoading] = useState(false);
  const ratio = TIER_RATIOS[profile.tier];
  const collateral = useMemo(() => {
    const n = parseFloat(amount);
    return Number.isFinite(n) && n > 0 ? n * ratio : 0;
  }, [amount, ratio]);

  const onBorrow = async () => {
    const n = parseFloat(amount);
    if (!Number.isFinite(n) || n <= 0) return toast.error("Enter a valid amount");
    const { address } = useWallet();
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
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10 grid lg:grid-cols-5 gap-6">
      <SectionCard title="Borrow HSK" subtitle={`Your tier: ${profile.tier} · Collateral ratio ${Math.round(ratio * 100)}%`} className="lg:col-span-3">
        <label className="block text-xs text-muted-foreground mb-2">Amount to borrow (HSK)</label>
        <Input
          type="number"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="h-12 text-lg font-mono"
        />
        <div className="mt-4 rounded-lg border border-border bg-muted/40 p-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground">Collateral required</div>
            <div className="font-display text-2xl tabular-nums mt-1">
              {collateral.toFixed(2)} <span className="text-base text-muted-foreground">HSK</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">At tier {profile.tier}</div>
            <div className="text-sm mt-1">{Math.round(ratio * 100)}% of loan</div>
          </div>
        </div>
        <Button onClick={onBorrow} disabled={loading} className="mt-5 w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90">
          {loading ? "Submitting…" : "Borrow"}
        </Button>
      </SectionCard>

      <SectionCard title="Collateral by tier" subtitle="Higher score = lower collateral" className="lg:col-span-2">
        <div className="space-y-2">
          {(Object.keys(TIER_RATIOS) as Tier[]).map((t) => {
            const active = t === profile.tier;
            return (
              <div
                key={t}
                className={`flex items-center justify-between rounded-md px-3 py-2.5 border ${
                  active ? "border-primary/60 bg-primary/10" : "border-border bg-muted/30"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="font-display font-semibold w-6">{t}</span>
                  <span className="text-xs text-muted-foreground">
                    {t === "A" && "800–1000"}
                    {t === "B" && "650–799"}
                    {t === "C" && "450–649"}
                    {t === "D" && "0–449"}
                  </span>
                </div>
                <span className="tabular-nums font-medium text-sm">{Math.round(TIER_RATIOS[t] * 100)}%</span>
              </div>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}
