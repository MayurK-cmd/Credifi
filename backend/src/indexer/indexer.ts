/**
 * On-chain event indexer.
 *
 * Watches the deployed CrediFiPool + CrediFiOracle for events and writes
 * them to the local DB. The DB is a read cache / history log only — if
 * it ever disagrees with the chain, the chain wins. The indexer's job is
 * to make that disagreement transient.
 *
 * Events handled (with their contracts/contracts.sol source reference):
 *   CrediFiPool.Borrow      → upsert Loan(status=active, principal, collateral, tierAtBorrow)
 *   CrediFiPool.Repaid      → set Loan(status=repaid, repaidAt, repayTxHash)
 *   CrediFiPool.Liquidated  → set Loan(status=liquidated, repaidAt, repayTxHash)
 *   CrediFiOracle.ScoreSubmitted → set Score.txHash for the most recent unsigned row
 *
 * Resume semantics:
 *   On startup, read IndexerState.lastBlock (DB). If null, start from
 *   `currentHead - config.indexer.safeStartBlocks` to avoid rewinding
 *   through genesis. If present, resume from there. After each batch
 *   advance lastBlock to the highest processed.
 *
 * Reorg safety (v1):
 *   We assume the chain's safeStartBlocks window is enough that we never
 *   re-process a block that has been orphaned. If a reorg deeper than
 *   `safeStartBlocks` happens (extremely rare on HSK Chain for v1), the
 *   indexer may write a stale row, which the chain-event listener would
 *   not catch. Out of scope for v1; flag for v2.
 */
import { config, tierLetterFromNumber } from "../config.js";
import { getOracle, getPool, getProvider } from "../chain/provider.js";
import { prisma } from "../db.js";
import { recordTreasuryFeesInRange } from "./treasury-fee.js";

const INDEXER_STATE_ID = "singleton";

/**
 * Run one pass of the indexer: read the next batch of blocks since
 * `lastBlock`, write the resulting events to DB, advance `lastBlock`.
 *
 * Returns the number of blocks processed. Callers (the polling loop in
 * `runForever`, or the `indexer:catchup` CLI) decide what to do next.
 */
export async function indexOnce(): Promise<number> {
  const state = await prisma.indexerState.upsert({
    where: { id: INDEXER_STATE_ID },
    update: {},
    create: { id: INDEXER_STATE_ID, lastBlock: 0 },
  });

  const provider = getProvider();
  const head = await provider.getBlockNumber();
  const fromBlock = state.lastBlock > 0n
    ? BigInt(state.lastBlock) + 1n
    : BigInt(Math.max(0, Number(head) - config.indexer.safeStartBlocks));

  if (fromBlock > BigInt(head)) {
    return 0;
  }

  // Cap the batch to avoid timeouts / RPC limits.
  const toBlock =
    fromBlock + BigInt(config.indexer.blockBatchSize) - 1n > BigInt(head)
      ? BigInt(head)
      : fromBlock + BigInt(config.indexer.blockBatchSize) - 1n;

  await Promise.all([
    processBorrowEvents(fromBlock, toBlock),
    processRepaidEvents(fromBlock, toBlock),
    processLiquidatedEvents(fromBlock, toBlock),
    processScoreSubmittedEvents(fromBlock, toBlock),
    recordTreasuryFeesInRange(fromBlock, toBlock),
  ]);

  await prisma.indexerState.update({
    where: { id: INDEXER_STATE_ID },
    data: { lastBlock: Number(toBlock) },
  });

  return Number(toBlock - fromBlock + 1n);
}

