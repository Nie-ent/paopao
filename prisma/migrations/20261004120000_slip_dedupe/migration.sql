-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "reference" TEXT,
ADD COLUMN     "slipHash" TEXT;

-- CreateTable
CREATE TABLE "SubscriptionPayment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "slipHash" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPayment_reference_key" ON "SubscriptionPayment"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPayment_slipHash_key" ON "SubscriptionPayment"("slipHash");

-- CreateIndex
CREATE INDEX "SubscriptionPayment_userId_idx" ON "SubscriptionPayment"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_userId_reference_key" ON "Transaction"("userId", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_userId_slipHash_key" ON "Transaction"("userId", "slipHash");

-- AddForeignKey
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

