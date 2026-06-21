/**
 * Shared types for the scoring pipeline.
 *
 *   WalletHistory  -> raw inputs pulled from on-chain + DB
 *   ScoreResult    -> public output (this is what the frontend renders)
 *   SignedScoreBundle -> the EIP-712 signature, ready to submit on-chain
 */

/** A single factor sub-score, 0–100. Multiplied by its weight for the final. */
export interface ScoreFactor {
  label: string;
  value: number; // 0..100
}

/** Raw inputs the scorer needs. Computed by `history.ts`. */
export interface WalletHistory {
  address: string; // lowercase
  /** Wallet age in days (0 if unknown / brand new). */
  ageDays: number;
  /** Total transaction count per `provider.getTransactionCount`. */
  txCount: number;
  /** Native HSK balance in wei (string). */
  hskBalanceWei: string;
  /** Number of prior loans this wallet has repaid on CrediFi. */
  repaidLoanCount: number;
  /** Number of prior loans this wallet has been liquidated on. */
  liquidatedLoanCount: number;
}

/** Final score + tier + factor breakdown. Shape mirrors `frontend/src/lib/mockData.ts::CreditProfile`. */
export interface ScoreResult {
  /** 0..1000 */
  score: number;
  /** Letter tier derived from score. */
  tier: "A" | "B" | "C" | "D";
  /** Factor breakdown. Labels match `frontend/src/lib/mockData.ts::initialProfile.factors`. */
  factors: ScoreFactor[];
}

/** Signature bundle the frontend (or borrow tx) passes to `oracle.submitScore`. */
export interface SignedScoreBundle {
  /** Wallet the score is for, lowercase. */
  wallet: string;
  score: number;
  tier: 1 | 2 | 3 | 4;
  expiresAt: number; // unix seconds
  nonce: bigint;
  v: number;
  r: string; // 0x-prefixed hex
  s: string; // 0x-prefixed hex
  /** The EIP-712 digest that was signed (useful for debugging mismatches). */
  digest: string;
}

/** A pluggable scoring rule. v2 can swap in an ML model without changing callers. */
export interface ScoringRule {
  compute(history: WalletHistory): ScoreResult;
}
