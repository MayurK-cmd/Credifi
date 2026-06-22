// =====================================================================
// MOCK STATUS DATA
//
// All values here are static mocks rendered on the public Status page.
// Each named export maps 1:1 to something that would later be wired up
// to a real healthcheck endpoint, an on-chain read, or backend analytics.
// Replace these in place — types stay the same — once real sources land.
// =====================================================================

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
  day: string; // "Jun 09"
  tvl: number; // USD
}

export interface TierShare {
  tier: "A" | "B" | "C" | "D";
  pct: number; // 0-100
}

export interface NetworkInfo {
  chainName: string;
  chainId: number;
  nativeToken: string;
  oracleAddress: string;
  poolAddress: string;
  explorerBase: string;
}

// ----- TOP-LEVEL STATUS --------------------------------------------------

export const overallStatus: ComponentStatus = "operational";
export const lastUpdatedMinutesAgo = 2;

// ----- PROTOCOL STATS ----------------------------------------------------

export const protocolStats: ProtocolStat[] = [
  { label: "Total Value Locked", value: "$1,284,920", sub: "+4.1% / 7d" },
  { label: "Active Loans", value: "412", sub: "across 318 wallets" },
  { label: "Total Borrowed", value: "$842,310", sub: "65.6% utilization" },
  { label: "Pool Utilization", value: "65.6%", sub: "healthy band", accent: true },
  { label: "Avg. Borrower Tier", value: "B", sub: "score ≈ 712" },
  { label: "Treasury Fees (lifetime)", value: "$18,402", sub: "since genesis" },
];

export const tvlHistory: TvlPoint[] = [
  { day: "Jun 09", tvl: 1_098_000 },
  { day: "Jun 10", tvl: 1_112_400 },
  { day: "Jun 11", tvl: 1_130_900 },
  { day: "Jun 12", tvl: 1_158_200 },
  { day: "Jun 13", tvl: 1_172_500 },
  { day: "Jun 14", tvl: 1_180_300 },
  { day: "Jun 15", tvl: 1_201_700 },
  { day: "Jun 16", tvl: 1_215_400 },
  { day: "Jun 17", tvl: 1_228_900 },
  { day: "Jun 18", tvl: 1_240_500 },
  { day: "Jun 19", tvl: 1_252_100 },
  { day: "Jun 20", tvl: 1_263_800 },
  { day: "Jun 21", tvl: 1_274_600 },
  { day: "Jun 22", tvl: 1_284_920 },
];

export const tierDistribution: TierShare[] = [
  { tier: "A", pct: 20 },
  { tier: "B", pct: 45 },
  { tier: "C", pct: 25 },
  { tier: "D", pct: 10 },
];

// ----- SYSTEM HEALTH -----------------------------------------------------

export const systemComponents: SystemComponent[] = [
  {
    name: "Smart Contracts",
    status: "operational",
    detail: "HSK Chain Testnet · 2 contracts verified",
    href: "#",
  },
  {
    name: "Credit Oracle",
    status: "operational",
    detail: "Last score submitted 47s ago",
  },
  {
    name: "Backend API",
    status: "operational",
    detail: "99.97% uptime · last 30 days",
  },
  {
    name: "Event Indexer",
    status: "operational",
    detail: "In sync · last block 4,812,937",
  },
  {
    name: "RPC Connection",
    status: "operational",
    detail: "p50 latency 84ms",
  },
];

export const incidents: Incident[] = [];

// ----- NETWORK INFO ------------------------------------------------------

export const networkInfo: NetworkInfo = {
  chainName: "HashKey Chain Testnet",
  chainId: 133,
  nativeToken: "HSK",
  oracleAddress: "0x4f3aE2bC9c7D2a1f0E8b5C3d2A1f0E8b5C3d2A1f",
  poolAddress: "0x9b21Cf83a4D2e1B0c8F7e6D5c4B3a291f0E8b5C3",
  explorerBase: "https://hashkeychain-testnet-explorer.alt.technology",
};
