// =====================================================================
// MOCK DATA + MOCK ACTIONS
// Replace everything in this file with real API / wagmi / contract calls.
// Function names (connectWallet, borrow, deposit, repay) are intentionally
// kept generic so they can be swapped 1:1 for real implementations.
// =====================================================================

export type Tier = "A" | "B" | "C" | "D";

export interface ScoreFactor {
  label: string;
  value: number; // 0-100
}

export interface CreditProfile {
  score: number; // 0-1000
  tier: Tier;
  factors: ScoreFactor[];
  history: { day: string; score: number }[];
}

export interface PoolStats {
  totalLiquidity: number;
  supplyApy: number;
  utilization: number;
}

export interface ActiveLoan {
  borrowed: number;
  collateral: number;
  interestAccrued: number;
}

export const TIER_RATIOS: Record<Tier, number> = {
  A: 0.5,
  B: 0.8,
  C: 1.2,
  D: 1.5,
};

export const MOCK_ADDRESS = "0x4F3a8C2e1D7b6A9f0E5d8C3b2A1F9e7D6c5B9B21";

export const truncate = (addr: string) =>
  `${addr.slice(0, 6)}...${addr.slice(-4)}`;

export const tierFromScore = (score: number): Tier => {
  if (score >= 800) return "A";
  if (score >= 650) return "B";
  if (score >= 450) return "C";
  return "D";
};

export const initialProfile: CreditProfile = {
  score: 720,
  tier: "B",
  factors: [
    { label: "Wallet Age", value: 82 },
    { label: "Transaction Activity", value: 68 },
    { label: "Repayment History", value: 91 },
    { label: "Asset Diversity", value: 54 },
  ],
  history: [
    { day: "W1", score: 640 },
    { day: "W2", score: 655 },
    { day: "W3", score: 670 },
    { day: "W4", score: 690 },
    { day: "W5", score: 705 },
    { day: "W6", score: 720 },
  ],
};

export const initialPool: PoolStats = {
  totalLiquidity: 1_284_500,
  supplyApy: 6.42,
  utilization: 0.73,
};

export const initialLoan: ActiveLoan = {
  borrowed: 250,
  collateral: 200,
  interestAccrued: 3.74,
};

// ----- mock async actions (swap with real chain calls) -----
const wait = (ms = 900) => new Promise((r) => setTimeout(r, ms));

export async function connectWallet(): Promise<{ address: string }> {
  await wait(600);
  return { address: MOCK_ADDRESS };
}

export async function borrow(_amount: number): Promise<{ ok: true }> {
  await wait();
  return { ok: true };
}

export async function deposit(_amount: number): Promise<{ ok: true }> {
  await wait();
  return { ok: true };
}

export async function repay(): Promise<{ ok: true; scoreDelta: number }> {
  await wait();
  return { ok: true, scoreDelta: 15 };
}
