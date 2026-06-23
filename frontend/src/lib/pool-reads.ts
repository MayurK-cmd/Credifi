/**
 * Read-only on-chain helpers for the CrediFi pool.
 *
 * The user-facing action functions live in `wallet-actions.ts`; this module
 * is for read paths that don't write transactions. Currently:
 *   - `getLenderPosition(address)` — share count + HSK-equivalent value.
 *
 * Why a separate module: the lend page renders position data reactively,
 * and we don't want to mix `writeContract` ceremony with simple `readContract`
 * calls. Keeping reads separate also makes it easy to mock for tests.
 */
import type { Address } from "viem";
import { POOL_ABI } from "./abi";
import { getPublicClient } from "./chain";
import { config } from "./config";

export interface LenderPosition {
  /** Raw share units the lender has (1 share == 1e18 wei of "pool share"). */
  sharesWei: bigint;
  /**
   * HSK-equivalent value: `shares * poolTotalAssets / totalShares`.
   * Equals 0 if the pool is empty (no totalShares).
   */
  currentValueWei: bigint;
  /** Pool-wide total shares (denominator used for the ratio). */
  totalSharesWei: bigint;
  /** Pool-wide total assets (numerator used for the ratio, in wei). */
  totalAssetsWei: bigint;
}

/**
 * Read the lender's current position in the CrediFi pool.
 *
 * Returns zeroes (not null) if the lender has never deposited — the route
 * renders this as "0 shares / 0 HSK" rather than an empty state.
 *
 * Throws if any of the three on-chain reads fail; react-query surfaces
 * the error to the lend page so the user can retry.
 */
export async function getLenderPosition(
  address: Address,
): Promise<LenderPosition> {
  const publicClient = getPublicClient();
  const poolAddr = config.poolAddress;

  const [lenderStruct, totalAssetsWei, totalSharesWei] = await Promise.all([
    publicClient.readContract({
      address: poolAddr,
      abi: POOL_ABI,
      functionName: "lenders",
      args: [address],
    }) as Promise<{ shares: bigint }>,
    publicClient.readContract({
      address: poolAddr,
      abi: POOL_ABI,
      functionName: "poolTotalAssets",
    }) as Promise<bigint>,
    publicClient.readContract({
      address: poolAddr,
      abi: POOL_ABI,
      functionName: "totalShares",
    }) as Promise<bigint>,
  ]);

  const shares = lenderStruct.shares;
  const currentValueWei =
    totalSharesWei === 0n ? 0n : (shares * totalAssetsWei) / totalSharesWei;

  return {
    sharesWei: shares,
    currentValueWei,
    totalSharesWei,
    totalAssetsWei,
  };
}
