/**
 * Verify deployed CrediFi contracts on the HSK Chain explorer.
 *
 * Reads deployments/<network>.json and runs hardhat-verify for each contract.
 * The HSK Chain explorer API endpoint is currently a placeholder (see
 * hardhat.config.ts). Update HSK_EXPLORER_API_KEY and the customChains URLs
 * after confirming the actual explorer endpoint with the hashfans.io docs.
 *
 * Usage: npx hardhat run scripts/verify-contracts.ts --network hskTestnet
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { network } from "hardhat";

async function main() {
  const deploymentsFile = join(__dirname, "..", "deployments", `${network.name}.json`);
  if (!existsSync(deploymentsFile)) {
    throw new Error(`No deployment record at ${deploymentsFile}. Deploy first.`);
  }
  const deployment = JSON.parse(readFileSync(deploymentsFile, "utf8"));
  console.log(`Verifying contracts on ${network.name}...`);
  console.log(`Oracle: ${deployment.contracts.CrediFiOracle}`);
  console.log(`Pool:   ${deployment.contracts.CrediFiPool}`);

  // We can't actually call hardhat-verify programmatically here because it
  // expects to be invoked via the CLI subtask. So this script just prints
  // the commands the operator needs to run. Update HSK_EXPLORER_API_KEY
  // before running.
  const oracleCtor = deployment.relayer;
  const poolCtor = [deployment.contracts.CrediFiOracle, deployment.treasury];
  console.log(`\nRun the following to verify:`);
  console.log(`  npx hardhat verify --network ${network.name} ${deployment.contracts.CrediFiOracle} --constructor-args scripts/args-oracle.js`);
  console.log(`  npx hardhat verify --network ${network.name} ${deployment.contracts.CrediFiPool} --constructor-args scripts/args-pool.js`);
  console.log(`\n(Where args-oracle.js exports [${oracleCtor}] and args-pool.js exports [${poolCtor.join(", ")}])`);
  console.log(`\n*** Update HSK_EXPLORER_API_KEY in .env before running the verify commands. ***`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
