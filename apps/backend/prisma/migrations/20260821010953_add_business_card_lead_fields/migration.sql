-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "address" TEXT,
ADD COLUMN     "businessCardImagePath" TEXT,
ADD COLUMN     "website" TEXT;

-- CreateTable
CREATE TABLE "LeadCounter" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "seq" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LeadCounter_pkey" PRIMARY KEY ("id")
);
