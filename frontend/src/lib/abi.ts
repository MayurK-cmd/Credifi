/**
 * Hand-written viem `Abi` fragments for the two contracts the frontend talks to.
 *
 * Why hand-written (vs `parseAbi` template strings or pulling typechain from
 * `contracts/`): the surface is ~25 functions/events total, the frontend
 * already imports nothing from `backend/` or `contracts/` (those are separate
 * workspaces), and inline fragments keep every contract signature visible in
 * one place for diffing against `contracts/contracts/*.sol`.
 *
 * CRITICAL: each fragment MUST match the Solidity source. If a contract
 * function signature changes, update both files together — viem's
 * encodeFunctionData will silently produce garbage selectors otherwise.
 */
import type { Abi } from "viem";

// ============================================================================
// CrediFiOracle — see contracts/contracts/CrediFiOracle.sol
// ============================================================================

/**
 * Mirrors:
 *   - signer() view
 *   - submitScore(address wallet, uint16 score, uint8 tier, uint64 expiresAt, uint256 nonce, uint8 v, bytes32 r, bytes32 s)
 *   - currentScore(address) returns (uint16, uint8, uint64, uint256)
 *   - computeTier(uint16) pure returns (uint8)
 *   - eip712Domain() returns EIP712Domain tuple
 *   - scores(address) returns Score struct (we use currentScore instead)
 *   - pool() view returns address
 *
 * Events:
 *   - ScoreSubmitted(address indexed wallet, uint16 score, uint8 tier, uint64 expiresAt, uint256 nonce)
 */
export const ORACLE_ABI: Abi = [
  {
    type: "function",
    name: "signer",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "pool",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "submitScore",
    stateMutability: "nonpayable",
    inputs: [
      { name: "wallet", type: "address" },
      { name: "score", type: "uint16" },
      { name: "tier", type: "uint8" },
      { name: "expiresAt", type: "uint64" },
      { name: "nonce", type: "uint256" },
      { name: "v", type: "uint8" },
      { name: "r", type: "bytes32" },
      { name: "s", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "currentScore",
    stateMutability: "view",
    inputs: [{ name: "wallet", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "score", type: "uint16" },
          { name: "tier", type: "uint8" },
          { name: "expiresAt", type: "uint64" },
          { name: "nonce", type: "uint256" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "computeTier",
    stateMutability: "pure",
    inputs: [{ name: "score", type: "uint16" }],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "event",
    name: "ScoreSubmitted",
    inputs: [
      { name: "wallet", type: "address", indexed: true },
      { name: "score", type: "uint16", indexed: false },
      { name: "tier", type: "uint8", indexed: false },
      { name: "expiresAt", type: "uint64", indexed: false },
      { name: "nonce", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
] as const;

// ============================================================================
// CrediFiPool — see contracts/contracts/CrediFiPool.sol
// ============================================================================

/**
 * Mirrors the borrow/repay/lender flows. We include the BPS constants so the
 * frontend can format tier ratios locally (matches `TIER_RATIOS` in
 * `mockData.ts`) without a second round-trip to the backend.
 */
export const POOL_ABI: Abi = [
  // ---- borrower ----
  {
    type: "function",
    name: "borrow",
    stateMutability: "payable",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "score", type: "uint16" },
      { name: "tier", type: "uint8" },
      { name: "expiresAt", type: "uint64" },
      { name: "nonce", type: "uint256" },
      { name: "v", type: "uint8" },
      { name: "r", type: "bytes32" },
      { name: "s", type: "bytes32" },
    ],
    outputs: [{ name: "collateralLocked", type: "uint256" }],
  },
  {
    type: "function",
    name: "repay",
    stateMutability: "payable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "accruedDebt",
    stateMutability: "view",
    inputs: [{ name: "borrower", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "healthFactor",
    stateMutability: "view",
    inputs: [{ name: "borrower", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  // ---- lender ----
  {
    type: "function",
    name: "deposit",
    stateMutability: "payable",
    inputs: [],
    outputs: [{ name: "shares", type: "uint256" }],
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [{ name: "shares", type: "uint256" }],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
  {
    type: "function",
    name: "lenders",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [{ name: "shares", type: "uint256" }],
      },
    ],
  },
  // ---- pool stats ----
  {
    type: "function",
    name: "availableLiquidity",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "poolTotalAssets",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "totalBorrows",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "totalShares",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "DEFAULT_BORROW_RATE_BPS",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "PROTOCOL_FEE_BPS",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "TIER_A_RATIO_BPS",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "TIER_B_RATIO_BPS",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "TIER_C_RATIO_BPS",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "TIER_D_RATIO_BPS",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  // ---- events ----
  {
    type: "event",
    name: "Borrow",
    inputs: [
      { name: "borrower", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "collateral", type: "uint256", indexed: false },
      { name: "score", type: "uint16", indexed: false },
      { name: "tier", type: "uint8", indexed: false },
      { name: "scoreNonce", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "Repaid",
    inputs: [
      { name: "borrower", type: "address", indexed: true },
      { name: "principal", type: "uint256", indexed: false },
      { name: "interest", type: "uint256", indexed: false },
      { name: "treasuryFee", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "Liquidated",
    inputs: [
      { name: "borrower", type: "address", indexed: true },
      { name: "liquidator", type: "address", indexed: true },
      { name: "debt", type: "uint256", indexed: false },
      { name: "collateralSeized", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
] as const;
