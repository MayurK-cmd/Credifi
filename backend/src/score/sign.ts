/**
 * EIP-712 score signer — produces signatures the deployed CrediFiOracle
 * will accept at borrow time.
 *
 *   domain     = (name, version, chainId, verifyingContract=oracleAddress)
 *   typehash   = "Score(address wallet,uint16 score,uint8 tier,uint64 expiresAt,uint256 nonce)"
 *
 * CRITICAL: the type string here MUST equal the SCORE_TYPEHASH literal in
 * `contracts/CrediFiOracle.sol`. If either drifts, every signature silently
 * fails to recover (the recovered address won't match oracle.signer).
 *
 * The constants live in `config.ts` next to the rest of the backend's
 * tunables; both the contract and the test helper there point back at
 * the same on-chain value.
 *
 * Nonce strategy:
 *   - Strictly increasing per wallet. We read the latest nonce from the
 *     local Score table (which the indexer populates as events are seen)
 *     and increment by 1. If no prior Score exists, start at 1.
 *   - This means a relayer restart doesn't reuse a nonce, but it also
 *     means the relayer can't sign in parallel for the same wallet.
 *
 * Signer:
 *   - `RELAYER_PRIVATE_KEY` in env. Its derived address MUST match the
 *     `signer` address configured on the deployed CrediFiOracle.
 */
import { TypedDataEncoder, getAddress, getBytes, hexlify } from "ethers";
import { config, tierNumberFromScore } from "../config.js";
import { getRelayer } from "../chain/provider.js";
import { prisma } from "../db.js";
import type { ScoreResult, SignedScoreBundle } from "./types.js";

/**
 * Sign the given score result. The returned bundle is ready to be passed
 * to `oracle.submitScore(wallet, score, tier, expiresAt, nonce, v, r, s)`.
 *
 * Side effect: writes a new row to the `Score` table with the signature.
 * The indexer correlates this row with the `ScoreSubmitted` event by
 * picking the most-recent `txHash IS NULL` Score for the wallet when the
 * event arrives.
 */
export async function signScore(
  address: string,
  result: ScoreResult,
): Promise<SignedScoreBundle> {
  const checksummed = getAddress(address);
  const wallet = checksummed.toLowerCase();

  // Tier number (uint8). Must match what the contract's computeTier would
  // return for this score — `tierNumberFromScore` mirrors that exact logic.
  const tierNumber = tierNumberFromScore(result.score) as 1 | 2 | 3 | 4;

  // Nonce: strictly increasing per wallet. The DB doesn't carry the nonce
  // (it's an on-chain concern), so we keep an in-memory counter that resets
  // on process restart. For a single-instance backend that's fine; for
  // HA setups this would move to a `nextNonce` column on the Wallet row
  // or be coordinated via a Redis counter. v1 keeps it simple.
  //
  // We derive the starting nonce from the on-chain oracle state so a
  // backend restart doesn't re-sign at nonce=1.
  const { getOracle } = await import("../chain/provider.js");
  const current = await getOracle().currentScore(checksummed);
  const lastNonce = BigInt(current[3] ?? 0); // tuple field index 3 = nonce
  const nonce = lastNonce + 1n;

  // expiresAt is a uint64 unix-seconds timestamp.
  const expiresAt = BigInt(Math.floor(Date.now() / 1000) + config.scoreTtlSeconds);

  const domain = {
    name: config.eip712.domainName,
    version: config.eip712.domainVersion,
    chainId: config.chainId,
    verifyingContract: config.oracleAddress,
  };

  const types = {
    Score: [
      { name: "wallet", type: "address" },
      { name: "score", type: "uint16" },
      { name: "tier", type: "uint8" },
      { name: "expiresAt", type: "uint64" },
      { name: "nonce", type: "uint256" },
    ],
  };

  const value = {
    wallet: checksummed,
    score: result.score,
    tier: tierNumber,
    expiresAt: Number(expiresAt),
    nonce,
  };

  // ethers v6 expects uint16/uint8 as numbers, uint64 as number, uint256 as bigint.
  // We've coerced above; verify the digest matches what the contract will recompute.
  const digest = TypedDataEncoder.hash(domain, types, value);

  // Sign with the relayer's key.
  const relayer = getRelayer();
  const sig = await relayer.signTypedData(domain, types, value);

  // Split sig into v, r, s the contract expects.
  const sigBytes = getBytes(sig);
  if (sigBytes.length !== 65) {
    throw new Error(`Unexpected signature length: ${sigBytes.length}`);
  }
  const r = hexlify(sigBytes.slice(0, 32));
  const s = hexlify(sigBytes.slice(32, 64));
  const v = sigBytes[64];

  const bundle: SignedScoreBundle = {
    wallet,
    score: result.score,
    tier: tierNumber,
    expiresAt: Number(expiresAt),
    nonce,
    v,
    r,
    s,
    digest,
  };

  // Persist the Score row. factors is JSON; map our typed array to the
  // shape the frontend expects. `txHash` stays null until the indexer sees
  // the corresponding `ScoreSubmitted` event.
  await prisma.score.create({
    data: {
      walletAddr: wallet,
      score: result.score,
      tier: result.tier,
      factors: result.factors as unknown as object,
      computedAt: new Date(),
      signature: `${v}${r.slice(2)}${s.slice(2)}`,
      txHash: null,
    },
  });

  return bundle;
}
