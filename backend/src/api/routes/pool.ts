/**
 * /api/pool/* routes.
 *
 *   GET /api/pool/stats -> live pool stats read from the deployed contract.
 *
 * Numbers are returned as wei-strings so the frontend can format with
 * ethers.formatEther. APY and utilization are derived floats in [0, 1].
 */
import type { FastifyInstance } from "fastify";
import { getPool } from "../../chain/provider.js";

export async function poolRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/pool/stats", async () => {
    const pool = getPool();

    // Fetch the four read-only values in parallel.
    const [totalAssetsWei, availableWei, totalBorrowsWei, defaultRateBps, protocolFeeBps] =
      await Promise.all([
        pool.poolTotalAssets() as Promise<bigint>,
        pool.availableLiquidity() as Promise<bigint>,
        pool.totalBorrows() as Promise<bigint>,
        pool.DEFAULT_BORROW_RATE_BPS() as Promise<bigint>,
        pool.PROTOCOL_FEE_BPS() as Promise<bigint>,
      ]);

    // totalAssets is the gross pool size (lender-deposited + outstanding borrows).
    // availableLiquidity is what can still be borrowed out of the pool right now.
    // utilization = totalBorrows / (totalAssets - treasuryFees already withdrawn)
    // We approximate utilization as totalBorrows / (totalBorrows + availableLiquidity).
    const denom = totalBorrowsWei + availableWei;
    const utilization = denom === 0n ? 0 : Number(totalBorrowsWei) / Number(denom);

    // Supply APY (lender-side). The borrow APR is defaultRateBps / BPS. After
    // the 25% protocol fee cut, lenders earn `defaultRateBps * (1 - 25%) / BPS`
    // on the borrowed portion, weighted by utilization. v1 formula:
    //   supplyAPY = borrowAPR * (1 - protocolFeeBps/BPS) * utilization
    // This is an approximation; the real rate is per-block linear and the
    // precise number requires knowing how much interest has accrued since
    // the last repay. Good enough for v1's "live-ish" pool stat.
    const BPS = 10_000n;
    const lenderShareBps = defaultRateBps - (defaultRateBps * protocolFeeBps) / BPS;
    const supplyApy = (Number(lenderShareBps) / Number(BPS)) * utilization;

    return {
      // wei strings
      totalLiquidity: totalAssetsWei.toString(),
      availableLiquidity: availableWei.toString(),
      totalBorrows: totalBorrowsWei.toString(),
      // derived
      utilization,
      supplyApy,
      // meta
      borrowApr: Number(defaultRateBps) / Number(BPS),
      protocolFeeRate: Number(protocolFeeBps) / Number(BPS),
      fetchedAt: new Date().toISOString(),
    };
  });
}
