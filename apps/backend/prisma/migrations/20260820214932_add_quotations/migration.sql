-- CreateEnum
CREATE TYPE "QuotationStatus" AS ENUM ('DRAFT', 'SENT', 'SEND_FAILED');

-- CreateEnum
CREATE TYPE "QuotationInputMode" AS ENUM ('MANUAL', 'CHAT_AI', 'VOICE_AI');

-- CreateTable
CREATE TABLE "CompanyProfile" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "name" TEXT NOT NULL,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "gstin" TEXT NOT NULL,
    "logoDataUrl" TEXT,
    "bankName" TEXT NOT NULL,
    "bankAccountNumber" TEXT NOT NULL,
    "bankIfsc" TEXT NOT NULL,
    "bankSwift" TEXT,
    "defaultTermsAndConditions" TEXT NOT NULL,
    "defaultAdvancePercent" INTEGER NOT NULL DEFAULT 50,
    "defaultBeforeDispatchPercent" INTEGER NOT NULL DEFAULT 50,
    "validityDays" INTEGER NOT NULL DEFAULT 30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CompanyProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotationCounter" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "seq" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "QuotationCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quotation" (
    "id" TEXT NOT NULL,
    "quotationCode" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "companyProfileId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerCompany" TEXT,
    "customerAddress" TEXT NOT NULL,
    "customerState" TEXT NOT NULL,
    "customerGstin" TEXT,
    "customerContact" TEXT NOT NULL,
    "quotationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "subtotal" DECIMAL(14,2) NOT NULL,
    "gstAmount" DECIMAL(14,2) NOT NULL,
    "roundoff" DECIMAL(14,2) NOT NULL,
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "advancePercent" INTEGER NOT NULL,
    "beforeDispatchPercent" INTEGER NOT NULL,
    "advanceAmount" DECIMAL(14,2) NOT NULL,
    "beforeDispatchAmount" DECIMAL(14,2) NOT NULL,
    "termsAndConditions" TEXT NOT NULL,
    "status" "QuotationStatus" NOT NULL DEFAULT 'DRAFT',
    "inputMode" "QuotationInputMode" NOT NULL,
    "rawInputText" TEXT,
    "pdfPath" TEXT,
    "sentToPhone" TEXT,
    "whatsappMessageId" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotationItem" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "srNo" INTEGER NOT NULL,
    "productId" TEXT,
    "itemName" TEXT NOT NULL,
    "hsnCode" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitRate" DECIMAL(10,2) NOT NULL,
    "taxPercent" DECIMAL(5,2) NOT NULL DEFAULT 18,
    "lineAmount" DECIMAL(14,2) NOT NULL,
    "lineTax" DECIMAL(14,2) NOT NULL,
    "lineTotal" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "QuotationItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Quotation_quotationCode_key" ON "Quotation"("quotationCode");

-- CreateIndex
CREATE INDEX "Quotation_leadId_idx" ON "Quotation"("leadId");

-- CreateIndex
CREATE INDEX "QuotationItem_quotationId_idx" ON "QuotationItem"("quotationId");

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_companyProfileId_fkey" FOREIGN KEY ("companyProfileId") REFERENCES "CompanyProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "SalesExecutive"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationItem" ADD CONSTRAINT "QuotationItem_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationItem" ADD CONSTRAINT "QuotationItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
