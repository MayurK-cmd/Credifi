-- CreateTable
CREATE TABLE "tvl_snapshots" (
    "id" TEXT NOT NULL,
    "tvl_wei" TEXT NOT NULL,
    "sampled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tvl_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treasury_fees" (
    "id" TEXT NOT NULL,
    "borrower" TEXT NOT NULL,
    "amount_wei" TEXT NOT NULL,
    "tx_hash" TEXT NOT NULL,
    "collected_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "treasury_fees_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "treasury_fees_tx_hash_key" ON "treasury_fees"("tx_hash");

-- CreateIndex
CREATE INDEX "tvl_snapshots_sampled_at_idx" ON "tvl_snapshots"("sampled_at");

-- CreateIndex
CREATE INDEX "treasury_fees_collected_at_idx" ON "treasury_fees"("collected_at");
