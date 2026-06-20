import { Signer, TypedDataDomain, TypedDataField } from "ethers";
import { EIP712_DOMAIN_NAME, EIP712_DOMAIN_VERSION, SCORE_TYPE_STRING } from "./constants";

export interface ScoreFields {
  wallet: string;
  score: number;
  tier: number;
  expiresAt: number;
  nonce: bigint;
}

export interface SignedScore {
  v: number;
  r: string;
  s: string;
  digest: string;
}

/**
 * Sign a CrediFi score payload using EIP-712 typed data.
 *
 * CRITICAL: the type string here MUST match the SCORE_TYPEHASH constant in
 * CrediFiOracle.sol. If either drifts, every EIP-712 signature test silently
 * fails (the digest will not match what the contract recomputes). The string
 * is centralized in ./constants.ts to make this dependency explicit.
 */
export async function signScore(
  signer: Signer,
  oracleAddress: string,
  chainId: bigint,
  fields: ScoreFields,
): Promise<SignedScore> {
  const domain: TypedDataDomain = {
    name: EIP712_DOMAIN_NAME,
    version: EIP712_DOMAIN_VERSION,
    chainId,
    verifyingContract: oracleAddress,
  };

  const types: Record<string, TypedDataField[]> = {
    Score: [
      { name: "wallet", type: "address" },
      { name: "score", type: "uint16" },
      { name: "tier", type: "uint8" },
      { name: "expiresAt", type: "uint64" },
      { name: "nonce", type: "uint256" },
    ],
  };

  // ethers v6 expects uint16/uint8 to be passed as numbers; uint64 must be a
  // bigint or number; uint256 must be a bigint.
  const value = {
    wallet: fields.wallet,
    score: fields.score,
    tier: fields.tier,
    expiresAt: fields.expiresAt,
    nonce: fields.nonce,
  };

  const signature = await signer.signTypedData(domain, types, value);
  const digest = ethers_typedDataHash(domain, types, value);

  const r = "0x" + signature.slice(2, 66);
  const s = "0x" + signature.slice(66, 130);
  const v = parseInt(signature.slice(130, 132), 16);

  return { v, r, s, digest };
}

/**
 * Compute the EIP-712 digest without signing. Used by tests that want to
 * inspect the digest value.
 */
function ethers_typedDataHash(
  domain: TypedDataDomain,
  types: Record<string, TypedDataField[]>,
  value: Record<string, unknown>,
): string {
  // ethers v6's verifyTypedData recomputes this digest; we import lazily so
  // the helper is easier to mock in isolation.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { verifyTypedData, TypedDataEncoder } = require("ethers");
  void verifyTypedData;
  return TypedDataEncoder.hash(domain, types, value);
}