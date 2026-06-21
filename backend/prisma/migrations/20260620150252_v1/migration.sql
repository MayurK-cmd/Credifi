-- CreateTable
CREATE TABLE "wallets" (
    "address" TEXT NOT NULL,
    "first_seen_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("address")
);

-- CreateTable
CREATE TABLE "scores" (
    "id" TEXT NOT NULL,
    "wallet_addr" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "tier" TEXT NOT NULL,
    "factors" JSONB NOT NULL,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signature" TEXT,
    "tx_hash" TEXT,

    CONSTRAINT "scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loans" (
    "id" TEXT NOT NULL,
    "wallet_addr" TEXT NOT NULL,
    "principal" TEXT NOT NULL,
    "collateral_locked" TEXT NOT NULL,
    "tier_at_borrow" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "borrowed_at" TIMESTAMP(3) NOT NULL,
    "repaid_at" TIMESTAMP(3),
    "borrow_tx_hash" TEXT NOT NULL,
    "repay_tx_hash" TEXT,

    CONSTRAINT "loans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "indexer_state" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "last_block" INTEGER NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "indexer_state_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scores_wallet_addr_computed_at_idx" ON "scores"("wallet_addr", "computed_at");

-- CreateIndex
CREATE INDEX "loans_wallet_addr_status_idx" ON "loans"("wallet_addr", "status");

-- AddForeignKey
ALTER TABLE "scores" ADD CONSTRAINT "scores_wallet_addr_fkey" FOREIGN KEY ("wallet_addr") REFERENCES "wallets"("address") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_wallet_addr_fkey" FOREIGN KEY ("wallet_addr") REFERENCES "wallets"("address") ON DELETE RESTRICT ON UPDATE CASCADE;
