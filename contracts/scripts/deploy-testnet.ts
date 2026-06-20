/**
 * Deploy CrediFi to HSK Chain testnet.
 *
 * Required env vars (see .env.example):
 *   PRIVATE_KEY     — deployer / admin private key
 *   HSK_TESTNET_RPC — testnet RPC URL
 *   TREASURY_ADDRESS — protocol fee recipient
 *   RELAYER_ADDRESS  — backend signer that calls oracle.submitScore
 *
 * Writes the deployment record to deployments/hskTestnet.json.
 */
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { network } from "hardhat";
import CrediFiModule from "../ignition/modules/CrediFi";

const NETWORK_NAME = "hskTestnet";

async function main() {
  const { TREASURY_ADDRESS, RELAYER_ADDRESS } = process.env;
  if (!TREASURY_ADDRESS || !RELAYER_ADDRESS) {
    throw new Error("TREASURY_ADDRESS and RELAYER_ADDRESS must be set in .env");
  }
  if (network.name !== NETWORK_NAME) {
    throw new Error(`This script must be run with --network ${NETWORK_NAME}, got --network ${network.name}`);
  }

  const [deployer] = await (await import("hardhat")).ethers.getSigners();
  console.log(`Deployer: ${await deployer.getAddress()}`);
  console.log(`Balance: ${(await (await import("hardhat")).ethers.provider.getBalance(await deployer.getAddress())).toString()} wei`);

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
    chainId: (await (await import("hardhat")).ethers.provider.getNetwork()).chainId.toString(),
    timestamp: new Date().toISOString(),
    deployer: await deployer.getAddress(),
    contracts: {
      CrediFiOracle: oracleAddr,
      CrediFiPool: poolAddr,
    },
    treasury: TREASURY_ADDRESS,
    relayer: RELAYER_ADDRESS,
  };

  const outDir = join(__dirname, "..", "deployments");
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `${NETWORK_NAME}.json`);
  writeFileSync(outPath, JSON.stringify(deployment, null, 2));

  console.log("\n=== Deployment complete ===");
  console.log(`CrediFiOracle: ${oracleAddr}`);
  console.log(`CrediFiPool:   ${poolAddr}`);
  console.log(`Treasury:      ${TREASURY_ADDRESS}`);
  console.log(`Relayer:       ${RELAYER_ADDRESS}`);
  console.log(`\nDeployment record written to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
