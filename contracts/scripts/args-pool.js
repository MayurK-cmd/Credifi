// Constructor arguments for CrediFiPool (passed to `npx hardhat verify`).
// Mirrors the (oracle, treasury) pair recorded in deployments/<network>.json.
//
// Usage:
//   npx hardhat verify --network <network> <CrediFiPool-address> --constructor-args scripts/args-pool.js
//
// `hardhat verify` requires a CommonJS module that exports the ctor args array.
const { readFileSync } = require("fs");
const { join } = require("path");

function loadPoolCtor() {
  const network = process.env.HARDHAT_NETWORK || "hskTestnet";
  const deploymentPath = join(__dirname, "..", "deployments", `${network}.json`);
  if (!require("fs").existsSync(deploymentPath)) {
    throw new Error(`No deployment record at ${deploymentPath}. Run deploy scripts first.`);
  }
  const deployment = JSON.parse(readFileSync(deploymentPath, "utf8"));
  return [deployment.contracts.CrediFiOracle, deployment.treasury];
}

module.exports = loadPoolCtor();