/**
 * Treasury-fee indexer — writes one `TreasuryFee` row per `Repaid` event.
 *
 * Source: `CrediFiPool.Repaid(address borrower, uint256 principal,
 * uint256 interest, uint256 treasuryFee)`. We persist the `treasuryFee`
 * field only (the rest is captured by the existing loan-status update).
 *
 * The /api/status route sums these rows to display the lifetime
 * "Treasury Fees" protocol stat. Idempotency: each row carries the
 * event's txHash, so re-running over the same block range is a no-op
 * thanks to the unique-ish constraint in the row creation.
 */
import { prisma } from "../db.js";
import { getPool } from "../chain/provider.js";

/**
 * Query `Repaid` events in `[fromBlock, toBlock]` and write one
 * `TreasuryFee` row per event. Errors are logged and swallowed per
 * event so a single malformed event doesn't block the rest of the batch.
 */
export async function recordTreasuryFeesInRange(fromBlock: bigint, toBlock: bigint): Promise<number> {
  const pool = getPool();
  const events = await pool.queryFilter(
    pool.filters.Repaid(),
    Number(fromBlock),
    Number(toBlock),
  );

  let written = 0;
  for (const evt of events) {
    if (!("args" in evt)) continue;
    const { borrower, treasuryFee } = evt.args as unknown as {
      borrower: string;
      treasuryFee: bigint;
    };
    const txHash = evt.transactionHash;
    const block = await evt.getBlock();
    try {
      await prisma.treasuryFee.create({
        data: {
          borrower: borrower.toLowerCase(),
          amountWei: treasuryFee.toString(),
          txHash,
          collectedAt: new Date(Number(block.timestamp) * 1000),
        },
      });
      written += 1;
    } catch (err) {
      // Likely a unique-txHash collision from a previous run — that's
      // expected on re-orgs and catch-up replays. Anything else gets
      // logged so the operator can investigate.
      const code = (err as { code?: string } | null)?.code;
      if (code !== "P2002") {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[treasury-fee] write failed for tx", txHash, message);
      }
    }
  }
  return written;
}
