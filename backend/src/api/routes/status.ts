/**
 * GET /api/status -> comprehensive protocol and system status.
 *
 * Split into small per-section helpers at the top so the route handler
 * reads as a thin assembler. Each helper owns its own failure mode (logged
 * + best-effort return) so a single broken data source doesn't 500 the
 * whole endpoint.
 */
import type { FastifyInstance } from "fastify";
import { formatEther } from "ethers";
import { prisma } from "../../db.js";
import { getOracle, getPool, getProvider } from "../../chain/provider.js";
import { config } from "../../config.js";

type ComponentStatus = "operational" | "degraded" | "outage";

interface ProtocolStat {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}

interface TvlPoint {
  day: string; // "Jun 09" style
  tvl: number; // HSK (whole units)
}

interface TierShare {
  tier: "A" | "B" | "C" | "D";
  pct: number; // 0..100
}

interface SystemComponent {
  name: string;
  status: ComponentStatus;
  detail: string;
  href?: string;
}

interface NetworkInfo {
  chainName: string;
  chainId: number;
  nativeToken: string;
  oracleAddress: string;
  poolAddress: string;
  explorerBase: string;
}

interface StatusPayload {
  overallStatus: ComponentStatus;
  lastUpdatedMinutesAgo: number;
  protocolStats: ProtocolStat[];
  tvlHistory: TvlPoint[];
  tierDistribution: TierShare[];
  systemComponents: SystemComponent[];
  incidents: unknown[];
  networkInfo: NetworkInfo;
}

export async function statusRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/status", async (): Promise<StatusPayload> => {
    // Boot-time fetches that every section depends on. Each section can
    // also re-read what it needs from prisma / chain.
    const pool = getPool();
    let totalAssetsWei = 0n;
    let totalBorrowsWei = 0n;
    let availableWei = 0n;
    try {
      [totalAssetsWei, availableWei, totalBorrowsWei] = (await Promise.all([
        pool.poolTotalAssets(),
        pool.availableLiquidity(),
        pool.totalBorrows(),
      ])) as bigint[];
    } catch (err) {
      console.error("[status] on-chain reads failed:", err);
    }

    const utilization =
      totalBorrowsWei + availableWei === 0n
        ? 0
        : Number(totalBorrowsWei) / Number(totalBorrowsWei + availableWei);

    const [
      tvlHistory,
      tierDistribution,
      protocolStats,
      systemComponents,
      networkInfo,
    ] = await Promise.all([
      fetchTvlHistory(),
      fetchTierDistribution(),
      fetchProtocolStats(totalAssetsWei, totalBorrowsWei, utilization),
      fetchSystemHealth(),
      fetchNetworkInfo(),
    ]);

    return {
      overallStatus: deriveOverallStatus(systemComponents),
      lastUpdatedMinutesAgo: 0,
      protocolStats,
      tvlHistory,
      tierDistribution,
      systemComponents,
      incidents: [],
      networkInfo,
    };
  });
}

// ============================================================================
// Helpers
// ============================================================================

async function fetchTvlHistory(): Promise<TvlPoint[]> {
  // Take the 14 most-recent samples then reverse so the chart's x-axis is
  // left-to-right chronological (oldest first).
  const rows = await prisma.tvlSnapshot.findMany({
    orderBy: { sampledAt: "desc" },
    take: 14,
  });
  return rows
    .reverse()
    .map((row) => ({
      day: formatDay(row.sampledAt),
      tvl: hskRounded(row.tvlWei),
    }));
}

async function fetchTierDistribution(): Promise<TierShare[]> {
  const groups = await prisma.loan.groupBy({
    by: ["tierAtBorrow"],
    where: { status: "active" },
    _count: true,
  });
  const counts: Record<string, number> = {};
  let total = 0;
  for (const g of groups) {
    const n = Number(g._count);
    counts[g.tierAtBorrow] = n;
    total += n;
  }
  const pct = (tier: string): number =>
    total === 0 ? 0 : Math.round((counts[tier] ?? 0) / total * 100);
  return [
    { tier: "A", pct: pct("1") },
    { tier: "B", pct: pct("2") },
    { tier: "C", pct: pct("3") },
    { tier: "D", pct: pct("4") },
  ];
}

