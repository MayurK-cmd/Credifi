/**
 * Type definitions for `GET /api/status`.
 *
 * Mirrors the backend `StatusPayload` in `backend/src/api/routes/status.ts`.
 * The public Status page (`frontend/src/routes/status.tsx`) renders all of
 * this; `/api/status` is the single source of truth.
 *
 * `lastUpdatedMinutesAgo` is always 0 from the backend — the page derives a
 * "Updated N minutes ago" string from `Date.now()` minus the query's
 * `dataUpdatedAt`. The backend field exists in case a v2 server-stamped
 * value lands later.
 */

export type ComponentStatus = "operational" | "degraded" | "outage";

export interface SystemComponent {
  name: string;
  status: ComponentStatus;
  detail: string;
  href?: string;
}

export interface Incident {
  date: string; // ISO date
  title: string;
  resolutionMinutes: number;
  summary: string;
}

export interface ProtocolStat {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}

export interface TvlPoint {
  day: string; // "Jun 09" style
  tvl: number; // whole HSK
}

export interface TierShare {
  tier: "A" | "B" | "C" | "D";
  pct: number; // 0..100
}

export interface NetworkInfo {
  chainName: string;
  chainId: number;
  nativeToken: string;
  oracleAddress: string;
  poolAddress: string;
  explorerBase: string;
}

export interface StatusPayload {
  overallStatus: ComponentStatus;
  lastUpdatedMinutesAgo: number;
  protocolStats: ProtocolStat[];
  tvlHistory: TvlPoint[];
  tierDistribution: TierShare[];
  systemComponents: SystemComponent[];
  incidents: Incident[];
  networkInfo: NetworkInfo;
}
