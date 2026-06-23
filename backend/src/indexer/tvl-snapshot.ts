/**
 * TVL sampler — writes a row to `tvl_snapshots` whenever the backend
 * boots and at every `config.indexer.tvlSampleIntervalMs` thereafter.
 *
 * Used by the /api/status route to populate the 14-day TVL history chart.
 * We sample `pool.poolTotalAssets()` from the live contract rather than
 * tracking balance changes event-by-event: a single point-in-time read
 * is correct for "total value locked right now" and avoids drift from
 * share-mint/burn edge cases.
 *
 * Sampling failures are logged and swallowed — a missed sample is fine,
 * a crashed backend is not.
 */
import { prisma } from "../db.js";
import { getPool } from "../chain/provider.js";

/**
 * Read the current poolTotalAssets() from chain and persist it as a
 * snapshot row. Returns the new row, or `null` on failure.
 */
export async function sampleTvlOnce(): Promise<{ id: string; tvlWei: string } | null> {
  try {
    const pool = getPool();
    const totalAssetsWei = (await pool.poolTotalAssets()) as bigint;
    const tvlWei = totalAssetsWei.toString();
    const row = await prisma.tvlSnapshot.create({
      data: { tvlWei },
      select: { id: true, tvlWei: true },
    });
    return row;
  } catch (err) {
    console.error("[tvl-snapshot] sample failed:", err);
    return null;
  }
}
