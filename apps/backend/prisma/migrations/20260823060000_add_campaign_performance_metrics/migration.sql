-- AlterTable
ALTER TABLE "MarketingCampaign"
  ADD COLUMN     "impressions" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN     "clicks" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN     "ctr" DECIMAL(7,4) NOT NULL DEFAULT 0,
  ADD COLUMN     "avgCpc" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN     "dailyBudget" DECIMAL(12,2),
  ADD COLUMN     "bidStrategy" TEXT;
