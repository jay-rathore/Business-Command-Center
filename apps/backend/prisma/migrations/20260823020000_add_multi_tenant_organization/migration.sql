-- DropIndex
DROP INDEX "AuditLog_module_recordId_idx";

-- DropIndex
DROP INDEX "AuditLog_userId_createdAt_idx";

-- DropIndex
DROP INDEX "Complaint_complaintCode_key";

-- DropIndex
DROP INDEX "Customer_customerCode_key";

-- DropIndex
DROP INDEX "Customer_state_city_idx";

-- DropIndex
DROP INDEX "Dealer_dealerCode_key";

-- DropIndex
DROP INDEX "Dealer_state_city_idx";

-- DropIndex
DROP INDEX "Dealer_status_idx";

-- DropIndex
DROP INDEX "DealerActivity_dealerId_occurredAt_idx";

-- DropIndex
DROP INDEX "Lead_assignedExecId_idx";

-- DropIndex
DROP INDEX "Lead_crmId_key";

-- DropIndex
DROP INDEX "Lead_leadCode_key";

-- DropIndex
DROP INDEX "Lead_leadTypeId_idx";

-- DropIndex
DROP INDEX "Lead_state_city_idx";

-- DropIndex
DROP INDEX "Lead_statusId_idx";

-- DropIndex
DROP INDEX "LeadActivity_leadId_occurredAt_idx";

-- DropIndex
DROP INDEX "LeadSource_crmId_key";

-- DropIndex
DROP INDEX "LeadSource_name_key";

-- DropIndex
DROP INDEX "LeadStatus_crmId_key";

-- DropIndex
DROP INDEX "LeadStatus_name_key";

-- DropIndex
DROP INDEX "LeadType_crmId_key";

-- DropIndex
DROP INDEX "LeadType_name_key";

-- DropIndex
DROP INDEX "MarketingCampaign_googleCampaignId_key";

-- DropIndex
DROP INDEX "MarketingCampaign_metaCampaignId_key";

-- DropIndex
DROP INDEX "Notification_userId_isRead_idx";

-- DropIndex
DROP INDEX "Order_customerId_idx";

-- DropIndex
DROP INDEX "Order_dealerId_idx";

-- DropIndex
DROP INDEX "Order_orderCode_key";

-- DropIndex
DROP INDEX "Order_orderDate_idx";

-- DropIndex
DROP INDEX "Order_salesExecId_idx";

-- DropIndex
DROP INDEX "Order_state_idx";

-- DropIndex
DROP INDEX "OrderItem_orderId_idx";

-- DropIndex
DROP INDEX "OrderItem_productId_idx";

-- DropIndex
DROP INDEX "Product_categoryId_idx";

-- DropIndex
DROP INDEX "Product_shadeId_idx";

-- DropIndex
DROP INDEX "Product_sku_key";

-- DropIndex
DROP INDEX "Product_wcId_key";

-- DropIndex
DROP INDEX "ProductCategory_name_key";

-- DropIndex
DROP INDEX "ProductShade_name_key";

-- DropIndex
DROP INDEX "Project_projectCode_key";

-- DropIndex
DROP INDEX "Project_salesExecId_idx";

-- DropIndex
DROP INDEX "Project_stage_idx";

-- DropIndex
DROP INDEX "Project_state_city_idx";

-- DropIndex
DROP INDEX "ProjectActivity_projectId_occurredAt_idx";

-- DropIndex
DROP INDEX "Quotation_leadId_idx";

-- DropIndex
DROP INDEX "Quotation_quotationCode_key";

-- DropIndex
DROP INDEX "QuotationItem_quotationId_idx";

-- DropIndex
DROP INDEX "SalesExecutive_employeeCode_key";

-- DropIndex
DROP INDEX "SalesTarget_scope_periodStart_periodEnd_idx";

-- DropIndex
DROP INDEX "SearchConsoleDaily_date_key";

-- DropIndex
DROP INDEX "SearchConsoleTopQuery_date_query_key";

-- DropIndex
DROP INDEX "User_email_key";

-- DropIndex
DROP INDEX "WarrantyClaim_claimCode_key";

-- DropIndex
DROP INDEX "WebsiteAnalyticsDaily_date_key";

-- AlterTable
ALTER TABLE "AIInsight" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Architect" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Builder" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "CompanyProfile" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Complaint" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Dealer" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "DealerActivity" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "LeadActivity" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "LeadCounter" DROP CONSTRAINT "LeadCounter_pkey",
DROP COLUMN "id",
ADD COLUMN     "organizationId" TEXT NOT NULL,
ADD CONSTRAINT "LeadCounter_pkey" PRIMARY KEY ("organizationId");

