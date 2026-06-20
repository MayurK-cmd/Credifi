# CrediFi — Smart Contracts

On-chain lending protocol for HSK Chain. Pooled lenders earn yield; borrowers post a tier-based collateral ratio against an off-chain EIP-712 credit score signed by a backend relayer. Borrowed asset is native **HSK**; collateral is also native **HSK**.

This package is **Component A** of the CrediFi monorepo (`D:\code\web3\Credifi`). The frontend already implies the protocol's tier/ratio semantics via `frontend/src/lib/mockData.ts`; the contracts here match them line-for-line so the frontend-to-contract swap is a 1:1 method-name replacement.

---

## Contracts

| Contract | Purpose |
|---|---|
| `contracts/CrediFiOracle.sol` | EIP-712 signed score store. Verifies `(wallet, score, tier, expiresAt, nonce)` signatures from the backend; recomputes the tier from the score so a dishonest backend cannot lie about tier independently of score. `consumeNonce` is callable only by the configured pool, preventing replay. |
| `contracts/CrediFiPool.sol` | Pooled lender/borrower vault. ERC-4626-style share accounting for lenders, native-HSK collateral and borrow, block-linear interest accrual, simple health-factor liquidation. |
| `contracts/interfaces/IPriceFeedHSP.sol` | Stub HSP price-feed interface (TODO(hsp)). v1 uses 1:1 HSK ratio for health factor. |
| `contracts/mocks/ReentrancyAttacker.sol` | Test helper — must not be deployed. |

---

## Tier table

Mirrors `frontend/src/lib/mockData.ts` exactly.

| Tier | Score range | Collateral ratio | Notes |
|------|-------------|------------------|-------|
| A    | ≥ 800       | 50 %             | Best terms |
| B    | ≥ 650       | 80 %             | |
| C    | ≥ 450       | 120 %            | |
| D    | < 450       | 150 %            | Worst terms, still over-collateralized |

Tier is computed inside `CrediFiOracle.computeTier(uint16)`. A signed score carrying `tier = X` for a score that maps to `tier = Y` reverts at submit time (`Oracle__InvalidTier`) — the backend cannot lie about tier without lying about score, and score is bound by the EIP-712 signature.

---

## Protocol constants

| Constant | Value | Meaning |
|---|---|---|
| `BPS` | `10_000` | Basis points denominator |
| `LIQUIDATION_THRESHOLD_BPS` | `11_000` (1.10) | Position is liquidatable when `healthFactor < 1.10` |
| `DEFAULT_BORROW_RATE_BPS` | `800` (8 %) | Fixed APR per borrow; configurable per-position in future |
| `MIN_BORROW_RATE_BPS` | `100` (1 %) | Floor |
| `MAX_BORROW_RATE_BPS` | `3_000` (30 %) | Ceiling |
| `PROTOCOL_FEE_BPS` | `2_500` (25 %) | 25 % of accrued interest → treasury; 75 % to lenders via share value |
| `BLOCKS_PER_YEAR` | `6_307_200` | 5-second blocks × 365 days (HSK Chain) |

Interest is **block-linear, not compounded**:

```
interest = principal * rateBps * blocksElapsed / BPS / BLOCKS_PER_YEAR
owed     = principal + interest
```

The 25 / 75 split between treasury and lenders mirrors the spec: of 8 % APR, ~2 % goes to the treasury and ~6 % accrues to lenders via share-value growth.

---

## Install & configure

```bash
npm install
cp .env.example .env       # then fill in real values
```

`.env` keys (see `.env.example`):

- `PRIVATE_KEY` — deployer / admin key. Never commit `.env`.
- `HSK_TESTNET_RPC` — HSK Chain testnet JSON-RPC URL.
- `HSK_MAINNET_RPC` — HSK Chain mainnet JSON-RPC URL.
- `TREASURY_ADDRESS` — recipient of the 25 % protocol fee.
- `RELAYER_ADDRESS` — backend signer pubkey passed to `CrediFiOracle` ctor.
- `REPORT_GAS` — `true` to print gas usage on every test.
- `HSK_EXPLORER_API_KEY` — used by `hardhat verify` against the HSK explorer (placeholder until hashfans.io docs are read).

> **Chain IDs.** `hskTestnet` is hard-coded to `133` (HSK Chain testnet). `hskMainnet` (`9001`) is still a placeholder — patch it once the live mainnet chainId is confirmed via `eth_chainId` against the mainnet RPC.

---

## Deployed addresses

### HSK Chain testnet (chainId `133`, deployed 2026-06-20)

| Contract | Address |
|---|---|
| `CrediFiOracle` | `0x6345Ec7861cDCf8798F5D40348d91Cdbe077544B` |
| `CrediFiPool`   | `0x0bFeE39682e4a5CA057A33838d06Ca7b43bF42Cc` |
| Treasury | `0x94E637478E80Dc90fe8afC731d45801e9FD9ef01` |
| Relayer  | `0x031A07eB9eC38d6f81579B9b37b2643034d2ba59` |
| Deployer | `0x213C5E563ab04727c5FdDDF271E5BF660e07955D` |

