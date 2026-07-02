# CrediFi

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

**AI-driven credit scoring for undercollateralized lending on HSK Chain.**

CrediFi reads a wallet's on-chain history — age, activity, prior repayments
— and converts it into a 0–1000 credit score. A higher score means a higher
tier (A → D) and a lower collateral requirement when borrowing from the
pool. No score or bad history means standard overcollateralized terms.
Repaying a loan feeds back into the score, unlocking better terms next time.

Built end-to-end for the HSK Chain On-Chain Horizon Hackathon (DeFi track,
submission July 2026). The chain is the source of truth for funds; the
backend is a read-cache + signing relay; the frontend is a thin client over
both.

## How it works

```
Wallet ──► CrediFiOracle (EIP-712) ──► CrediFiPool (deposit / borrow / repay)
   │                                       ▲
   ▼                                       │
Backend (score, sign, index events) ───────┘
   │
   ▼
Postgres (read cache: scores, loans, TVL snapshots, treasury fees)
```

1. **Score** — The backend reads the wallet's HSK Chain history and computes
   a score with a 4-factor breakdown (wallet age, tx activity, repayment
   history, asset diversity).
2. **Sign** — The score is EIP-712-signed off-chain by the relayer; the
   on-chain `CrediFiOracle` trusts the signature.
3. **Borrow** — The borrower submits `oracle.submitScore` then
   `pool.borrow` with tier-based collateral in native HSK.
4. **Repay** — `pool.repay` settles the debt and emits a `Repaid` event
   containing the treasury fee; the indexer writes the fee to the DB.
5. **Loop** — The next time the wallet asks for a score, prior repayments
   are factored in, bumping the wallet up a tier (and lowering collateral).

## Repo layout

```
contracts/    Solidity sources, Hardhat tests, ignition deploy scripts
backend/      Fastify + Prisma + ethers v6; REST API + indexer
frontend/     TanStack Start (React 19) + viem + react-query
PLAN.md       Architecture, scope, and timeline
CLAUDE.md     Rules / context for AI coding assistants
```

Key files: `contracts/CrediFiOracle.sol`, `contracts/CrediFiPool.sol`;
`backend/src/api/{server.ts,routes/}`, `backend/src/indexer/`,
`backend/src/score/sign.ts`, `backend/prisma/schema.prisma`;
`frontend/src/lib/{wallet-actions,pool-reads,chain}.ts`,
`frontend/src/routes/`, `frontend/src/components/WalletButton.tsx`.

## Deployed contracts

### HSK Chain mainnet (live, chainId 177)

| Contract | Address |
| --- | --- |
| `CrediFiOracle` | `0xEe39002BF9783DB5dac224Df968D0e3c5CE39a2B` |
| `CrediFiPool`   | `0xDFf2C28CBb78C14Edc0d6F39cb624553D091297f` |

- Network: HSK Chain mainnet · chainId `177`
- RPC: `https://mainnet.hsk.xyz`
- Explorer: `https://explorer.hsk.xyz`
- Deployer: `0x213C5E563ab04727c5FdDDF271E5BF660e07955D`
- Full record: `contracts/deployments/hskMainnet.json` and `contracts/MAINNET.md`

### HSK Chain testnet (historical, chainId 133)

| Contract | Address |
| --- | --- |
| `CrediFiOracle` | `0x6345Ec7861cDCf8798F5D40348d91Cdbe077544B` |
| `CrediFiPool`   | `0x0bFeE39682e4a5CA057A33838d06Ca7b43bF42Cc` |

- Network: HSK Chain testnet · chainId `133`
- RPC: `https://testnet.hsk.xyz`
- Explorer: `https://testnet-explorer.hsk.xyz`
- Full record: `contracts/deployments/hskTestnet.json`

The frontend + backend default to mainnet out of the box. To run against
testnet, copy the commented testnet block in `backend/.env` and
`frontend/.env.local`.

## REST API (excerpt)

