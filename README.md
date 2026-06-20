# CrediFi

AI-driven credit scoring for undercollateralized lending on HSK Chain.

CrediFi analyzes a wallet's on-chain history on HSK Chain — age, activity,
repayment behavior — and turns it into a credit score. A better score means
a lower collateral requirement to borrow. No score or bad history means
standard overcollateralized terms. Built for the HSK Chain On-Chain Horizon
Hackathon (DeFi track).

## How it works

1. **Score** — Backend service reads a wallet's HSK Chain history and
   computes a credit score (0–1000, tiered A/B/C/D).
2. **Oracle** — The score is signed off-chain and trusted on-chain via
   `CrediFiOracle.sol`.
3. **Lend/Borrow** — `CrediFiPool.sol` is a pooled lending market (deposit,
   borrow, repay, liquidate) for the native HSK token. Required collateral
   ratio for a borrower is set dynamically based on their tier.
4. **Feedback loop** — Repaying a loan improves your score over time,
   unlocking better terms on future loans.

## Stack

- **Contracts:** Solidity, deployed on HSK Chain (testnet for dev, mainnet
  for final submission)
- **Backend:** Node/Python service — scoring logic, score signing, REST API,
  on-chain event listener
- **Database:** Postgres — score history, wallet metadata (not fund custody;
  contracts remain source of truth for funds)
- **Frontend:** Built in Lovable, talks to backend API + contracts directly

## Repo structure

```
/contracts     Solidity contracts + tests
/backend       Scoring service, API, event listener
/scripts       Deploy scripts (testnet + mainnet)
PLAN.md        Full architecture, scope, and timeline
CLAUDE.md      Project rules/context for AI coding assistants
```

## Scope (v1)

- HSK Chain only, native HSK token only
- Pooled lending (not peer-to-peer)
- Score-based dynamic collateral tiers
- Simple threshold-based liquidation
- Protocol fee on interest paid

Cross-chain scoring, variable rate curves, and full auction liquidations are
noted as future work — see `PLAN.md` for details.

## Status

🚧 In development for the HSK Chain On-Chain Horizon Hackathon
(submission deadline: July 11, 2026).

### Deployed contracts (testnet)

| Contract | Address |
|---|---|
| `CrediFiOracle` | `0x6345Ec7861cDCf8798F5D40348d91Cdbe077544B` |
| `CrediFiPool`   | `0x0bFeE39682e4a5CA057A33838d06Ca7b43bF42Cc` |

- Network: HSK Chain testnet (chainId `133`)
- Deployed: 2026-06-20
- Treasury: `0x94E637478E80Dc90fe8afC731d45801e9FD9ef01`
- Relayer:  `0x031A07eB9eC38d6f81579B9b37b2643034d2ba59`
- Deployer: `0x213C5E563ab04727c5FdDDF271E5BF660e07955D`
- Full record: `contracts/deployments/hskTestnet.json`

Mainnet pending — run `npm run deploy:mainnet:dry` from `contracts/` before the live deployment.

## Disclaimer

Experimental hackathon project. Not audited. Do not use with real funds
beyond testing/demo purposes.