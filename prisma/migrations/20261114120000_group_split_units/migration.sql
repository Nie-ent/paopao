-- AlterTable
ALTER TABLE "GroupBill" ADD COLUMN "printedTotal" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "GroupBillItem" ADD COLUMN "discount" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "GroupBillClaim" ADD COLUMN "units" INTEGER NOT NULL DEFAULT 1;
