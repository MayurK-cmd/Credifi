import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Layout } from "@/components/Layout";
import { RequireWallet } from "@/components/RequireWallet";
import { SectionCard } from "@/components/SectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deposit } from "@/lib/mockData";
import { useWallet, walletStore } from "@/lib/wallet-store";

export const Route = createFileRoute("/lend")({
  head: () => ({ meta: [{ title: "Lend — CrediFi" }] }),
  component: () => (
    <Layout>
      <RequireWallet>
        <LendPage />
      </RequireWallet>
    </Layout>
  ),
});

function LendPage() {
  const { pool } = useWallet();
  const [amount, setAmount] = useState("500");
  const [loading, setLoading] = useState(false);

  const onDeposit = async () => {
    const n = parseFloat(amount);
    if (!Number.isFinite(n) || n <= 0) return toast.error("Enter a valid amount");
    setLoading(true);
    try {
      await deposit(n);
      walletStore.addLiquidity(n);
      toast.success(`Deposited ${n} HSK`, { description: `Earning ${pool.supplyApy.toFixed(2)}% APY` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10 grid lg:grid-cols-5 gap-6">
      <SectionCard title="Supply liquidity" subtitle="Earn yield on idle HSK" className="lg:col-span-3">
        <label className="block text-xs text-muted-foreground mb-2">Amount to deposit (HSK)</label>
        <Input
          type="number"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="h-12 text-lg font-mono"
        />
        <Button onClick={onDeposit} disabled={loading} className="mt-5 w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90">
          {loading ? "Submitting…" : "Deposit"}
        </Button>
      </SectionCard>

      <SectionCard title="Pool stats" className="lg:col-span-2">
        <dl className="space-y-4">
          <Stat label="Total liquidity" value={`${pool.totalLiquidity.toLocaleString()} HSK`} />
          <Stat label="Supply APY" value={`${pool.supplyApy.toFixed(2)}%`} accent />
          <Stat label="Utilization" value={`${Math.round(pool.utilization * 100)}%`} />
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary" style={{ width: `${pool.utilization * 100}%` }} />
          </div>
        </dl>
      </SectionCard>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={`font-display tabular-nums text-lg ${accent ? "text-primary" : ""}`}>{value}</dd>
    </div>
  );
}
