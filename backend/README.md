# CrediFi — Backend (Component B)

Node.js + TypeScript service for the CrediFi lending protocol. This package
implements the **scoring engine, EIP-712 signer, on-chain event indexer, and
REST API** the frontend consumes. Database schema/migrations live in
`prisma/` (see also `README.md` slice B-1).

Companion to [`@credifi/contracts`](../contracts) — deployed Oracle and Pool
addresses are at `contracts/deployments/hskTestnet.json`.

## Stack

- **Runtime**: Node.js 20+ (ESM)
- **Language**: TypeScript 5.5, strict mode
- **HTTP framework**: Fastify 5
- **DB**: Neon (serverless Postgres) via Prisma 5
- **Chain**: ethers v6, EIP-712 typed-data signing

## Source of truth

**The chain is authoritative.** This database is a read cache and history
log used by the frontend's score-over-time chart, the recent-activity feed,
and the borrow/repay/liquidation history. It is never the source of truth
for funds or loan state — if the DB and the chain ever disagree, the chain
wins. The event listener's job is to keep this DB eventually consistent
with on-chain reality; the listener's `IndexerState.lastBlock` tracks how
far it has caught up.

## Prerequisites

- Node.js 20+
- A Neon Postgres database (the `DATABASE_URL`).
- HSK Chain testnet RPC URL (and mainnet URL when ready to ship).
- A relayer private key whose derived address matches `oracle.signer` on
  the deployed CrediFiOracle.

## Setup

```bash
cd backend
cp .env.example .env       # then paste DATABASE_URL, HSK_RPC_URL, RELAYER_PRIVATE_KEY, etc.
npm install
npm run db:generate        # writes the typed @prisma/client to node_modules
npm run db:migrate         # first-time only: generates + applies init migration
npm run dev                # boots Fastify + indexer with hot reload
```

For one-off manual scoring without the server:

```bash
npm run score:compute -- 0xYourAddress             # pretty print
npm run score:compute -- 0xYourAddress --json      # JSON
```

For one-off backfill (e.g. after a long downtime):

```bash
npm run indexer:catchup
```

## Environment variables

| Name | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | yes | — | Neon Postgres pooled connection string |
| `HSK_RPC_URL` | yes | — | HSK Chain JSON-RPC endpoint |
| `CHAIN_ID` | no | `133` | Testnet is 133; mainnet is a placeholder until confirmed |
| `ORACLE_ADDRESS` | yes | — | CrediFiOracle on the target network |
| `POOL_ADDRESS` | yes | — | CrediFiPool on the target network |
| `RELAYER_PRIVATE_KEY` | yes | — | Backend signing key (must match `oracle.signer`) |
| `PORT` | no | `3001` | HTTP listen port |
| `SCORE_TTL_SECONDS` | no | `3600` | Signature expiry window |
| `LOG_LEVEL` | no | `info` | pino log level |
| `CORS_ORIGIN` | no | `*` | Comma-separated allowed origins, or `true` to allow all |
| `NODE_ENV` | no | `development` | Set to `production` in prod |

## REST API

All routes are mounted under `/api`. Addresses are validated and
lowercased automatically.

| Method | Path | Description |
|---|---|---|
| `GET`  | `/health` | Service health + DB + chain status |
| `GET`  | `/api/score/:address` | Current score, tier, factor breakdown, recent history |
| `GET`  | `/api/score/:address/history?limit=N` | Paginated score history (chart data) |
| `POST` | `/api/score/:address/sign` | Compute + EIP-712 sign; returns the signature bundle ready for `oracle.submitScore` |
| `GET`  | `/api/loan/:address` | Recent loans (any status) |
| `GET`  | `/api/loan/:address/active` | Currently active loans only |
| `GET`  | `/api/pool/stats` | Live pool stats read from `CrediFiPool` |

### Examples

```bash
# Health
curl -s http://localhost:3001/health

# Current score
curl -s http://localhost:3001/api/score/0x94E637478E80Dc90fe8afC731d45801e9FD9ef01

# Sign a score (returns v, r, s ready for the contract call)
curl -s -X POST http://localhost:3001/api/score/0x94E637478E80Dc90fe8afC731d45801e9FD9ef01/sign

# Pool stats
curl -s http://localhost:3001/api/pool/stats
```

### Score-response shape

```json
{
  "address": "0x94e6...",
  "score": 612,
  "tier": "B",
  "factors": [
    { "label": "Wallet Age",          "value": 47 },
    { "label": "Transaction Activity", "value": 73 },
    { "label": "Repayment History",    "value": 60 },
    { "label": "Asset Diversity",      "value": 55 }
  ],
  "history": [
    { "day": "2026-06-14", "score": 600 },
    { "day": "2026-06-15", "score": 612 }
  ],
  "_history": {
    "ageDays": 171,
    "txCount": 730,
    "hskBalanceWei": "1234500000000000000000",
    "repaidLoanCount": 3,
    "liquidatedLoanCount": 0
  }
}
```

## How scoring works (v1)

The default rule is rule-based and deterministic. Five raw inputs are
fetched (RPC + DB) into a `WalletHistory` blob, mapped to sub-scores in
`[0, 100]`, weighted (weights must sum to 100), and scaled to `[0, 1000]`.
Liquidation history is applied as a penalty on the repayment sub-score.

