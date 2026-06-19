// Tiny global store for wallet + credit profile mock state.
// Replace with wagmi hooks + real backend queries later.
import { useSyncExternalStore } from "react";
import {
  initialLoan,
  initialPool,
  initialProfile,
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
  profile: initialProfile,
  pool: initialPool,
  loan: initialLoan,
};

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const walletStore = {
  get: () => state,
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  setAddress(address: string | null) {
    state = { ...state, address };
    emit();
  },
  bumpScore(delta: number) {
    const newScore = Math.min(1000, state.profile.score + delta);
    const lastDay = state.profile.history.at(-1);
    const nextLabel = lastDay ? `W${parseInt(lastDay.day.slice(1)) + 1}` : "W7";
    state = {
      ...state,
      profile: {
        ...state.profile,
        score: newScore,
        tier: tierFromScore(newScore),
        history: [...state.profile.history.slice(-5), { day: nextLabel, score: newScore }],
      },
    };
    emit();
  },
  clearLoan() {
    state = { ...state, loan: null };
    emit();
  },
  addLoan(borrowed: number, collateral: number) {
    state = {
      ...state,
      loan: { borrowed, collateral, interestAccrued: 0 },
    };
    emit();
  },
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
