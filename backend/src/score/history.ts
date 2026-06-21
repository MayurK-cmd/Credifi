/**
 * Pull the raw inputs the scorer needs for a given wallet.
 *
 * Sources:
 *  - RPC (ethers v6):
 *      - tx count -> provider.getTransactionCount
 *      - balance  -> provider.getBalance
 *      - first-tx age -> provider.getHistory (oldest block timestamp delta from now)
 *  - Local DB (this backend's own loans table):
 *      - prior repaid loans on CrediFi
 *      - prior liquidations on CrediFi
 *
 * v1 does not scrape other lending protocols on HSK Chain. PLAN.md §5B
 * marks multi-protocol history as v2.
 *
 * All numeric outputs are clamped to documented ranges so a wallet with
 * absurd history cannot push the score out of [0, 1000].
 */
import { getAddress } from "ethers";
import { getProvider } from "../chain/provider.js";
import { prisma } from "../db.js";
import type { WalletHistory } from "./types.js";

/** Cap wallet age so the walletAge factor saturates before absurdity. */
const MAX_AGE_DAYS = 365 * 2; // 2 years
const MAX_TX_COUNT = 10_000;
const MAX_REPAID_LOANS = 50;
const MAX_LIQUIDATIONS = 10;

/**
 * Fetch the wallet's raw history. Throws if `address` is not a valid
 * 0x-prefixed 40-hex-char string (ethers will validate via getAddress).
 */
export async function fetchWalletHistory(address: string): Promise<WalletHistory> {
  const checksummed = requireValidAddress(address);
  const lower = checksummed.toLowerCase();

  const provider = getProvider();

  // 1. Native HSK balance + tx count + age — these are the cheap RPC calls.
  const [balanceWei, txCount] = await Promise.all([
    provider.getBalance(checksummed),
    provider.getTransactionCount(checksummed),
  ]);

  // 2. Wallet age via getHistory. This RPC method is supported by most
  //    EVM-compatible nodes; if the HSK RPC doesn't support it we catch
  //    the error and default ageDays to 0 (the new-wallet path).
  let ageDays = 0;
  try {
    const history = await (provider as unknown as {
      getHistory: (a: string) => Promise<Array<{ blockNumber: number; blockTimestamp?: number }>>;
    }).getHistory?.(checksummed);
    if (Array.isArray(history) && history.length > 0) {
      const oldest = history[0];
      // If the RPC returns the timestamp inline, use it; otherwise fetch the block.
      let firstTimestamp: number;
      if (typeof oldest.blockTimestamp === "number") {
        firstTimestamp = oldest.blockTimestamp;
      } else {
        const block = await provider.getBlock(oldest.blockNumber);
        firstTimestamp = block?.timestamp ?? Math.floor(Date.now() / 1000);
      }
      const nowSec = Math.floor(Date.now() / 1000);
      ageDays = Math.max(0, Math.floor((nowSec - firstTimestamp) / 86_400));
    }
  } catch {
    // RPC doesn't support getHistory; treat as new wallet.
    ageDays = 0;
  }

  // 3. Loan history — straight from the local DB.
  const [repaidCount, liquidatedCount] = await Promise.all([
    prisma.loan.count({
      where: { walletAddr: lower, status: "repaid" },
    }),
    prisma.loan.count({
      where: { walletAddr: lower, status: "liquidated" },
    }),
  ]);

  return {
    address: lower,
    ageDays: Math.min(ageDays, MAX_AGE_DAYS),
    txCount: Math.min(txCount, MAX_TX_COUNT),
    hskBalanceWei: balanceWei.toString(),
    repaidLoanCount: Math.min(repaidCount, MAX_REPAID_LOANS),
    liquidatedLoanCount: Math.min(liquidatedCount, MAX_LIQUIDATIONS),
  };
}

/** ethers v6 getAddress normalizes + checksum-checks the input. */
function requireValidAddress(address: string): string {
  return getAddress(address);
}
