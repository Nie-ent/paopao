
-- CreateEnum
CREATE TYPE "GroupBillStatus" AS ENUM ('OPEN', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GroupDebtStatus" AS ENUM ('OPEN', 'CLAIMED', 'PAID', 'CANCELLED');

-- CreateTable
CREATE TABLE "LineGroup" (
    "id" TEXT NOT NULL,
    "lineGroupId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT,
    "armedBy" TEXT,
    "armedUntil" TIMESTAMP(3),
    "leftAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LineGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupMember" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "lineUserId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "pictureUrl" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LinePayee" (
    "lineUserId" TEXT NOT NULL,
    "promptPayId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LinePayee_pkey" PRIMARY KEY ("lineUserId")
);

-- CreateTable
CREATE TABLE "GroupBill" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "paidBy" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "serviceCharge" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "vat" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "GroupBillStatus" NOT NULL DEFAULT 'OPEN',
    "receiptHash" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupBill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupBillItem" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "position" INTEGER NOT NULL,

    CONSTRAINT "GroupBillItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupBillClaim" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "lineUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupBillClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupDebt" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "debtorId" TEXT NOT NULL,
    "creditorId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "GroupDebtStatus" NOT NULL DEFAULT 'OPEN',
    "slipRef" TEXT,
    "paidAt" TIMESTAMP(3),
    "lastRemindedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupDebt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupUsageEvent" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "lineUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupUsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LineGroup_lineGroupId_key" ON "LineGroup"("lineGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupMember_groupId_lineUserId_key" ON "GroupMember"("groupId", "lineUserId");

-- CreateIndex
CREATE INDEX "GroupBill_groupId_createdAt_idx" ON "GroupBill"("groupId", "createdAt");

-- CreateIndex
CREATE INDEX "GroupBillItem_billId_idx" ON "GroupBillItem"("billId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupBillClaim_itemId_lineUserId_key" ON "GroupBillClaim"("itemId", "lineUserId");

-- CreateIndex
CREATE INDEX "GroupDebt_slipRef_idx" ON "GroupDebt"("slipRef");

-- CreateIndex
CREATE INDEX "GroupDebt_groupId_status_idx" ON "GroupDebt"("groupId", "status");

-- CreateIndex
CREATE INDEX "GroupDebt_debtorId_status_idx" ON "GroupDebt"("debtorId", "status");

-- CreateIndex
CREATE INDEX "GroupUsageEvent_groupId_kind_createdAt_idx" ON "GroupUsageEvent"("groupId", "kind", "createdAt");

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "LineGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupBill" ADD CONSTRAINT "GroupBill_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "LineGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupBillItem" ADD CONSTRAINT "GroupBillItem_billId_fkey" FOREIGN KEY ("billId") REFERENCES "GroupBill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupBillClaim" ADD CONSTRAINT "GroupBillClaim_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "GroupBillItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupDebt" ADD CONSTRAINT "GroupDebt_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "LineGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupDebt" ADD CONSTRAINT "GroupDebt_billId_fkey" FOREIGN KEY ("billId") REFERENCES "GroupBill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupUsageEvent" ADD CONSTRAINT "GroupUsageEvent_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "LineGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Like every table: only the app's server role reads it, never the public Supabase API
ALTER TABLE "LineGroup" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GroupMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LinePayee" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GroupBill" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GroupBillItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GroupBillClaim" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GroupDebt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GroupUsageEvent" ENABLE ROW LEVEL SECURITY;