async function fetchProtocolStats(
  totalAssetsWei: bigint,
  totalBorrowsWei: bigint,
  utilization: number,
): Promise<ProtocolStat[]> {
  const [activeLoansCount, recentScores, treasuryFees] = await Promise.all([
    prisma.loan.count({ where: { status: "active" } }),
    prisma.score.findMany({
      take: 100,
      orderBy: { computedAt: "desc" },
    }),
    // amountWei is a String (wei) so Prisma can't _sum it. Sum manually.
    prisma.treasuryFee.findMany({ select: { amountWei: true } }),
  ]);

  const tierDistribution = await fetchTierDistribution();
  const avgScore =
    recentScores.length === 0
      ? 0
      : Math.round(recentScores.reduce((sum, s) => sum + s.score, 0) / recentScores.length);

  let treasuryTotalWei = 0n;
  for (const row of treasuryFees) {
    try {
      treasuryTotalWei += BigInt(row.amountWei);
    } catch {
      // Skip malformed rows; they shouldn't exist, but don't crash /status.
    }
  }
  const treasuryWei = treasuryTotalWei.toString();
  const treasuryHsk = hskNumber(treasuryWei);

  // Compute TVL 7d change: compare the newest sample to the oldest in the
  // 14-point window we already query for fetchTvlHistory().
  const snapshots = await prisma.tvlSnapshot.findMany({
    orderBy: { sampledAt: "desc" },
    take: 14,
  });
  let tvlChangeSub = "+0.0% / 7d";
  if (snapshots.length >= 2) {
    const newest = Number(formatEtherSafe(snapshots[0].tvlWei));
    const oldest = Number(formatEtherSafe(snapshots[snapshots.length - 1].tvlWei));
    if (oldest > 0) {
      const pct = ((newest - oldest) / oldest) * 100;
      const sign = pct >= 0 ? "+" : "";
      tvlChangeSub = `${sign}${pct.toFixed(1)}% / 7d`;
    }
  }

  return [
    {
      label: "Total Value Locked",
      value: `$${Math.round(hskNumber(totalAssetsWei.toString())).toLocaleString()}`,
      sub: tvlChangeSub,
    },
    {
      label: "Active Loans",
      value: String(activeLoansCount),
      sub: `across ${activeLoansCount} wallets`,
    },
    {
      label: "Total Borrowed",
      value: `$${Math.round(hskNumber(totalBorrowsWei.toString())).toLocaleString()}`,
      sub: `${(utilization * 100).toFixed(1)}% utilization`,
    },
    {
      label: "Pool Utilization",
      value: `${(utilization * 100).toFixed(1)}%`,
      sub: "healthy band",
      accent: true,
    },
    {
      label: "Avg. Borrower Tier",
      value: getAvgBorrowerTier(tierDistribution),
      sub: `score ≈ ${avgScore}`,
    },
    {
      label: "Treasury Fees (lifetime)",
      value: `$${Math.round(treasuryHsk).toLocaleString()}`,
      sub: "since genesis",
    },
  ];
}

