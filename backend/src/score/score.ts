/**
 * Default scoring rule (v1, rule-based).
 *
 * Algorithm:
 *   1. Each input from WalletHistory is mapped to a sub-score in [0, 100].
 *      The mapping is piecewise-linear with explicit saturation points —
 *      no magic numbers, all in one place.
 *   2. Sub-scores are multiplied by their weights from config (must sum
 *      to 100). The weighted sum, scaled by 10, is the final score in
 *      [0, 1000].
 *   3. Liquidation history is applied as a penalty on the repayment
 *      sub-score so a wallet that has been liquidated gets a strong
 *      negative signal even if it has otherwise repaid successfully.
 *   4. The tier is derived from the final score via `tierFromScore`
 *      (matches CrediFiOracle.computeTier).
 *
 * Determinism: same input -> same output. No randomness, no time-based
 * logic, no external calls.
 *
 * Pluggability: implements `ScoringRule` so v2 (ML-based) can be swapped
 * in via a one-line dependency-injection change at the API layer.
 */
import { config, tierFromScore } from "../config.js";
import type { ScoreFactor, ScoreResult, ScoringRule, WalletHistory } from "./types.js";

// ----- sub-score mapping (each in [0, 100]) -----
//
// Saturate wallet age at 1 year: a 2-year-old wallet is no more credit-
// worthy than a 1-year-old one for our purposes.
const AGE_SATURATION_DAYS = 365;
// Saturate tx count at 1000: above this we don't reward further activity.
const TX_SATURATION = 1_000;
// HSK balance saturation: 100k HSK earns full asset-diversity points.
const HSK_BALANCE_SATURATION_WEI = 100_000n * 10n ** 18n;

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 100) return 100;
  return n;
}

function walletAgeSubScore(ageDays: number): number {
  // 0 days -> 0; AGE_SATURATION_DAYS days -> 100.
  return clamp01((ageDays / AGE_SATURATION_DAYS) * 100);
}

function txActivitySubScore(txCount: number): number {
  return clamp01((txCount / TX_SATURATION) * 100);
}

function repaymentSubScore(repaidCount: number, liquidatedCount: number): number {
  // Each repaid loan adds 20 points up to a max of 100. Each liquidation
  // subtracts `LIQUIDATION_PENALTY_PER_EVENT` (25) points, floored at 0.
  const base = clamp01(repaidCount * 20);
  const penalty = liquidatedCount * config.scoring.liquidationPenaltyPerEvent;
  return clamp01(base - penalty);
}

function assetDiversitySubScore(hskBalanceWei: string): number {
  // Compare wei strings by parsing once. Use BigInt to avoid loss.
  let balance: bigint;
  try {
    balance = BigInt(hskBalanceWei);
  } catch {
    return 0;
  }
  if (balance <= 0n) return 0;
  // ratio = balance / saturation, capped at 1, then *100.
  const ratio =
    balance >= HSK_BALANCE_SATURATION_WEI
      ? 1
      : Number((balance * 10_000n) / HSK_BALANCE_SATURATION_WEI) / 10_000;
  return clamp01(ratio * 100);
}

/**
 * The default scoring rule.
 *
 * Exported as a singleton because it has no state.
 */
export const defaultRule: ScoringRule = {
  compute(history: WalletHistory): ScoreResult {
    const age = walletAgeSubScore(history.ageDays);
    const activity = txActivitySubScore(history.txCount);
    const repayment = repaymentSubScore(
      history.repaidLoanCount,
      history.liquidatedLoanCount,
    );
    const diversity = assetDiversitySubScore(history.hskBalanceWei);

    const factors: ScoreFactor[] = [
      { label: config.scoring.labels[0], value: Math.round(age) },
      { label: config.scoring.labels[1], value: Math.round(activity) },
      { label: config.scoring.labels[2], value: Math.round(repayment) },
      { label: config.scoring.labels[3], value: Math.round(diversity) },
    ];

    // Weighted sum of sub-scores, scaled to [0, 1000].
    const weighted =
      age * config.scoring.weights.walletAge +
      activity * config.scoring.weights.txActivity +
      repayment * config.scoring.weights.repaymentHistory +
      diversity * config.scoring.weights.assetDiversity;

    const score = Math.round(weighted * 10);

    return {
      score,
      tier: tierFromScore(score),
      factors,
    };
  },
};

/**
 * Convenience: fetch history + run the default rule in one call.
 * Used by the API and CLI.
 */
export async function getScore(address: string): Promise<ScoreResult> {
  const { fetchWalletHistory } = await import("./history.js");
  const history = await fetchWalletHistory(address);
  return defaultRule.compute(history);
}
