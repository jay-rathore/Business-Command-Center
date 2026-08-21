-- CreateEnum
CREATE TYPE "LeadStage" AS ENUM ('OPEN', 'WON', 'LOST');

-- DropIndex
DROP INDEX "Lead_source_idx";

-- DropIndex
DROP INDEX "Lead_status_idx";

-- AlterTable
ALTER TABLE "Lead" DROP COLUMN "leadType",
DROP COLUMN "source",
DROP COLUMN "status",
ADD COLUMN     "crmId" INTEGER,
ADD COLUMN     "leadTypeId" TEXT,
ADD COLUMN     "statusId" TEXT;

-- DropEnum
DROP TYPE "LeadSource";

-- DropEnum
DROP TYPE "LeadStatus";

-- DropEnum
DROP TYPE "LeadType";

-- CreateTable
CREATE TABLE "LeadStatus" (
    "id" TEXT NOT NULL,
    "crmId" INTEGER,
    "name" TEXT NOT NULL,
    "stage" "LeadStage" NOT NULL DEFAULT 'OPEN',
    "score" INTEGER NOT NULL DEFAULT 5,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadSource" (
    "id" TEXT NOT NULL,
    "crmId" INTEGER,
    "name" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 10,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadSourceOnLead" (
    "leadId" TEXT NOT NULL,
    "leadSourceId" TEXT NOT NULL,

    CONSTRAINT "LeadSourceOnLead_pkey" PRIMARY KEY ("leadId","leadSourceId")
);

-- CreateTable
CREATE TABLE "LeadType" (
    "id" TEXT NOT NULL,
    "crmId" INTEGER,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeadStatus_crmId_key" ON "LeadStatus"("crmId");

-- CreateIndex
CREATE UNIQUE INDEX "LeadStatus_name_key" ON "LeadStatus"("name");

-- CreateIndex
CREATE UNIQUE INDEX "LeadSource_crmId_key" ON "LeadSource"("crmId");

-- CreateIndex
CREATE UNIQUE INDEX "LeadSource_name_key" ON "LeadSource"("name");

-- CreateIndex
CREATE UNIQUE INDEX "LeadType_crmId_key" ON "LeadType"("crmId");

-- CreateIndex
CREATE UNIQUE INDEX "LeadType_name_key" ON "LeadType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_crmId_key" ON "Lead"("crmId");

-- CreateIndex
CREATE INDEX "Lead_statusId_idx" ON "Lead"("statusId");

-- CreateIndex
CREATE INDEX "Lead_leadTypeId_idx" ON "Lead"("leadTypeId");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_leadTypeId_fkey" FOREIGN KEY ("leadTypeId") REFERENCES "LeadType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "LeadStatus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadSourceOnLead" ADD CONSTRAINT "LeadSourceOnLead_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadSourceOnLead" ADD CONSTRAINT "LeadSourceOnLead_leadSourceId_fkey" FOREIGN KEY ("leadSourceId") REFERENCES "LeadSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

