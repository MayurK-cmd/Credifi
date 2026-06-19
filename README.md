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

## Disclaimer

Experimental hackathon project. Not audited. Do not use with real funds
beyond testing/demo purposes.