-- AlterTable
ALTER TABLE "MarketingCampaign" ADD COLUMN     "googleCampaignId" TEXT;

-- CreateTable
CREATE TABLE "WebsiteAnalyticsDaily" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "sessions" INTEGER NOT NULL,
    "activeUsers" INTEGER NOT NULL,
    "newUsers" INTEGER NOT NULL,
    "pageViews" INTEGER NOT NULL,
    "conversions" INTEGER NOT NULL,
    "engagementRate" DECIMAL(5,4) NOT NULL,
    "avgSessionSeconds" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteAnalyticsDaily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchConsoleDaily" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "clicks" INTEGER NOT NULL,
    "impressions" INTEGER NOT NULL,
    "ctr" DECIMAL(6,5) NOT NULL,
    "position" DECIMAL(6,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchConsoleDaily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchConsoleTopQuery" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "query" TEXT NOT NULL,
    "clicks" INTEGER NOT NULL,
    "impressions" INTEGER NOT NULL,
    "ctr" DECIMAL(6,5) NOT NULL,
    "position" DECIMAL(6,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchConsoleTopQuery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WebsiteAnalyticsDaily_date_key" ON "WebsiteAnalyticsDaily"("date");

-- CreateIndex
CREATE UNIQUE INDEX "SearchConsoleDaily_date_key" ON "SearchConsoleDaily"("date");

-- CreateIndex
CREATE UNIQUE INDEX "SearchConsoleTopQuery_date_query_key" ON "SearchConsoleTopQuery"("date", "query");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingCampaign_googleCampaignId_key" ON "MarketingCampaign"("googleCampaignId");