| Method | Path | Notes |
| --- | --- | --- |
| `GET`  | `/health` | Liveness + DB + chainId check |
| `GET`  | `/api/score/:address` | Current score, tier, factors, history |
| `GET`  | `/api/score/:address/history?limit=N` | Score history (chart) |
| `POST` | `/api/score/:address/sign` | EIP-712 signature bundle |
| `GET`  | `/api/loan/:address` | Loans for a wallet |
| `GET`  | `/api/loan/:address/active` | Most recent active loan |
| `GET`  | `/api/pool/stats` | Liquidity, supply APY, utilization |
| `GET`  | `/api/status` | Protocol stats + system health + TVL history |

All wei values are decimal strings (uint256 won't fit in a JS Number).

## Running locally

Requires Node 20+, Bun, and a Postgres database (Neon works) with
`DATABASE_URL` set in `backend/.env`.

```bash
# Backend
cd backend && cp .env.example .env && npm install
npx prisma migrate deploy && npm run dev      # http://localhost:3001

# Frontend
cd ../frontend && cp .env.example .env.local && npm install && npm run dev

# Contracts (only if redeploying)
cd ../contracts && npm install
npx hardhat test                              # 39 tests, ~1s
npx hardhat ignition deploy ignition/modules/CrediFi.ts --network hskTestnet
```

## Tests

The Solidity suite (`contracts/test/`) covers both contracts end-to-end with
Hardhat + Chai. Run with:

```bash
cd contracts
npx hardhat test           # 39 unit + integration tests, ~1s
npx hardhat coverage       # writes ./coverage/ + ./coverage.json
```

### Latest results

- **39 / 39 passing** (100% pass rate, 0 failing, 0 skipped) in ~1s
- **Coverage:** 90.3% statements · 92.8% lines · 86.7% functions ·
  65.7% branches overall

| Contract | Stmts | Lines | Funcs | Branches |
| --- | ---: | ---: | ---: | ---: |
| `CrediFiOracle.sol`        | 90.9% | 97.1% | 88.9% | 83.3% |
| `CrediFiPool.sol`          | 89.9% | 94.3% | 84.2% | 61.0% |
| `IPriceFeedHSP.sol`        | 100%  | 100%  | 100%  | 100%  |
| `ReentrancyAttacker.sol`*  | 100%  | 55.6% | 100%  | 25%   |

*Mock contract — only the public-facing lines are exercised; the recursive
helper is covered indirectly by the reentrancy test in `CrediFiPool.test.ts`.

### Coverage scope

- **Oracle** — owner-only setters, EIP-712 signed submission, nonce replay
  protection, expiration window, score/tier consistency, EIP-5267 domain,
  view purity of `verifyScore`.
- **Pool lender** — 1:1 first-deposit minting, pro-rata mints, proportional
  withdraw, share dilution, over-withdraw revert, reentrancy block.
- **Pool borrower** — Tier A (50%) vs. Tier D (150%) collateral, shortfall /
  bad-signature / stale-nonce / over-liquidity reverts, single-active-loan
  rule, repay with interest split, overpayment refund.
- **Liquidation** — health-factor decay, threshold at `HF < 1.10`.
- **Interest math** — `accruedDebt` correctness at 1 and 1000 blocks.
- **HSP stub** — owner-only `setPriceFeed`, 1:1 default when unset.

Remaining uncovered lines in `CrediFiPool` (431, 432, 447) are defensive
branches — exercised by name but Istanbul flags them because the boolean
flip happens inside the test fixture.

## Scope

**In v1:** pooled HSK lending, tier-based collateral, EIP-712 signed scores,
threshold liquidation, protocol fee on interest.

**Deferred:** cross-chain scoring, variable rate curves, auction liquidations,
withdraw UX polish, multi-wallet support beyond EIP-1193 / WalletConnect.

## Disclaimer

Hackathon project. Contracts are **not audited**. The `RELAYER_PRIVATE_KEY`
in `backend/.env` is a hot key — keep off-disk in production and rotate
on compromise. Mainnet is live, so exercise the same caution you would
on any deployed protocol.
