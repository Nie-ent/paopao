-- AlterTable
ALTER TABLE "User" ADD COLUMN     "proExpiresAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "UsageEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UsageEvent_userId_kind_createdAt_idx" ON "UsageEvent"("userId", "kind", "createdAt");

-- AddForeignKey
ALTER TABLE "UsageEvent" ADD CONSTRAINT "UsageEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Pro used to never expire. Everyone who is Pro today keeps it for 30 days from this migration.
UPDATE "User" SET "proExpiresAt" = CURRENT_TIMESTAMP + INTERVAL '30 days'
  WHERE "subscriptionTier" IN ('PRO', 'BUSINESS') AND "proExpiresAt" IS NULL;
