-- CreateTable
CREATE TABLE "FeatureEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "lineUserId" TEXT,
    "feature" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeatureEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeatureEvent_feature_createdAt_idx" ON "FeatureEvent"("feature", "createdAt");

-- CreateIndex
CREATE INDEX "FeatureEvent_userId_createdAt_idx" ON "FeatureEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "FeatureEvent_createdAt_idx" ON "FeatureEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "FeatureEvent" ADD CONSTRAINT "FeatureEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Like every table: only the app's server role reads it, never the public Supabase API
ALTER TABLE "FeatureEvent" ENABLE ROW LEVEL SECURITY;
