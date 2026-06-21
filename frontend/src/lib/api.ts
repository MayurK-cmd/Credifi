/**
 * Thin `fetch` wrapper around the CrediFi backend REST API.
 *
 * Every function returns the exact shape the UI components in
 * `frontend/src/components/*` and the routes in `frontend/src/routes/*` expect.
 * No retry / caching here — that's react-query's job (see
 * `frontend/src/hooks/use-wallet-queries.ts`).
 *
 * Errors are thrown as plain `Error` with the backend's text body so toasts
 * can show "Backend: 404 not found" without bespoke error-class plumbing.
 *
 * Money amounts:
 *   - The backend returns wei as **strings** (never numbers — JS Number can't
 *     safely represent uint256). The frontend's `PoolStats.totalLiquidity`
 *     type is `number` (it's a display value, post-`formatEther`), so the
 *     conversion happens here, not at the call site.
 *   - `nonce` from `POST /api/score/:addr/sign` is a BigInt in JSON; we
 *     accept it as string and the caller can BigInt() it.
 */
import type { ActiveLoan, CreditProfile, PoolStats, ScoreFactor, Tier } from "./mockData";
import { config } from "./config";
import { formatEther } from "viem";

/** Shape the backend `/api/score/:address` returns. */
export interface BackendScoreResponse extends CreditProfile {
  address: string;
  _history: {
    ageDays: number;
    txCount: number;
    hskBalanceWei: string;
    repaidLoanCount: number;
    liquidatedLoanCount: number;
  };
}

/** Raw point the chart consumes. `day` is an ISO date string (YYYY-MM-DD). */
export interface ScoreHistoryPoint {
  day: string;
  score: number;
}

/** Shape the backend `/api/pool/stats` returns. All wei values are strings. */
interface BackendPoolStatsResponse {
  totalLiquidity: string;
  availableLiquidity: string;
  totalBorrows: string;
  utilization: number;
  supplyApy: number;
  borrowApr: number;
  protocolFeeRate: number;
  fetchedAt: string;
}

/** Shape the backend `/api/loan/:address/active` returns. */
interface BackendActiveLoansResponse {
  address: string;
  count: number;
  loans: Array<{
    id: string;
    principal: string;
    collateralLocked: string;
    tierAtBorrow: string;
    borrowedAt: string;
    borrowTxHash: string;
  }>;
}

/** Shape the backend `POST /api/score/:address/sign` returns. */
export interface SignedScoreBundle {
  wallet: string;
  score: number;
  tier: 1 | 2 | 3 | 4;
  expiresAt: number;
  nonce: string; // bigint-serialized by JSON.stringify; caller converts
  v: number;
  r: string; // 0x-prefixed
  s: string; // 0x-prefixed
  digest: string;
}

class BackendError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "BackendError";
    this.status = status;
  }
}

async function request<T>(method: "GET" | "POST", path: string): Promise<T> {
  const url = `${config.apiUrl}${path}`;
  const res = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new BackendError(`Backend ${method} ${path} → ${res.status}: ${text}`, res.status);
  }
  return (await res.json()) as T;
}

/** GET /api/score/:address — current score, tier, factor breakdown, recent history. */
export async function getScore(address: string): Promise<BackendScoreResponse> {
  return request("GET", `/api/score/${address}`);
}

/** GET /api/score/:address/history?limit=N — paginated score history (chart data). */
export async function getScoreHistory(address: string, limit = 30): Promise<ScoreHistoryPoint[]> {
  const r = await request<{ scores: ScoreHistoryPoint[] }>(
    "GET",
    `/api/score/${address}/history?limit=${limit}`,
  );
  return r.scores;
}

/**
 * GET /api/pool/stats — live pool stats. Returns the shape the UI's
 * `PoolStats` type expects (display numbers, not wei strings).
 */
export async function getPoolStats(): Promise<PoolStats> {
  const r = await request<BackendPoolStatsResponse>("GET", "/api/pool/stats");
  return {
    // Total liquidity as a display HSK number. Below 1 HSK we keep up to 4
    // decimal places (the demo pool starts empty and gets seeded with small
    // amounts like 0.3 HSK — `Math.round(0.3)` would otherwise display `0`).
    // Above 1 HSK we round to whole units so the lend card's thousands
    // separator formatting reads naturally.
    totalLiquidity: displayHsk(r.totalLiquidity),
    supplyApy: r.supplyApy * 100, // backend returns decimal; UI expects percent
    utilization: r.utilization,
  };
}

/**
 * Convert a wei string into a display HSK number. Picks a precision based
 * on magnitude so small balances are visible but large balances are compact.
 *   "300000000000000000" -> 0.3
 *   "1284500000000000000000000" -> 1284500
 */
function displayHsk(wei: string): number {
  const eth = Number(formatEtherSafe(wei));
  if (!Number.isFinite(eth)) return 0;
  if (eth === 0) return 0;
  if (eth < 1) return Math.round(eth * 10_000) / 10_000;
  if (eth < 1_000) return Math.round(eth * 100) / 100;
  return Math.round(eth);
}

/**
 * GET /api/loan/:address/active — pick the most-recent active loan (or null).
 * Maps the backend's wei-string principal/collateral into a display-number
 * `ActiveLoan` shape the route components already expect.
 */
export async function getActiveLoan(address: string): Promise<ActiveLoan | null> {
  const r = await request<BackendActiveLoansResponse>("GET", `/api/loan/${address}/active`);
  const loan = r.loans[0];
  if (!loan) return null;
  return {
    borrowed: Number(formatEtherSafe(loan.principal)),
    collateral: Number(formatEtherSafe(loan.collateralLocked)),
    // Interest is per-block linear in the contract; the API does not return
    // it. Surface 0 here; the dashboard's repayment flow re-fetches and
    // the user can see the live accrued amount via the borrow tx input.
    interestAccrued: 0,
  };
}

/** POST /api/score/:address/sign — returns EIP-712 signature bundle. */
export async function signScore(address: string): Promise<SignedScoreBundle> {
  return request("POST", `/api/score/${address}/sign`);
}

/**
 * Tiny defensive wrapper around `Number(formatEther(wei))` for backend wei
 * strings. `formatEther` from viem takes a bigint; the backend serializes
 * bigints as decimal strings. We never want a `NaN` to leak into the UI.
 */
function formatEtherSafe(wei: string): number {
  try {
    return Number(formatEther(BigInt(wei)));
  } catch {
    return 0;
  }
}

// Re-export the typed backend response shapes for the queries hook.
export type { ScoreFactor, Tier };