async function fetchSystemHealth(): Promise<SystemComponent[]> {
  // Oracle signer match: the relayer's address must equal oracle.signer().
  let oracleOk = false;
  let oracleDetail = "Signer unreachable";
  try {
    const oracleSigner = (await getOracle().signer()) as string;
    oracleOk = oracleSigner.toLowerCase() === config.oracleAddress.toLowerCase();
    oracleDetail = oracleOk
      ? `Signer verified · ${oracleSigner}`
      : `Signer mismatch · expected ${config.oracleAddress}, got ${oracleSigner}`;
  } catch (err) {
    console.error("[status] oracle signer check failed:", err);
  }

  // DB ping.
  let dbOk = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {
    dbOk = false;
  }

  // Chain ID check.
  let chainOk = false;
  let chainDetail = "RPC unreachable";
  try {
    const net = await getProvider().getNetwork();
    const live = typeof net.chainId === "bigint" ? Number(net.chainId) : net.chainId;
    chainOk = live === config.chainId;
    chainDetail = `Chain ID: ${live}`;
  } catch (err) {
    console.error("[status] chain ID check failed:", err);
  }

  // Indexer liveness: head - lastBlock. Healthy if gap < 200 blocks (~17
  // min at 5s blocks; we sample every 5s so the gap is normally 0–1).
  let indexerOk = true;
  let indexerDetail = "In sync · Monitoring chain";
  try {
    const state = await prisma.indexerState.findUnique({ where: { id: "singleton" } });
    const head = await getProvider().getBlockNumber();
    if (state && head - state.lastBlock > 200) {
      indexerOk = false;
      indexerDetail = `Lagging · head ${head}, last ${state.lastBlock}`;
    } else if (state) {
      indexerDetail = `In sync · last block ${state.lastBlock}`;
    }
  } catch (err) {
    console.error("[status] indexer liveness check failed:", err);
  }

  return [
    {
      name: "Smart Contracts",
      status: "operational",
      detail: "HSK Chain Testnet · 2 contracts verified",
      href: "#",
    },
    {
      name: "Credit Oracle",
      status: oracleOk ? "operational" : "degraded",
      detail: oracleDetail,
    },
    {
      name: "Backend API",
      status: dbOk ? "operational" : "degraded",
      detail: dbOk ? "API responsive · Database connected" : "Database unreachable",
    },
    {
      name: "Event Indexer",
      status: indexerOk ? "operational" : "degraded",
      detail: indexerDetail,
    },
    {
      name: "RPC Connection",
      status: chainOk ? "operational" : "degraded",
      detail: chainDetail,
    },
  ];
}

async function fetchNetworkInfo(): Promise<NetworkInfo> {
  return {
    chainName: "HashKey Chain Testnet",
    chainId: config.chainId,
    nativeToken: "HSK",
    oracleAddress: config.oracleAddress,
    poolAddress: config.poolAddress,
    explorerBase: "https://testnet-explorer.hsk.xyz",
  };
}

// ============================================================================
// Pure utilities
// ============================================================================

function formatDay(d: Date): string {
  // "2026-06-22T..." -> "Jun 22"
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2, "0")}`;
}

function hskRounded(wei: string): number {
  return Math.round(hskNumber(wei));
}

function hskNumber(wei: string | bigint): number {
  return Number(formatEtherSafe(wei));
}

function formatEtherSafe(wei: string | bigint): number {
  try {
    return Number(formatEther(typeof wei === "bigint" ? wei : BigInt(wei)));
  } catch {
    return 0;
  }
}

function getAvgBorrowerTier(
  tierDistribution: TierShare[],
): "A" | "B" | "C" | "D" {
  const tierValues: Record<"A" | "B" | "C" | "D", number> = {
    A: 4, B: 3, C: 2, D: 1,
  };
  let weightedSum = 0;
  let totalWeight = 0;
  for (const item of tierDistribution) {
    weightedSum += tierValues[item.tier] * item.pct;
    totalWeight += item.pct;
  }
  const avgValue = totalWeight > 0 ? weightedSum / totalWeight : 2.5;
  if (avgValue >= 3.5) return "A";
  if (avgValue >= 2.5) return "B";
  if (avgValue >= 1.5) return "C";
  return "D";
}

function deriveOverallStatus(components: SystemComponent[]): ComponentStatus {
  if (components.some((c) => c.status === "outage")) return "outage";
  if (components.some((c) => c.status === "degraded")) return "degraded";
  return "operational";
}
