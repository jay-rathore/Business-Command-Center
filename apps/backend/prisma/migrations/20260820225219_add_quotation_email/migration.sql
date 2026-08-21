-- CreateEnum
CREATE TYPE "QuotationEmailStatus" AS ENUM ('SENT', 'FAILED');

-- AlterTable
ALTER TABLE "Quotation" ADD COLUMN     "emailSentAt" TIMESTAMP(3),
ADD COLUMN     "emailSentTo" TEXT,
ADD COLUMN     "emailStatus" "QuotationEmailStatus";
