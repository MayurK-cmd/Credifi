/**
 * CLI: run the indexer once, blocking, to current head, then exit.
 *
 * Usage:
 *   npm run indexer:catchup
 *
 * Use cases:
 *   - Brand-new database; need to backfill from chain.
 *   - After a long downtime; let one pass catch up, then start the server.
 *   - Manual re-process (delete IndexerState row, run this, restart server).
 */
import { indexOnce } from "../indexer/indexer.js";

async function main(): Promise<void> {
  console.log("[catchup] starting one-shot indexer pass…");
  const start = Date.now();
  let total = 0;
  // Loop until indexOnce reports 0 blocks processed (= up to head).
  while (true) {
    const processed = await indexOnce();
    if (processed === 0) break;
    total += processed;
    console.log(`[catchup] processed ${processed} blocks (total ${total})`);
  }
  console.log(`[catchup] caught up. ${total} blocks in ${Date.now() - start}ms.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[catchup] error:", err);
  process.exit(1);
});
