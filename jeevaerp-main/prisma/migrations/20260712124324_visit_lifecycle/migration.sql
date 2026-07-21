-- DropForeignKey
ALTER TABLE "Appointment" DROP CONSTRAINT "Appointment_slotId_fkey";

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "timeAtBooking" TEXT NOT NULL DEFAULT '00:00',
ALTER COLUMN "slotId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "DoctorSlot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
