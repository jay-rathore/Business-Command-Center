-- CreateTable
CREATE TABLE "CampaignEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdPlatformDailyMetric" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "platform" "CampaignPlatform" NOT NULL,
    "date" DATE NOT NULL,
    "spend" DECIMAL(12,2) NOT NULL,
    "impressions" INTEGER NOT NULL,
    "clicks" INTEGER NOT NULL,
    "conversions" INTEGER NOT NULL,
    "ctr" DECIMAL(7,4) NOT NULL,
    "avgCpc" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdPlatformDailyMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebsiteChannelDaily" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "channel" TEXT NOT NULL,
    "sessions" INTEGER NOT NULL,
    "conversions" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteChannelDaily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebsiteLandingPageDaily" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "landingPage" TEXT NOT NULL,
    "sessions" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebsiteLandingPageDaily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CampaignEvent_organizationId_detectedAt_idx" ON "CampaignEvent"("organizationId", "detectedAt");

-- CreateIndex
CREATE INDEX "CampaignEvent_campaignId_detectedAt_idx" ON "CampaignEvent"("campaignId", "detectedAt");

-- CreateIndex
CREATE INDEX "AdPlatformDailyMetric_organizationId_date_idx" ON "AdPlatformDailyMetric"("organizationId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "AdPlatformDailyMetric_organizationId_campaignId_date_key" ON "AdPlatformDailyMetric"("organizationId", "campaignId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "WebsiteChannelDaily_organizationId_date_channel_key" ON "WebsiteChannelDaily"("organizationId", "date", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "WebsiteLandingPageDaily_organizationId_date_landingPage_key" ON "WebsiteLandingPageDaily"("organizationId", "date", "landingPage");

-- AddForeignKey
ALTER TABLE "CampaignEvent" ADD CONSTRAINT "CampaignEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignEvent" ADD CONSTRAINT "CampaignEvent_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MarketingCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdPlatformDailyMetric" ADD CONSTRAINT "AdPlatformDailyMetric_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdPlatformDailyMetric" ADD CONSTRAINT "AdPlatformDailyMetric_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MarketingCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebsiteChannelDaily" ADD CONSTRAINT "WebsiteChannelDaily_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebsiteLandingPageDaily" ADD CONSTRAINT "WebsiteLandingPageDaily_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