Full deployment record (including the raw constructor-arg arrays needed for `hardhat verify`): `deployments/hskTestnet.json`.

### HSK Chain mainnet

Not yet deployed. Run `npm run deploy:mainnet:dry` to preview, then `npm run deploy:mainnet` to broadcast.

---

## Workflows

### Compile

```bash
npm run compile
```

Solidity `0.8.24`, optimizer 200 runs, `viaIR: true`, EVM target `cancun` (Cancun is required by OpenZeppelin Contracts v5).

### Test

```bash
npm test
```

- 39 cases: 15 for `CrediFiOracle`, 24 for `CrediFiPool`.
- Coverage target: ≥ 90 % lines / statements.

```bash
npm run coverage
```

### Lint

```bash
npm run lint          # solhint, all *.sol files
npm run lint:fix      # auto-fix where possible
```

### Local node

Terminal A:

```bash
npm run node
```

Terminal B:

```bash
npx hardhat ignition deploy ignition/modules/CrediFi.ts --network localhost \
  --parameters '{"CrediFi":{"signer":"0xYourSigner","treasury":"0xYourTreasury"}}'
```

### Testnet

```bash
npm run deploy:testnet
```

Writes `deployments/hskTestnet.json` with oracle + pool addresses, chainId, deployer, treasury, relayer, and a timestamp.

### Mainnet (dry-run first, always)

```bash
npm run deploy:mainnet:dry    # prints plan, writes deployments/hskMainnet.dryrun.json, NO txs
npm run deploy:mainnet        # actually deploys; irreversible
```

Mainnet runs require `HSK_MAINNET_RPC` in `.env`. The dry-run reports the planned oracle address (via `eth_getTransactionCount` + `getContractAddress` prediction) and **does not send any transactions**. Confirm the dry-run output, then re-run without `--dry-run`.

### Verify on the HSK explorer

```bash
npm run verify   # currently a placeholder — see scripts/verify-contracts.ts
```

`scripts/args-oracle.js` and `scripts/args-pool.js` export the constructor arg arrays from each network's `deployments/<network>.json` so the standard `npx hardhat verify --constructor-args …` flow works once the HSK explorer endpoint is wired into `hardhat.config.ts`.

---

## Directory layout

```
contracts/
├─ contracts/
│  ├─ CrediFiOracle.sol
│  ├─ CrediFiPool.sol
│  ├─ interfaces/IPriceFeedHSP.sol
│  └─ mocks/ReentrancyAttacker.sol
├─ test/
│  ├─ CrediFiOracle.test.ts
│  ├─ CrediFiPool.test.ts
│  └─ helpers/{deploy.ts, signScore.ts, constants.ts}
├─ ignition/modules/CrediFi.ts
├─ scripts/{deploy-testnet.ts, deploy-mainnet.ts, verify-contracts.ts, args-oracle.js, args-pool.js}
├─ deployments/                # gitignored, except for .gitkeep
├─ hardhat.config.ts
├─ package.json
├─ tsconfig.json
├─ .env.example
├─ .gitignore
├─ .npmrc
├─ .solhint.json
└─ .prettierrc
```

---

## Open items (do NOT block on these)

1. **HSK Chain chain IDs** — patch `hardhat.config.ts` once `eth_chainId` is confirmed against live RPCs.
2. **HSK explorer verification** — fill in the actual explorer API URL in `hardhat.config.ts`'s `etherscan.customChains` after reviewing the hashfans.io docs.
3. **HSP price feed** — `IPriceFeedHSP.sol` currently exposes `latestAnswer()` returning `uint256`; replace with the real interface once the hashfans.io manual is read (scheduled for Week 3 of the hackathon plan). Until then, the pool uses a 1:1 HSK collateral-to-borrow ratio for health-factor purposes.
4. **`relayer` vs `treasury`** — distinct addresses by design. `relayer` is the hot wallet that calls `oracle.submitScore`; `treasury` is the cold wallet that receives protocol fees.

---

## Security disclaimer

This codebase is **unaudited** and was written under a hackathon deadline. It is not suitable for production deployment on a network holding real value. Before any production launch:

- Commission an independent security audit of `CrediFiOracle` and `CrediFiPool`.
- Verify all EIP-712 domain parameters (name, version, chainId) match what the backend signs.
- Confirm the tier/ratio tables against the frontend and against any off-chain risk policy.
- Replace the HSP stub with a real, audited price-feed source.
- Test against mainnet-fork of HSK Chain with adversarial scenarios (reentrancy, oracle manipulation, liquidity-drain, griefing).

Use at your own risk. See top-level `README.md` for the project-wide disclaimer.