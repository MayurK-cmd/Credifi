/**
 * CrediFi backend — central configuration.
 *
 * Fails fast on startup if a required env var is missing. Every tunable
 * the backend reads from the environment goes through this module so that
 * (a) tests / scripts have one place to override, and (b) we never sprinkle
 * `process.env.X` reads across the codebase.
 *
 * Tier thresholds and ratio weights are colocated here so the scoring
 * rules live next to the rest of the config. They MUST stay in lockstep
 * with `contracts/CrediFiOracle.sol`, `contracts/CrediFiPool.sol`, and
 * `frontend/src/lib/mockData.ts`.
 */
import "dotenv/config";

// ----- required env vars (server crashes at startup if any is missing) -----

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") {
    throw new Error(`Missing required env var: ${name}. See backend/.env.example.`);
  }
  return v;
}

function optionalEnv(name: string, fallback: string): string {
  const v = process.env[name];
  return v && v.trim() !== "" ? v : fallback;
}

function intEnv(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v || v.trim() === "") return fallback;
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) throw new Error(`Env var ${name} must be an integer, got "${v}"`);
  return n;
}

// ----- chain / contract -----

const HSK_RPC_URL = requireEnv("HSK_RPC_URL");
const CHAIN_ID = intEnv("CHAIN_ID", 133);
const ORACLE_ADDRESS = requireEnv("ORACLE_ADDRESS");
const POOL_ADDRESS = requireEnv("POOL_ADDRESS");
const RELAYER_PRIVATE_KEY = requireEnv("RELAYER_PRIVATE_KEY");

// ----- server -----

const PORT = intEnv("PORT", 3001);
const SCORE_TTL_SECONDS = intEnv("SCORE_TTL_SECONDS", 3600);

// ----- EIP-712 domain (matches contracts/CrediFiOracle.sol) -----
//
// CRITICAL: name + version + the SCORE_TYPE_STRING below MUST match the
// SCORE_TYPEHASH literal in CrediFiOracle.sol. If either drifts, every
// signature silently fails to recover. See contracts/test/helpers/constants.ts.
const EIP712_DOMAIN_NAME = "CrediFiOracle";
const EIP712_DOMAIN_VERSION = "1";

/**
 * EIP-712 type string. Verbatim from the contract's `SCORE_TYPEHASH` literal.
 * If this drifts from CrediFiOracle.sol, every signature silently fails to
 * recover (the digest will not match what the contract recomputes).
 */
const SCORE_TYPE_STRING =
  "Score(address wallet,uint16 score,uint8 tier,uint64 expiresAt,uint256 nonce)";

// ----- scoring rules (PLAN.md §5B, kept in lockstep with mockData.ts) -----

/**
 * Tier minimum scores. Mirror CrediFiOracle.TIER_*_MIN.
 */
const TIER_A_MIN = 800;
const TIER_B_MIN = 650;
const TIER_C_MIN = 450;
const SCORE_MAX = 1000;

/**
 * Tier encoding (uint8, matches CrediFiOracle.TIER_* and CrediFiPool.TIER_*).
 * 1 = A, 2 = B, 3 = C, 4 = D.
 */
const TIER_A = 1;
const TIER_B = 2;
const TIER_C = 3;
const TIER_D = 4;

/**
 * Tier name ↔ number converters. Single source of truth on the backend
 * side — mirror CrediFiOracle.computeTier.
 */
export function tierFromScore(score: number): "A" | "B" | "C" | "D" {
  if (score >= TIER_A_MIN) return "A";
  if (score >= TIER_B_MIN) return "B";
  if (score >= TIER_C_MIN) return "C";
  return "D";
}

export function tierNumberFromScore(score: number): 1 | 2 | 3 | 4 {
  const letter = tierFromScore(score);
  return { A: 1, B: 2, C: 3, D: 4 }[letter] as 1 | 2 | 3 | 4;
}

export function tierLetterFromNumber(t: 1 | 2 | 3 | 4 | number): "A" | "B" | "C" | "D" {
  return ({ 1: "A", 2: "B", 3: "C", 4: "D" } as const)[t as 1 | 2 | 3 | 4];
}

/**
 * Weighted scoring factors. Must sum to 100. Each factor is computed as
 * a sub-score in [0, 100] from the WalletHistory, then multiplied by its
 * weight to produce the final score in [0, 1000].
 *
 * v1 rule: wallet age + tx activity + repayment history (including a
 * liquidation penalty) + asset diversity. Liquidation history is folded
 * into repayment as a penalty — there's no fifth weight.
 *
 * The label list below is the canonical set the frontend's `factors`
 * array expects (mirrors mockData.ts::initialProfile.factors).
 */
export const SCORE_FACTOR_WEIGHTS = {
  walletAge: 20,
  txActivity: 25,
  repaymentHistory: 35,
  assetDiversity: 20,
} as const;

export const SCORE_FACTOR_LABELS = [
  "Wallet Age",
  "Transaction Activity",
  "Repayment History",
  "Asset Diversity",
] as const;

/**
 * Liquidation penalty (in factor-sub-score points, 0–100 scale). Applied
 * per liquidation observed in this wallet's history on CrediFi. Hard-capped
 * at 100 to prevent negative scores.
 */
export const LIQUIDATION_PENALTY_PER_EVENT = 25;

// ----- final typed config object -----

export const config = {
  // Chain
  rpcUrl: HSK_RPC_URL,
  chainId: CHAIN_ID,
  oracleAddress: ORACLE_ADDRESS,
  poolAddress: POOL_ADDRESS,

  // Signer (must match oracle.signer on the deployed Oracle)
  relayerPrivateKey: RELAYER_PRIVATE_KEY,

  // Server
  port: PORT,
  scoreTtlSeconds: SCORE_TTL_SECONDS,

  // EIP-712
  eip712: {
    domainName: EIP712_DOMAIN_NAME,
    domainVersion: EIP712_DOMAIN_VERSION,
    scoreTypeString: SCORE_TYPE_STRING,
  },

  // Scoring
  tier: {
    aMin: TIER_A_MIN,
    bMin: TIER_B_MIN,
    cMin: TIER_C_MIN,
    scoreMax: SCORE_MAX,
    aNum: TIER_A,
    bNum: TIER_B,
    cNum: TIER_C,
    dNum: TIER_D,
  },
  scoring: {
    weights: SCORE_FACTOR_WEIGHTS,
    labels: SCORE_FACTOR_LABELS,
    liquidationPenaltyPerEvent: LIQUIDATION_PENALTY_PER_EVENT,
  },

  // Indexer behavior
  indexer: {
    /** Block lag on first run to avoid reorg over genesis. */
    safeStartBlocks: 50,
    /** How many blocks to scan per poll cycle. */
    blockBatchSize: 500,
    /** How long to wait between polls when the chain head hasn't advanced. */
    pollIntervalMs: 5_000,
  },
} as const;

export type Config = typeof config;
