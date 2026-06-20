// Hardhat Ignition module: deploys CrediFiOracle first, then CrediFiPool
// with a dependency on the oracle. The treasury address and backend signer
// must be passed in via Ignition parameters.
//
// Usage:
//   npx hardhat ignition deploy ignition/modules/CrediFi.ts --network hskTestnet
//     --parameters '{"CrediFi":{"signer":"0x...","treasury":"0x..."}}'
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("CrediFi", (m) => {
  // Parameters (must be supplied at deploy time).
  const backendSigner = m.getParameter("signer");
  const treasury = m.getParameter("treasury");

  // 1. Deploy Oracle first.
  const oracle = m.contract("CrediFiOracle", [backendSigner]);

  // 2. Deploy Pool, depending on the Oracle address.
  const pool = m.contract("CrediFiPool", [oracle, treasury]);

  // 3. Wire the pool into the oracle so consumeNonce is gated to it.
  m.call(oracle, "setPool", [pool]);

  return { oracle, pool };
});
