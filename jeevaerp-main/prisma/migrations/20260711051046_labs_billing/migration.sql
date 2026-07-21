-- DropForeignKey
ALTER TABLE "LabTest" DROP CONSTRAINT "LabTest_appointmentId_fkey";

-- AlterTable
ALTER TABLE "LabTest" ADD COLUMN     "patientId" TEXT,
ALTER COLUMN "appointmentId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "HospitalConfig" (
    "id" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "addressLine" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "stateCode" TEXT NOT NULL DEFAULT '36',
    "pincode" TEXT NOT NULL,
    "gstin" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "defaultLabGstPct" DECIMAL(4,2) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HospitalConfig_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "LabTest" ADD CONSTRAINT "LabTest_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabTest" ADD CONSTRAINT "LabTest_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
