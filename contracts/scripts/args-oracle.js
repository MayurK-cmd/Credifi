// Constructor arguments for CrediFiOracle (passed to `npx hardhat verify`).
// Mirrors the relayer address recorded in deployments/<network>.json.
//
// Usage:
//   npx hardhat verify --network <network> <CrediFiOracle-address> --constructor-args scripts/args-oracle.js
//
// `hardhat verify` requires a CommonJS module that exports the ctor args array.
const { readFileSync } = require("fs");
const { join } = require("path");

function loadRelayer() {
  const network = process.env.HARDHAT_NETWORK || "hskTestnet";
  const deploymentPath = join(__dirname, "..", "deployments", `${network}.json`);
  if (!require("fs").existsSync(deploymentPath)) {
    throw new Error(`No deployment record at ${deploymentPath}. Run deploy scripts first.`);
  }
  const deployment = JSON.parse(readFileSync(deploymentPath, "utf8"));
  return deployment.relayer;
}

module.exports = [loadRelayer()];