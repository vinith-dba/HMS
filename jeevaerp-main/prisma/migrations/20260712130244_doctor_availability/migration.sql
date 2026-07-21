-- AlterTable
ALTER TABLE "DoctorSlot" ADD COLUMN     "blockReason" TEXT,
ADD COLUMN     "isBlocked" BOOLEAN NOT NULL DEFAULT false;