The full algorithm is in `src/score/score.ts`. The `ScoringRule` interface
in `src/score/types.ts` is the pluggable point — swap in an ML model in
v2 by writing a new rule and registering it in the API layer.

The factor labels (`["Wallet Age", "Transaction Activity", ...]`) are
the same set the frontend's `mockData.ts::initialProfile.factors` uses,
so the swap from mocks to real API is a 1:1 drop-in.

## How signing works

`POST /api/score/:address/sign` runs the scoring rule, then:

1. Reads the wallet's current `nonce` from the on-chain oracle.
2. Increments by 1.
3. Builds the EIP-712 typed-data hash matching `CrediFiOracle.SCORE_TYPEHASH`.
4. Signs with `RELAYER_PRIVATE_KEY` via `signer.signTypedData`.
5. Persists a new `Score` row with the signature in the local DB.
6. Returns `{ score, tier, expiresAt, nonce, v, r, s, digest }` to the
   caller, who submits it to `oracle.submitScore`.

The indexer later correlates the `Score` row with the on-chain
`ScoreSubmitted` event by finding the most-recent unsigned row for the
wallet and setting its `txHash` field.

**CRITICAL**: the type string + domain in `config.ts` MUST match the
constants in `CrediFiOracle.sol`. If they drift, every signature silently
fails to recover — the contract will revert `Oracle__InvalidSignature`.

## How the indexer works

On every poll cycle, the indexer:

1. Reads `IndexerState.lastBlock` from the DB.
2. If it's `0`, starts from `currentHead − safeStartBlocks` (default 50)
   to avoid scanning through genesis.
3. Scans up to `blockBatchSize` blocks (default 500) for `Borrow`,
   `Repaid`, `Liquidated` events on the pool, and `ScoreSubmitted` on
   the oracle.
4. Writes the corresponding DB rows.
5. Updates `IndexerState.lastBlock` to the highest processed.

The poll interval is 5s when there's no new head. Errors in a single
cycle are logged and the loop continues.

**Reorg safety (v1)**: assumes reorgs are no deeper than
`safeStartBlocks` (50). If a deeper reorg happens, the indexer may
write a stale row that won't be corrected by chain events. Defer a
full reorg-recovery flow to v2.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Hot-reload dev server (tsx watch) |
| `npm run start` | Production start |
| `npm run score:compute -- <addr>` | Manual score for a wallet, no server |
| `npm run indexer:catchup` | One-shot indexer pass to chain head, then exit |
| `npm run db:generate` | Regenerate `@prisma/client` types |
| `npm run db:migrate` | `prisma migrate dev` (interactive) |
| `npm run db:deploy` | `prisma migrate deploy` (CI/prod) |
| `npm run db:studio` | Prisma Studio in browser |
| `npm run db:reset` | **Destructive.** Drop and re-apply all migrations. |
| `npm run typecheck` | `tsc --noEmit` |

## Directory layout

```
backend/
├─ prisma/
│  ├─ schema.prisma
│  └─ migrations/
├─ src/
│  ├─ api/
│  │  ├─ server.ts                 # Fastify bootstrap + graceful shutdown
│  │  ├─ main.ts                   # entry: calls bootstrap()
│  │  └─ routes/
│  │     ├─ score.ts
│  │     ├─ loan.ts
│  │     └─ pool.ts
│  ├─ chain/
│  │  └─ provider.ts               # ethers v6 RPC + Contract helpers
│  ├─ cli/
│  │  ├─ score.ts                  # npm run score:compute
│  │  └─ catchup.ts                # npm run indexer:catchup
│  ├─ indexer/
│  │  └─ indexer.ts                # event listener loop
│  ├─ score/
│  │  ├─ types.ts
│  │  ├─ history.ts                # fetchWalletHistory
│  │  ├─ score.ts                  # defaultRule
│  │  └─ sign.ts                   # signScore
│  ├─ config.ts                    # all tunables + env validation
│  └─ db.ts                        # Prisma client singleton
├─ .env.example
├─ .gitignore
├─ package.json
├─ tsconfig.json
└─ README.md
```

## Open items (deferred to later slices)

- **Auth** — no API key / wallet-signature gating. Fine for a hackathon
  demo, must add before any public deploy.
- **Rate limiting** — `@fastify/rate-limit` plugin is one-liner to add;
  deferred.
- **Multi-protocol repayment history** — v1 only knows about CrediFi.
- **Real ML scorer** — v2 (per PLAN.md §5B).
- **Reorg handling > 50 blocks** — v2.
- **HSP integration** — Week 4, separate slice; not on the B-2 critical path.
- **Frontend swap from mockData → real API** — Week 3; this slice
  produces the endpoints, the Lovable team wires them.

## Demo flow (PLAN.md §6 alignment)

The implementation supports the demo script:

1. **Wallet A** (aged, repaid before) → high score → low collateral.
2. **Wallet B** (fresh wallet) → low score → high collateral.
3. **Wallet B repays** → on-chain `Repaid` event → indexer updates
   `Loan.status` to "repaid" → the score for the next borrow reflects
   the new repayment history (the score script re-runs the rule).
4. Live score update on the dashboard via the chart endpoint.
