-- CreateEnum
CREATE TYPE "BriefFrequency" AS ENUM ('WEEKLY', 'DAILY', 'OFF');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "briefFrequency" "BriefFrequency" NOT NULL DEFAULT 'WEEKLY',
ADD COLUMN "trialReminderSentAt" TIMESTAMP(3);

-- People already paying for Pro signed up for a daily summary: keep it for them
UPDATE "User" SET "briefFrequency" = 'DAILY' WHERE "subscriptionTier" <> 'FREE' AND "proExpiresAt" > now();
