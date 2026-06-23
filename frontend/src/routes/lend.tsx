import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Layout } from "@/components/Layout";
import { RequireWallet } from "@/components/RequireWallet";
import { SectionCard } from "@/components/SectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWallet, walletStore } from "@/lib/wallet-store";
import { useWalletQueries } from "@/hooks/use-wallet-queries";
import { deposit, withdraw } from "@/lib/wallet-actions";
import { getLenderPosition } from "@/lib/pool-reads";
import { formatHsk } from "@/lib/chain";

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
  const { pool, address } = useWallet();
  useWalletQueries(address);
  const [amount, setAmount] = useState("500");
  const [loading, setLoading] = useState(false);
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const n = parseFloat(amount);
  const valid = Number.isFinite(n) && n > 0;

  const projected = useMemo(
    () => (valid ? (n * pool.supplyApy) / 100 : 0),
    [n, pool.supplyApy, valid],
  );

  // Live lender position from the on-chain pool contract. Re-fetches every
  // 30s and after any deposit/withdraw so the "Your Position" card stays
  // accurate without manual refresh.
  const lenderQ = useQuery({
    queryKey: ["lenderPosition", address],
    queryFn: () => getLenderPosition(address as `0x${string}`),
    enabled: !!address,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const queryClient = useQueryClient();

  const onDeposit = async () => {
    if (!valid) return toast.error("Enter a valid amount");
    if (!address) return toast.error("Connect a wallet first");
    setLoading(true);
    try {
      await deposit({ address: address as `0x${string}`, amountHsk: amount });
      walletStore.addLiquidity(n);
      await queryClient.invalidateQueries({ queryKey: ["lenderPosition", address] });
      toast.success(`Deposited ${n} HSK`, {
        description: `Earning ${pool.supplyApy.toFixed(2)}% APY`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Deposit failed.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const onWithdraw = async () => {
    if (!address) return toast.error("Connect a wallet first");
    const data = lenderQ.data;
    if (!data || data.sharesWei === 0n) {
      return toast.error("No position to withdraw");
    }
    setWithdrawLoading(true);
    try {
      await withdraw({ address: address as `0x${string}`, shares: data.sharesWei });
      await queryClient.invalidateQueries({ queryKey: ["lenderPosition", address] });
      await queryClient.invalidateQueries({ queryKey: ["poolStats"] });
      toast.success(
        `Withdrew ${formatHsk(data.currentValueWei, 4)} HSK`,
        { description: "Position cleared from pool" },
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Withdraw failed.";
      toast.error(msg);
    } finally {
      setWithdrawLoading(false);
    }
  };

  // Derived position stats for the card.
  const sharesHsk = lenderQ.data ? formatHsk(lenderQ.data.sharesWei, 4) : "—";
  const currentValueHsk = lenderQ.data ? formatHsk(lenderQ.data.currentValueWei, 4) : "—";
  const poolSharePct = useMemo(() => {
    if (!lenderQ.data) return 0;
    if (lenderQ.data.totalSharesWei === 0n) return 0;
    return Number(
      (lenderQ.data.sharesWei * 10_000n) / lenderQ.data.totalSharesWei,
    ) / 100;
  }, [lenderQ.data]);
  const hasPosition = !!lenderQ.data && lenderQ.data.sharesWei > 0n;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6 fade-up">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">Lend</div>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight mt-1.5">
          Supply HSK, earn yield.
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          Provide liquidity to the CrediFi pool — paid back to borrowers across all tiers.
        </p>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        <SectionCard title="Supply Liquidity" subtitle="Earn yield on idle HSK" className="lg:col-span-3">
          <div className="rounded-lg border border-border bg-background/40 p-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Amount to deposit
              </label>
              <button
                onClick={() => setAmount("10000")}
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
          </div>

          <div className="mt-4 rounded-lg border border-primary/30 bg-primary/[0.04] p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Estimated earnings
            </div>
            <div className="font-mono text-2xl font-medium mt-1">
              ~{projected.toFixed(2)} <span className="text-sm text-muted-foreground">HSK / year</span>
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              at current {pool.supplyApy.toFixed(2)}% APY
            </div>
          </div>

          <Button
            onClick={onDeposit}
            disabled={loading || !valid}
            className="btn-primary-cta mt-5 w-full h-12 text-sm"
          >
            {loading ? "Submitting…" : "Deposit HSK"}
          </Button>
        </SectionCard>

        <SectionCard title="Pool Stats" subtitle="Live protocol data" className="lg:col-span-2">
          <div className="space-y-4">
            <Stat label="Total liquidity" value={`${pool.totalLiquidity.toLocaleString()} HSK`} />
            <Stat label="Supply APY" value={`${pool.supplyApy.toFixed(2)}%`} accent />
            <Stat label="Utilization" value={`${Math.round(pool.utilization * 100)}%`} />
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-[width] duration-700"
                style={{ width: `${pool.utilization * 100}%` }}
              />
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Your Position" subtitle="Live from the CrediFiPool contract">
        {lenderQ.isLoading ? (
          <div className="text-xs text-muted-foreground font-mono">
            Loading position…
          </div>
        ) : lenderQ.isError ? (
          <div className="text-xs text-destructive font-mono">
            Could not read position: {lenderQ.error instanceof Error
              ? lenderQ.error.message
              : String(lenderQ.error)}
          </div>
        ) : (
          <>
            <div className="grid sm:grid-cols-4 gap-3 items-stretch">
              <PosStat label="Shares" value={sharesHsk} />
              <PosStat label="Current value" value={`${currentValueHsk} HSK`} accent />
              <PosStat label="Pool share" value={`${poolSharePct.toFixed(2)}%`} />
              <button
                onClick={onWithdraw}
                disabled={withdrawLoading || !hasPosition}
                className="rounded-lg border border-border bg-background/40 hover:border-primary/50 hover:bg-card transition px-4 py-3 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {withdrawLoading
                  ? "Submitting…"
                  : `Withdraw ${currentValueHsk} HSK`}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-3">
              Your current value is your share of the pool&apos;s total assets.
              As borrowers repay interest, your share value grows pro-rata;
              new lenders dilute your share count but not your HSK-equivalent value.
            </p>
          </>
        )}
      </SectionCard>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-xs text-muted-foreground uppercase tracking-wider">{label}</dt>
      <dd className={`font-mono tabular-nums text-lg font-medium ${accent ? "text-primary" : ""}`}>
        {value}
      </dd>
    </div>
  );
}

function PosStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-background/40 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-mono text-lg font-medium mt-1 ${accent ? "text-primary" : ""}`}>
        {value}
      </div>
    </div>
  );
}
