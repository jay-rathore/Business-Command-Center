-- AlterTable
ALTER TABLE "MarketingCampaign" ADD COLUMN     "leadsCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "metaCampaignId" TEXT,
ADD COLUMN     "revenue" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "MarketingCampaign_metaCampaignId_key" ON "MarketingCampaign"("metaCampaignId");
