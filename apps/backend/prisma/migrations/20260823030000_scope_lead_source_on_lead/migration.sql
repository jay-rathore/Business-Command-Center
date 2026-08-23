-- AlterTable: add nullable first (existing rows need a backfill before this can be NOT NULL)
ALTER TABLE "LeadSourceOnLead" ADD COLUMN "organizationId" TEXT;

-- Backfill from each row's own Lead, not "the only Organization" — correct regardless of how
-- many tenants exist by the time this runs.
UPDATE "LeadSourceOnLead" AS lsol
SET "organizationId" = l."organizationId"
FROM "Lead" AS l
WHERE l.id = lsol."leadId";

-- AlterTable: now safe to enforce
ALTER TABLE "LeadSourceOnLead" ALTER COLUMN "organizationId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "LeadSourceOnLead_organizationId_idx" ON "LeadSourceOnLead"("organizationId");

-- AddForeignKey
ALTER TABLE "LeadSourceOnLead" ADD CONSTRAINT "LeadSourceOnLead_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
