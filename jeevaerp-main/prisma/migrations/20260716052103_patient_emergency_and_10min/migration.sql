-- AlterTable
ALTER TABLE "DoctorSchedule" ALTER COLUMN "slotDurationMin" SET DEFAULT 10;

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "allergies" TEXT,
ADD COLUMN     "emergencyContactName" TEXT,
ADD COLUMN     "emergencyContactPhone" TEXT,
ADD COLUMN     "emergencyContactRelation" TEXT,
ADD COLUMN     "govtIdNumber" TEXT;
