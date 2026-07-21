-- CreateEnum
CREATE TYPE "BedStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "AdmissionStatus" AS ENUM ('ADMITTED', 'DISCHARGED');

-- AlterEnum
ALTER TYPE "InvoiceSource" ADD VALUE 'IPD';

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "admissionId" TEXT;

-- CreateTable
CREATE TABLE "PrescriptionUploadItem" (
    "id" TEXT NOT NULL,
    "uploadId" TEXT NOT NULL,
    "medicineName" TEXT NOT NULL,
    "medicineId" TEXT,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "dosage" TEXT,

    CONSTRAINT "PrescriptionUploadItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ward" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "floor" TEXT,
    "dailyCharge" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "gstRatePct" DECIMAL(4,2) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Ward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bed" (
    "id" TEXT NOT NULL,
    "wardId" TEXT NOT NULL,
    "bedNo" TEXT NOT NULL,
    "status" "BedStatus" NOT NULL DEFAULT 'AVAILABLE',

    CONSTRAINT "Bed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Admission" (
    "id" TEXT NOT NULL,
    "ipNumber" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "bedId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "reason" TEXT,
    "attendantName" TEXT,
    "attendantPhone" TEXT,
    "attendantRelation" TEXT,
    "dailyChargeAtAdmit" DECIMAL(10,2) NOT NULL,
    "wardNameAtAdmit" TEXT NOT NULL,
    "gstRatePctAtAdmit" DECIMAL(4,2) NOT NULL DEFAULT 0,
    "status" "AdmissionStatus" NOT NULL DEFAULT 'ADMITTED',
    "admittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dischargedAt" TIMESTAMP(3),
    "admittedById" TEXT NOT NULL,
    "dischargedById" TEXT,
    "notes" TEXT,

    CONSTRAINT "Admission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrescriptionUploadItem_uploadId_idx" ON "PrescriptionUploadItem"("uploadId");

-- CreateIndex
CREATE UNIQUE INDEX "Ward_name_key" ON "Ward"("name");

-- CreateIndex
CREATE INDEX "Bed_wardId_status_idx" ON "Bed"("wardId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Bed_wardId_bedNo_key" ON "Bed"("wardId", "bedNo");

-- CreateIndex
CREATE UNIQUE INDEX "Admission_ipNumber_key" ON "Admission"("ipNumber");

-- CreateIndex
CREATE INDEX "Admission_status_admittedAt_idx" ON "Admission"("status", "admittedAt");

-- CreateIndex
CREATE INDEX "Admission_patientId_idx" ON "Admission"("patientId");

-- AddForeignKey
ALTER TABLE "PrescriptionUploadItem" ADD CONSTRAINT "PrescriptionUploadItem_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "PrescriptionUpload"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrescriptionUploadItem" ADD CONSTRAINT "PrescriptionUploadItem_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "Medicine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bed" ADD CONSTRAINT "Bed_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Admission" ADD CONSTRAINT "Admission_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Admission" ADD CONSTRAINT "Admission_bedId_fkey" FOREIGN KEY ("bedId") REFERENCES "Bed"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Admission" ADD CONSTRAINT "Admission_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
