-- CreateEnum
CREATE TYPE "ChargeCategory" AS ENUM ('PROCEDURE', 'DOCTOR_VISIT', 'NURSING', 'OXYGEN', 'INVESTIGATION', 'CONSUMABLE', 'PHARMACY', 'OTHER');

-- AlterTable
ALTER TABLE "PrescriptionUpload" ADD COLUMN     "admissionId" TEXT;

-- CreateTable
CREATE TABLE "AdmissionCharge" (
    "id" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "category" "ChargeCategory" NOT NULL DEFAULT 'OTHER',
    "description" TEXT NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "gstRatePct" DECIMAL(4,2) NOT NULL DEFAULT 0,
    "sourceRef" TEXT,
    "addedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdmissionCharge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdmissionCharge_admissionId_idx" ON "AdmissionCharge"("admissionId");

-- AddForeignKey
ALTER TABLE "PrescriptionUpload" ADD CONSTRAINT "PrescriptionUpload_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionCharge" ADD CONSTRAINT "AdmissionCharge_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionCharge" ADD CONSTRAINT "AdmissionCharge_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
