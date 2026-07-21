-- CreateEnum
CREATE TYPE "PrescriptionStatus" AS ENUM ('UPLOADED', 'SENT_TO_PHARMACY', 'DISPENSED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "prescriptionUploadId" TEXT;

-- AlterTable
ALTER TABLE "PrescriptionUpload" ADD COLUMN     "dispensedAt" TIMESTAMP(3),
ADD COLUMN     "dispensedById" TEXT,
ADD COLUMN     "doctorName" TEXT,
ADD COLUMN     "sentToPharmacyAt" TIMESTAMP(3),
ADD COLUMN     "status" "PrescriptionStatus" NOT NULL DEFAULT 'UPLOADED';

-- CreateIndex
CREATE INDEX "PrescriptionUpload_status_sentToPharmacyAt_idx" ON "PrescriptionUpload"("status", "sentToPharmacyAt");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_prescriptionUploadId_fkey" FOREIGN KEY ("prescriptionUploadId") REFERENCES "PrescriptionUpload"("id") ON DELETE SET NULL ON UPDATE CASCADE;