/** Long-running poll loop. Stops when `stopSignal` is true. */
export async function runForever(stopSignal: { stopped: boolean }): Promise<void> {
  while (!stopSignal.stopped) {
    try {
      const processed = await indexOnce();
      if (processed === 0) {
        await sleep(config.indexer.pollIntervalMs);
      }
    } catch (err) {
      console.error("[indexer] error in poll cycle, sleeping before retry:", err);
      await sleep(config.indexer.pollIntervalMs);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// Event handlers
// ============================================================================

async function processBorrowEvents(fromBlock: bigint, toBlock: bigint): Promise<void> {
  const pool = getPool();
  const events = await pool.queryFilter(
    pool.filters.Borrow(),
    Number(fromBlock),
    Number(toBlock),
  );
  for (const evt of events) {
    if (!("args" in evt)) continue;
    const { borrower, amount, collateral, tier } = evt.args as unknown as {
      borrower: string;
      amount: bigint;
      collateral: bigint;
      tier: bigint;
    };
    const txHash = evt.transactionHash;
    const block = await evt.getBlock();
    const wallet = borrower.toLowerCase();
    const tierNum = Number(tier);
    const tierAtBorrow = tierLetterFromNumber(tierNum);

    await prisma.wallet.upsert({
      where: { address: wallet },
      update: {},
      create: { address: wallet, firstSeenAt: new Date(Number(block.timestamp) * 1000) },
    });

    await prisma.loan.create({
      data: {
        walletAddr: wallet,
        principal: amount.toString(),
        collateralLocked: collateral.toString(),
        tierAtBorrow,
        status: "active",
        borrowedAt: new Date(Number(block.timestamp) * 1000),
        borrowTxHash: txHash,
      },
    });
  }
}

async function processRepaidEvents(fromBlock: bigint, toBlock: bigint): Promise<void> {
  const pool = getPool();
  const events = await pool.queryFilter(
    pool.filters.Repaid(),
    Number(fromBlock),
    Number(toBlock),
  );
  for (const evt of events) {
    if (!("args" in evt)) continue;
    const { borrower } = evt.args as unknown as { borrower: string };
    const txHash = evt.transactionHash;
    const block = await evt.getBlock();
    const wallet = borrower.toLowerCase();

    // Find the most recent active loan for this wallet and mark it repaid.
    const active = await prisma.loan.findFirst({
      where: { walletAddr: wallet, status: "active" },
      orderBy: { borrowedAt: "desc" },
    });
    if (!active) {
      console.warn(
        `[indexer] Repaid event for ${wallet} but no active loan found; skipping.`,
      );
      continue;
    }

    await prisma.loan.update({
      where: { id: active.id },
      data: {
        status: "repaid",
        repaidAt: new Date(Number(block.timestamp) * 1000),
        repayTxHash: txHash,
      },
    });
  }
}

async function processLiquidatedEvents(fromBlock: bigint, toBlock: bigint): Promise<void> {
  const pool = getPool();
  const events = await pool.queryFilter(
    pool.filters.Liquidated(),
    Number(fromBlock),
    Number(toBlock),
  );
  for (const evt of events) {
    if (!("args" in evt)) continue;
    const { borrower } = evt.args as unknown as { borrower: string };
    const txHash = evt.transactionHash;
    const block = await evt.getBlock();
    const wallet = borrower.toLowerCase();

    const active = await prisma.loan.findFirst({
      where: { walletAddr: wallet, status: "active" },
      orderBy: { borrowedAt: "desc" },
    });
    if (!active) {
      console.warn(
        `[indexer] Liquidated event for ${wallet} but no active loan found; skipping.`,
      );
      continue;
    }

    await prisma.loan.update({
      where: { id: active.id },
      data: {
        status: "liquidated",
        repaidAt: new Date(Number(block.timestamp) * 1000),
        repayTxHash: txHash,
      },
    });
  }
}

async function processScoreSubmittedEvents(
  fromBlock: bigint,
  toBlock: bigint,
): Promise<void> {
  const oracle = getOracle();
  const events = await oracle.queryFilter(
    oracle.filters.ScoreSubmitted(),
    Number(fromBlock),
    Number(toBlock),
  );
  for (const evt of events) {
    if (!("args" in evt)) continue;
    const { wallet } = evt.args as unknown as { wallet: string };
    const txHash = evt.transactionHash;
    const lower = wallet.toLowerCase();

    // Find the most recent unsigned Score for this wallet and set txHash.
    // Multiple consecutive unsigned scores for the same wallet would be a
    // bug; the indexer logs if it finds more than one.
    const unsigned = await prisma.score.findMany({
      where: { walletAddr: lower, txHash: null },
      orderBy: { computedAt: "desc" },
    });
    if (unsigned.length === 0) {
      // The event was emitted by a third party / pre-existing backend;
      // we don't have a row to attach to. That's fine.
      continue;
    }
    if (unsigned.length > 1) {
      console.warn(
        `[indexer] ScoreSubmitted event for ${lower} matches ${unsigned.length} unsigned rows; attaching to newest.`,
      );
    }
    const target = unsigned[0];
    await prisma.score.update({
      where: { id: target.id },
      data: { txHash },
    });
  }
}
