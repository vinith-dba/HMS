/*
  Warnings:

  - You are about to drop the column `name` on the `Patient` table. All the data in the column will be lost.
  - You are about to drop the column `referredById` on the `Patient` table. All the data in the column will be lost.
  - You are about to drop the `ReferringDoctor` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[uuid]` on the table `Patient` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[username]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `priceAtBooking` to the `Appointment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `firstName` to the `Patient` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fullName` to the `Patient` table without a default value. This is not possible if the table is not empty.
  - The required column `uuid` was added to the `Patient` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - Added the required column `username` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "MaritalStatus" AS ENUM ('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED', 'OTHER');

-- DropForeignKey
ALTER TABLE "Otp" DROP CONSTRAINT "Otp_patientId_fkey";

-- DropForeignKey
ALTER TABLE "Patient" DROP CONSTRAINT "Patient_referredById_fkey";

-- DropIndex
DROP INDEX "Patient_name_idx";

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "priceAtBooking" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "referralSource" TEXT,
ADD COLUMN     "referredByName" TEXT;

-- AlterTable
ALTER TABLE "Otp" ADD COLUMN     "destination" TEXT,
ADD COLUMN     "userId" TEXT,
ALTER COLUMN "patientId" DROP NOT NULL,
ALTER COLUMN "phone" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Patient" DROP COLUMN "name",
DROP COLUMN "referredById",
ADD COLUMN     "alternatePhone" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT DEFAULT 'India',
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "deceasedAt" TIMESTAMP(3),
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "email" TEXT,
ADD COLUMN     "firstName" TEXT NOT NULL,
ADD COLUMN     "fullName" TEXT NOT NULL,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isDeceased" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isVip" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "maritalStatus" "MaritalStatus",
ADD COLUMN     "middleName" TEXT,
ADD COLUMN     "nationality" TEXT,
ADD COLUMN     "occupation" TEXT,
ADD COLUMN     "photoUrl" TEXT,
ADD COLUMN     "postalCode" TEXT,
ADD COLUMN     "preferredLanguage" TEXT,
ADD COLUMN     "referralSource" TEXT,
ADD COLUMN     "referredByName" TEXT,
ADD COLUMN     "remarks" TEXT,
ADD COLUMN     "state" TEXT,
ADD COLUMN     "updatedById" TEXT,
ADD COLUMN     "uuid" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "username" TEXT NOT NULL;

-- DropTable
DROP TABLE "ReferringDoctor";

-- CreateIndex
CREATE INDEX "Otp_userId_createdAt_idx" ON "Otp"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_uuid_key" ON "Patient"("uuid");

-- CreateIndex
CREATE INDEX "Patient_displayId_idx" ON "Patient"("displayId");

-- CreateIndex
CREATE INDEX "Patient_uuid_idx" ON "Patient"("uuid");

-- CreateIndex
CREATE INDEX "Patient_fullName_idx" ON "Patient"("fullName");

-- CreateIndex
CREATE INDEX "Patient_dob_idx" ON "Patient"("dob");

-- CreateIndex
CREATE INDEX "Patient_isActive_idx" ON "Patient"("isActive");

-- CreateIndex
CREATE INDEX "Patient_createdAt_idx" ON "Patient"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- AddForeignKey
ALTER TABLE "Otp" ADD CONSTRAINT "Otp_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Otp" ADD CONSTRAINT "Otp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
