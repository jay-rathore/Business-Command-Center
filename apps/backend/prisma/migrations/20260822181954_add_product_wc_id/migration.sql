-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "wcId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Product_wcId_key" ON "Product"("wcId");
