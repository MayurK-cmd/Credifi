/**
 * EIP-712 type hash and domain constants used by both the off-chain signer
 * and the on-chain CrediFiOracle contract.
 *
 * CRITICAL: keep these in lockstep with the Solidity source. If either
 * drifts, every signature test will silently fail because the recovered
 * signer will not match.
 */

export const EIP712_DOMAIN_NAME = "CrediFiOracle";
export const EIP712_DOMAIN_VERSION = "1";

/**
 * EIP-712 type string. Must exactly match the `SCORE_TYPEHASH` literal in
 * contracts/CrediFiOracle.sol.
 */
export const SCORE_TYPE_STRING =
  "Score(address wallet,uint16 score,uint8 tier,uint64 expiresAt,uint256 nonce)";

/**
 * Tier minimum scores. Mirrors CrediFiOracle.TIER_*_MIN and the frontend
 * mockData.ts::tierFromScore.
 */
export const TIER_A_MIN = 800;
export const TIER_B_MIN = 650;
export const TIER_C_MIN = 450;
export const SCORE_MAX = 1000;

/** Compute the tier number (1..4) for a given score. Mirrors computeTier in CrediFiOracle. */
export function tierFromScore(score: number): 1 | 2 | 3 | 4 {
  if (score >= TIER_A_MIN) return 1;
  if (score >= TIER_B_MIN) return 2;
  if (score >= TIER_C_MIN) return 3;
  return 4;
}

/** Compute the required collateral ratio (in BPS) for a tier number. Mirrors CrediFiPool._ratioForTier. */
export function ratioForTier(tier: 1 | 2 | 3 | 4): number {
  switch (tier) {
    case 1: return 5_000;
    case 2: return 8_000;
    case 3: return 12_000;
    case 4: return 15_000;
  }
}

/** Tier A name. */
export const TIER_A = 1;
/** Tier B name. */
export const TIER_B = 2;
/** Tier C name. */
export const TIER_C = 3;
/** Tier D name. */
export const TIER_D = 4;