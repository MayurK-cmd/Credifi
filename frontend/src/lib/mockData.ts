// =====================================================================
// TYPES + PURE CONSTANTS
//
// All mock actions (connectWallet / borrow / deposit / repay) and seed
// data (initialProfile / initialPool / initialLoan) were deleted when the
// frontend was wired to the backend + HSK Chain. Real implementations
// live in:
//   - frontend/src/lib/wallet-actions.ts   (on-chain user actions via viem)
//   - frontend/src/hooks/use-wallet-queries.ts (backend REST fan-out)
//
// The types and constants below stay because they're imported by both
// the UI components and the new data layer.
// =====================================================================

export type Tier = "A" | "B" | "C" | "D";

export interface ScoreFactor {
  label: string;
  value: number; // 0-100
}

export interface CreditProfile {
  score: number; // 0-1000
  tier: Tier;
  factors: ScoreFactor[];
  history: { day: string; score: number }[];
}

export interface PoolStats {
  totalLiquidity: number; // display value, post-formatEther
  supplyApy: number; // percent (e.g. 6.42 = 6.42%)
  utilization: number; // 0..1
}

export interface ActiveLoan {
  borrowed: number;
  collateral: number;
  interestAccrued: number;
}

/** Tier → collateral ratio, as a fraction of borrow. Mirrors CrediFiPool BPS constants. */
export const TIER_RATIOS: Record<Tier, number> = {
  A: 0.5, // TIER_A_RATIO_BPS = 5_000
  B: 0.8, // TIER_B_RATIO_BPS = 8_000
  C: 1.2, // TIER_C_RATIO_BPS = 12_000
  D: 1.5, // TIER_D_RATIO_BPS = 15_000
};

/** Derive tier letter from a 0..1000 score. Mirrors CrediFiOracle.computeTier. */
export const tierFromScore = (score: number): Tier => {
  if (score >= 800) return "A";
  if (score >= 650) return "B";
  if (score >= 450) return "C";
  return "D";
};

/** The 4 factor labels the backend's scoring rule emits. UI ordering matches. */
export const SCORE_FACTOR_LABELS = [
  "Wallet Age",
  "Transaction Activity",
  "Repayment History",
  "Asset Diversity",
] as const;

/** Truncated address for header pills, e.g. "0x4f3a...9b21". */
export const truncate = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

/**
 * Empty profile — what the store holds before the backend responds. Same
 * shape as `initialProfile` from the mock-data version, but with score 0
 * and zeroed factors. The dashboard renders this state for ~1 frame on
 * first connection; the queries hook replaces it within ~10ms.
 */
export const emptyProfile: CreditProfile = {
  score: 0,
  tier: "D",
  factors: SCORE_FACTOR_LABELS.map((label) => ({ label, value: 0 })),
  history: [],
};

/** Empty pool stats — used as the store's initial state until /api/pool/stats resolves. */
export const emptyPoolStats: PoolStats = {
  totalLiquidity: 0,
  supplyApy: 0,
  utilization: 0,
};
