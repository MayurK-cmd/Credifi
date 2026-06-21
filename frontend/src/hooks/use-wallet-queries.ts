/**
 * react-query bindings that mirror backend data into the walletStore.
 *
 * The existing routes/components subscribe to `walletStore` via `useWallet()`
 * (see `frontend/src/lib/wallet-store.ts`). This hook keeps that contract:
 *   - On each backend fetch, the resulting data is pushed into the store,
 *     causing `useWallet()` consumers to re-render.
 *   - The store is treated as the single source of truth for the UI; this
 *     hook is the one place that talks to the backend.
 *
 * Refetch cadence:
 *   - Score: every 30s (so the chart updates after a repay).
 *   - Pool stats: every 15s (page-level stat, lighter than per-wallet).
 *   - Loan + history: only on `address` change (no timer; the indexer
 *     catches up to the chain in <1 block).
 *
 * Usage: `<Dashboard />` mounts `useWalletQueries(address!)` once at the top
 * of its render — that's all.
 */
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { getActiveLoan, getPoolStats, getScore, getScoreHistory } from "@/lib/api";
import type { ActiveLoan, CreditProfile, PoolStats } from "@/lib/mockData";
import { walletStore } from "@/lib/wallet-store";

export function useWalletQueries(address: string | null): void {
  // ----- Score (current) -----
  const scoreQ = useQuery({
    queryKey: ["score", address],
    queryFn: () => getScore(address as string),
    enabled: !!address,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  // ----- Score history (chart data) -----
  const historyQ = useQuery({
    queryKey: ["scoreHistory", address],
    queryFn: () => getScoreHistory(address as string, 30),
    enabled: !!address,
    staleTime: 30_000,
  });

  // ----- Active loan -----
  const loanQ = useQuery({
    queryKey: ["loan", address],
    queryFn: () => getActiveLoan(address as string),
    enabled: !!address,
    staleTime: 15_000,
  });

  // ----- Pool stats (global, no address dependency) -----
  const poolQ = useQuery({
    queryKey: ["poolStats"],
    queryFn: getPoolStats,
    refetchInterval: 15_000,
    staleTime: 10_000,
  });

  // Mirror results into the store. We use a single effect with deps so a
  // stale-time guarantee + manual invalidation flow both work.
  useEffect(() => {
    if (scoreQ.data) {
      const d = scoreQ.data;
      const profile: CreditProfile = {
        score: d.score,
        tier: d.tier,
        factors: d.factors,
        history: historyQ.data ?? d.history ?? [],
      };
      walletStore.setProfile(profile);
    }
  }, [scoreQ.data, historyQ.data]);

  useEffect(() => {
    if (historyQ.data && !scoreQ.data) {
      // History arrived before (or without) the current-score query —
      // update the chart portion only.
      walletStore.setProfileHistory(historyQ.data);
    }
  }, [historyQ.data, scoreQ.data]);

  useEffect(() => {
    if (loanQ.data !== undefined) {
      const next: ActiveLoan | null = loanQ.data;
      walletStore.setLoan(next);
    }
  }, [loanQ.data]);

  useEffect(() => {
    if (poolQ.data) {
      const next: PoolStats = poolQ.data;
      walletStore.setPoolStats(next);
    }
  }, [poolQ.data]);
}