-- AlterTable
ALTER TABLE "LeadSource" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "LeadStatus" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "LeadType" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "MarketingCampaign" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "MarketingLeadAttribution" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "ProductCategory" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "ProductShade" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "ProjectActivity" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Quotation" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "QuotationCounter" DROP CONSTRAINT "QuotationCounter_pkey",
DROP COLUMN "id",
ADD COLUMN     "organizationId" TEXT NOT NULL,
ADD CONSTRAINT "QuotationCounter_pkey" PRIMARY KEY ("organizationId");

-- AlterTable
ALTER TABLE "QuotationItem" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "SalesExecutive" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "SalesTarget" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "SearchConsoleDaily" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "SearchConsoleTopQuery" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "WarrantyClaim" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "WebsiteAnalyticsDaily" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "AIInsight_organizationId_idx" ON "AIInsight"("organizationId");

-- CreateIndex
CREATE INDEX "Architect_organizationId_idx" ON "Architect"("organizationId");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_module_recordId_idx" ON "AuditLog"("organizationId", "module", "recordId");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_userId_createdAt_idx" ON "AuditLog"("organizationId", "userId", "createdAt");

-- CreateIndex
CREATE INDEX "Builder_organizationId_idx" ON "Builder"("organizationId");

-- CreateIndex
CREATE INDEX "CompanyProfile_organizationId_idx" ON "CompanyProfile"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Complaint_organizationId_complaintCode_key" ON "Complaint"("organizationId", "complaintCode");

-- CreateIndex
CREATE INDEX "Customer_organizationId_state_city_idx" ON "Customer"("organizationId", "state", "city");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_organizationId_customerCode_key" ON "Customer"("organizationId", "customerCode");

-- CreateIndex
CREATE INDEX "Dealer_organizationId_status_idx" ON "Dealer"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Dealer_organizationId_state_city_idx" ON "Dealer"("organizationId", "state", "city");

-- CreateIndex
CREATE UNIQUE INDEX "Dealer_organizationId_dealerCode_key" ON "Dealer"("organizationId", "dealerCode");

-- CreateIndex
CREATE INDEX "DealerActivity_organizationId_dealerId_occurredAt_idx" ON "DealerActivity"("organizationId", "dealerId", "occurredAt");

-- CreateIndex
CREATE INDEX "Lead_organizationId_statusId_idx" ON "Lead"("organizationId", "statusId");

-- CreateIndex
CREATE INDEX "Lead_organizationId_leadTypeId_idx" ON "Lead"("organizationId", "leadTypeId");

-- CreateIndex
CREATE INDEX "Lead_organizationId_assignedExecId_idx" ON "Lead"("organizationId", "assignedExecId");

-- CreateIndex
CREATE INDEX "Lead_organizationId_state_city_idx" ON "Lead"("organizationId", "state", "city");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_organizationId_leadCode_key" ON "Lead"("organizationId", "leadCode");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_organizationId_crmId_key" ON "Lead"("organizationId", "crmId");

