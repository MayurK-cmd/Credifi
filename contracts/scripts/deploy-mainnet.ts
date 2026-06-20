/**
 * Deploy CrediFi to HSK Chain mainnet.
 *
 * REQUIRED: run with --dry-run FIRST and review the output before
 * re-running without --dry-run. Mainnet deployments are irreversible.
 *
 * Usage:
 *   npm run deploy:mainnet:dry    # prints plan, no txs sent
 *   npm run deploy:mainnet        # actually deploys
 *
 * Required env vars: PRIVATE_KEY, HSK_MAINNET_RPC, TREASURY_ADDRESS, RELAYER_ADDRESS
 * Writes the deployment record to deployments/hskMainnet.json.
 */
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { network } from "hardhat";
import CrediFiModule from "../ignition/modules/CrediFi";

const NETWORK_NAME = "hskMainnet";

function parseDryRunFlag(): boolean {
  // Hardhat forwards extra -- args to the script; index 2 is the first custom arg.
  return process.argv.includes("--dry-run") || process.argv.includes("--dryRun");
}

async function main() {
  const { TREASURY_ADDRESS, RELAYER_ADDRESS } = process.env;
  if (!TREASURY_ADDRESS || !RELAYER_ADDRESS) {
    throw new Error("TREASURY_ADDRESS and RELAYER_ADDRESS must be set in .env");
  }
  if (network.name !== NETWORK_NAME) {
    throw new Error(`This script must be run with --network ${NETWORK_NAME}, got --network ${network.name}`);
  }

  const dryRun = parseDryRunFlag();
  const ethers = await import("hardhat").then((m) => m.ethers);
  const [deployer] = await ethers.getSigners();
  const deployerAddr = await deployer.getAddress();
  const balance = await ethers.provider.getBalance(deployerAddr);

  console.log(`\n=== CrediFi Mainnet Deployment ===`);
  console.log(`Mode:    ${dryRun ? "DRY RUN (no transactions will be sent)" : "LIVE"}`);
  console.log(`Network: ${network.name}`);
  console.log(`Deployer: ${deployerAddr}`);
  console.log(`Balance:  ${ethers.formatEther(balance)} HSK`);
  console.log(`Treasury: ${TREASURY_ADDRESS}`);
  console.log(`Relayer:  ${RELAYER_ADDRESS}`);

  if (dryRun) {
    // For dry run we don't actually run Ignition (which would tx). Instead
    // we report the planned addresses using getContractAddress prediction.
    const OracleFactory = await ethers.getContractFactory("CrediFiOracle");
    const PoolFactory = await ethers.getContractFactory("CrediFiPool");
    // Predicted addresses from deployer + nonce 0 and 1.
    const oraclePredicted = await ethers.getCreateAddress({ from: deployerAddr, nonce: balance > 0n ? await ethers.provider.getTransactionCount(deployerAddr) : 0 });
    console.log(`\nPlanned CrediFiOracle: ${oraclePredicted} (ctor args: [${RELAYER_ADDRESS}])`);
    console.log(`Planned CrediFiPool:   <depends on Oracle deploy> (ctor args: [oracle, ${TREASURY_ADDRESS}])`);
    console.log(`\n*** DRY RUN complete. Review addresses and run without --dry-run to deploy. ***`);

    const outDir = join(__dirname, "..", "deployments");
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    const outPath = join(outDir, `${NETWORK_NAME}.dryrun.json`);
    writeFileSync(outPath, JSON.stringify({
      network: NETWORK_NAME,
      timestamp: new Date().toISOString(),
      dryRun: true,
      deployer: deployerAddr,
      treasury: TREASURY_ADDRESS,
      relayer: RELAYER_ADDRESS,
    }, null, 2));
    return;
  }

  // LIVE deployment via Ignition.
  const { ignition } = await import("hardhat");
  const result = await ignition.deploy(CrediFiModule, {
    parameters: {
      CrediFi: {
        signer: RELAYER_ADDRESS,
        treasury: TREASURY_ADDRESS,
      },
    },
  });

  const oracle = result.oracle;
  const pool = result.pool;
  const oracleAddr = await oracle.getAddress();
  const poolAddr = await pool.getAddress();

  const deployment = {
    network: NETWORK_NAME,
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    timestamp: new Date().toISOString(),
    deployer: deployerAddr,
    contracts: { CrediFiOracle: oracleAddr, CrediFiPool: poolAddr },
    treasury: TREASURY_ADDRESS,
    relayer: RELAYER_ADDRESS,
  };

  const outDir = join(__dirname, "..", "deployments");
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `${NETWORK_NAME}.json`);
  writeFileSync(outPath, JSON.stringify(deployment, null, 2));

  console.log(`\n=== LIVE Deployment complete ===`);
  console.log(`CrediFiOracle: ${oracleAddr}`);
  console.log(`CrediFiPool:   ${poolAddr}`);
  console.log(`\nDeployment record written to ${outPath}`);
  console.log(`\n*** NEXT STEPS ***`);
  console.log(`1. Verify contracts on HSK explorer: npm run verify -- --network ${NETWORK_NAME}`);
  console.log(`2. Update backend / frontend config with these addresses.`);
  console.log(`3. Fund the relayer with a small HSK balance for score submissions.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
