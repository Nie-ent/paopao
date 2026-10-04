-- AlterTable
ALTER TABLE "Goal" ADD COLUMN     "type" "GoalType" NOT NULL DEFAULT 'FINANCIAL';

-- AlterTable
ALTER TABLE "Quest" ADD COLUMN     "condition" "QuestCondition" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "status" "QuestStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "type" "QuestType" NOT NULL DEFAULT 'ONETIME';

-- AlterTable
ALTER TABLE "Reward" ADD COLUMN     "status" "RewardStatus" NOT NULL DEFAULT 'AVAILABLE';

-- AlterTable
ALTER TABLE "RewardClaim" ADD COLUMN     "status" "ClaimStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "type" "TransactionType" NOT NULL DEFAULT 'EXPENSE';
ALTER TABLE "Transaction" ALTER COLUMN "type" DROP DEFAULT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "categoryColors" DROP DEFAULT,
ALTER COLUMN "categoryColors" TYPE JSONB USING "categoryColors"::jsonb,
ALTER COLUMN "categoryColors" SET DEFAULT '{}',
ALTER COLUMN "subscriptionTier" DROP DEFAULT,
ALTER COLUMN "subscriptionTier" TYPE "SubscriptionTier" USING "subscriptionTier"::"SubscriptionTier",
ALTER COLUMN "subscriptionTier" SET DEFAULT 'FREE';

-- CreateIndex
CREATE INDEX "ChatSession_userId_idx" ON "ChatSession"("userId");

-- CreateIndex
CREATE INDEX "Goal_userId_idx" ON "Goal"("userId");

-- CreateIndex
CREATE INDEX "QuestClaim_userId_idx" ON "QuestClaim"("userId");

-- CreateIndex
CREATE INDEX "RewardClaim_userId_idx" ON "RewardClaim"("userId");

-- CreateIndex
CREATE INDEX "Transaction_userId_date_idx" ON "Transaction"("userId", "date");

-- CreateIndex
CREATE INDEX "Transaction_userId_type_idx" ON "Transaction"("userId", "type");