-- CreateIndex
CREATE INDEX "LeadActivity_organizationId_leadId_occurredAt_idx" ON "LeadActivity"("organizationId", "leadId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "LeadSource_organizationId_name_key" ON "LeadSource"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "LeadSource_organizationId_crmId_key" ON "LeadSource"("organizationId", "crmId");

-- CreateIndex
CREATE UNIQUE INDEX "LeadStatus_organizationId_name_key" ON "LeadStatus"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "LeadStatus_organizationId_crmId_key" ON "LeadStatus"("organizationId", "crmId");

-- CreateIndex
CREATE UNIQUE INDEX "LeadType_organizationId_name_key" ON "LeadType"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "LeadType_organizationId_crmId_key" ON "LeadType"("organizationId", "crmId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingCampaign_organizationId_metaCampaignId_key" ON "MarketingCampaign"("organizationId", "metaCampaignId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingCampaign_organizationId_googleCampaignId_key" ON "MarketingCampaign"("organizationId", "googleCampaignId");

-- CreateIndex
CREATE INDEX "MarketingLeadAttribution_organizationId_idx" ON "MarketingLeadAttribution"("organizationId");

-- CreateIndex
CREATE INDEX "Notification_organizationId_userId_isRead_idx" ON "Notification"("organizationId", "userId", "isRead");

-- CreateIndex
CREATE INDEX "Order_organizationId_orderDate_idx" ON "Order"("organizationId", "orderDate");

-- CreateIndex
CREATE INDEX "Order_organizationId_dealerId_idx" ON "Order"("organizationId", "dealerId");

-- CreateIndex
CREATE INDEX "Order_organizationId_customerId_idx" ON "Order"("organizationId", "customerId");

-- CreateIndex
CREATE INDEX "Order_organizationId_salesExecId_idx" ON "Order"("organizationId", "salesExecId");

-- CreateIndex
CREATE INDEX "Order_organizationId_state_idx" ON "Order"("organizationId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "Order_organizationId_orderCode_key" ON "Order"("organizationId", "orderCode");

-- CreateIndex
CREATE INDEX "OrderItem_organizationId_orderId_idx" ON "OrderItem"("organizationId", "orderId");

-- CreateIndex
CREATE INDEX "OrderItem_organizationId_productId_idx" ON "OrderItem"("organizationId", "productId");

-- CreateIndex
CREATE INDEX "Product_organizationId_categoryId_idx" ON "Product"("organizationId", "categoryId");

-- CreateIndex
CREATE INDEX "Product_organizationId_shadeId_idx" ON "Product"("organizationId", "shadeId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_organizationId_sku_key" ON "Product"("organizationId", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "Product_organizationId_wcId_key" ON "Product"("organizationId", "wcId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCategory_organizationId_name_key" ON "ProductCategory"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ProductShade_organizationId_name_key" ON "ProductShade"("organizationId", "name");

-- CreateIndex
CREATE INDEX "Project_organizationId_stage_idx" ON "Project"("organizationId", "stage");

-- CreateIndex
CREATE INDEX "Project_organizationId_state_city_idx" ON "Project"("organizationId", "state", "city");

-- CreateIndex
CREATE INDEX "Project_organizationId_salesExecId_idx" ON "Project"("organizationId", "salesExecId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_organizationId_projectCode_key" ON "Project"("organizationId", "projectCode");

-- CreateIndex
CREATE INDEX "ProjectActivity_organizationId_projectId_occurredAt_idx" ON "ProjectActivity"("organizationId", "projectId", "occurredAt");

-- CreateIndex
CREATE INDEX "Quotation_organizationId_leadId_idx" ON "Quotation"("organizationId", "leadId");

-- CreateIndex
CREATE UNIQUE INDEX "Quotation_organizationId_quotationCode_key" ON "Quotation"("organizationId", "quotationCode");

-- CreateIndex
CREATE INDEX "QuotationItem_organizationId_quotationId_idx" ON "QuotationItem"("organizationId", "quotationId");

-- CreateIndex
CREATE INDEX "SalesExecutive_organizationId_idx" ON "SalesExecutive"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesExecutive_organizationId_employeeCode_key" ON "SalesExecutive"("organizationId", "employeeCode");

-- CreateIndex
CREATE INDEX "SalesTarget_organizationId_scope_periodStart_periodEnd_idx" ON "SalesTarget"("organizationId", "scope", "periodStart", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "SearchConsoleDaily_organizationId_date_key" ON "SearchConsoleDaily"("organizationId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "SearchConsoleTopQuery_organizationId_date_query_key" ON "SearchConsoleTopQuery"("organizationId", "date", "query");

-- CreateIndex
CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "User_organizationId_email_key" ON "User"("organizationId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "WarrantyClaim_organizationId_claimCode_key" ON "WarrantyClaim"("organizationId", "claimCode");

-- CreateIndex
CREATE UNIQUE INDEX "WebsiteAnalyticsDaily_organizationId_date_key" ON "WebsiteAnalyticsDaily"("organizationId", "date");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesExecutive" ADD CONSTRAINT "SalesExecutive_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadStatus" ADD CONSTRAINT "LeadStatus_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadSource" ADD CONSTRAINT "LeadSource_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadType" ADD CONSTRAINT "LeadType_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dealer" ADD CONSTRAINT "Dealer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealerActivity" ADD CONSTRAINT "DealerActivity_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Architect" ADD CONSTRAINT "Architect_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Builder" ADD CONSTRAINT "Builder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectActivity" ADD CONSTRAINT "ProjectActivity_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductShade" ADD CONSTRAINT "ProductShade_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesTarget" ADD CONSTRAINT "SalesTarget_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingCampaign" ADD CONSTRAINT "MarketingCampaign_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebsiteAnalyticsDaily" ADD CONSTRAINT "WebsiteAnalyticsDaily_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchConsoleDaily" ADD CONSTRAINT "SearchConsoleDaily_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchConsoleTopQuery" ADD CONSTRAINT "SearchConsoleTopQuery_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingLeadAttribution" ADD CONSTRAINT "MarketingLeadAttribution_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarrantyClaim" ADD CONSTRAINT "WarrantyClaim_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIInsight" ADD CONSTRAINT "AIInsight_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyProfile" ADD CONSTRAINT "CompanyProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationCounter" ADD CONSTRAINT "QuotationCounter_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadCounter" ADD CONSTRAINT "LeadCounter_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationItem" ADD CONSTRAINT "QuotationItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

