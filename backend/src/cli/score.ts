/**
 * CLI: compute a score for a given address, no server required.
 *
 * Usage:
 *   npm run score:compute -- 0x1234...
 *   npm run score:compute -- 0x1234... --json
 *
 * Useful for debugging scoring rules against a real wallet on testnet
 * before the API is wired up. Requires HSK_RPC_URL but NOT DATABASE_URL
 * (we only read from the DB when the wallet has prior loans, which the
 * demo wallets may not).
 */
import { config, tierFromScore, tierNumberFromScore } from "../config.js";
import { getProvider } from "../chain/provider.js";
import { fetchWalletHistory } from "../score/history.js";
import { defaultRule } from "../score/score.js";

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const json = argv.includes("--json");
  const address = argv.find((a) => a.startsWith("0x"));
  if (!address) {
    console.error("usage: npm run score:compute -- <address> [--json]");
    process.exit(1);
  }

  console.log(`[cli] computing score for ${address} on chainId ${config.chainId}…`);
  const provider = getProvider();
  const net = await provider.getNetwork();
  console.log(`[cli] live chainId from RPC: ${net.chainId}`);

  const history = await fetchWalletHistory(address);
  const result = defaultRule.compute(history);

  if (json) {
    console.log(JSON.stringify({ history, result, tierNumber: tierNumberFromScore(result.score) }, null, 2));
  } else {
    console.log(`\nWallet:        ${history.address}`);
    console.log(`Age (days):    ${history.ageDays}`);
    console.log(`Tx count:      ${history.txCount}`);
    console.log(`HSK balance:   ${history.hskBalanceWei} wei`);
    console.log(`Repaid loans:  ${history.repaidLoanCount}`);
    console.log(`Liquidations:  ${history.liquidatedLoanCount}`);
    console.log(`\nFinal score:   ${result.score} / 1000`);
    console.log(`Tier:          ${result.tier} (${tierFromScore(result.score)})`);
    console.log(`\nFactors:`);
    for (const f of result.factors) {
      console.log(`  ${f.label.padEnd(28)} ${f.value}/100`);
    }
  }
}

main().catch((err) => {
  console.error("[cli] error:", err);
  process.exit(1);
});
