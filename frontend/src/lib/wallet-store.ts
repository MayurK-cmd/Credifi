// =====================================================================
// Wallet + credit profile store.
//
// Tiny global store (React 19-friendly `useSyncExternalStore`) holding the
// connected address, current credit profile, pool stats, and active loan.
//
// Before the backend was wired, this store was the source of truth — UI
// components read from it via `useWallet()` and mock actions in
// `mockData.ts` mutated it directly. Now the queries hook in
// `frontend/src/hooks/use-wallet-queries.ts` writes backend results into
// this store on each fetch, and the route components still subscribe via
// `useWallet()` exactly like before. This is the "1:1 swap-in" pattern
// from PLAN.md §5B — UI components stay untouched.
//
// `setAddress`, `bumpScore`, `addLoan`, `clearLoan`, `addLiquidity` are
// kept for callers that want optimistic local updates (e.g. showing an
// "active loan" pill the instant the user clicks Borrow, before the
// indexer has caught up).
// =====================================================================
import { useSyncExternalStore } from "react";
import {
  emptyPoolStats,
  emptyProfile,
  tierFromScore,
  type ActiveLoan,
  type CreditProfile,
  type PoolStats,
} from "./mockData";

interface State {
  address: string | null;
  profile: CreditProfile;
  pool: PoolStats;
  loan: ActiveLoan | null;
}

let state: State = {
  address: null,
  profile: emptyProfile,
  pool: emptyPoolStats,
  loan: null,
};

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const walletStore = {
  get: () => state,
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },

  // ---- Connection ----

  setAddress(address: string | null) {
    state = { ...state, address };
    emit();
  },

  // ---- Profile (driven by use-wallet-queries) ----

  /**
   * Replace the entire profile (factors + score + tier + history).
   * Called by the queries hook when a fresh `getScore` resolves.
   */
  setProfile(profile: CreditProfile) {
    state = { ...state, profile };
    emit();
  },

  /**
   * Update only the history array. Used when the chart endpoint resolves
   * ahead of (or independently from) the current-score query.
   */
  setProfileHistory(history: { day: string; score: number }[]) {
    state = {
      ...state,
      profile: { ...state.profile, history },
    };
    emit();
  },

  /**
   * Optimistic local bump used after a successful repay (the on-chain
   * `Repaid` event will arrive ~1 block later; the queries hook will then
   * overwrite this with the real backend-computed score).
   */
  bumpScore(delta: number) {
    const newScore = Math.min(1000, Math.max(0, state.profile.score + delta));
    state = {
      ...state,
      profile: {
        ...state.profile,
        score: newScore,
        tier: tierFromScore(newScore),
      },
    };
    emit();
  },

  // ---- Loan (driven by use-wallet-queries, with optimistic add/clear) ----

  /**
   * Set the active loan from the backend. Pass `null` to indicate "no
   * active loan". The queries hook calls this on every successful loan
   * fetch.
   */
  setLoan(loan: ActiveLoan | null) {
    state = { ...state, loan };
    emit();
  },

  /**
   * Optimistic local add — used by `borrow` route after a successful
   * tx but before the backend's indexer has written the row.
   */
  addLoan(borrowed: number, collateral: number) {
    state = {
      ...state,
      loan: { borrowed, collateral, interestAccrued: 0 },
    };
    emit();
  },

  /** Optimistic clear — used by `repay` route after a successful tx. */
  clearLoan() {
    state = { ...state, loan: null };
    emit();
  },

  // ---- Pool stats (driven by use-wallet-queries) ----

  /**
   * Replace the pool stats with the latest backend response.
   */
  setPoolStats(stats: PoolStats) {
    state = { ...state, pool: stats };
    emit();
  },

  /**
   * Optimistic local add — used by `deposit` route to show the new
   * liquidity immediately. The queries hook will overwrite on its next
   * 15s poll.
   */
  addLiquidity(amount: number) {
    state = {
      ...state,
      pool: { ...state.pool, totalLiquidity: state.pool.totalLiquidity + amount },
    };
    emit();
  },
};

export function useWallet() {
  return useSyncExternalStore(walletStore.subscribe, walletStore.get, walletStore.get);
}
