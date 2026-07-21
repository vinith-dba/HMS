-- CreateEnum
CREATE TYPE "ClaimType" AS ENUM ('CASHLESS', 'REIMBURSEMENT');

-- CreateEnum
CREATE TYPE "ClaimStage" AS ENUM ('PRE_AUTH', 'FINAL');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'QUERIED', 'APPROVED', 'PARTIALLY_APPROVED', 'REJECTED', 'SETTLED', 'CLOSED');

-- CreateTable
CREATE TABLE "InsuranceClaim" (
    "id" TEXT NOT NULL,
    "claimNo" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "admissionId" TEXT,
    "invoiceId" TEXT,
    "insurer" TEXT NOT NULL,
    "policyNo" TEXT NOT NULL,
    "memberId" TEXT,
    "sumInsured" DECIMAL(12,2),
    "type" "ClaimType" NOT NULL DEFAULT 'CASHLESS',
    "stage" "ClaimStage" NOT NULL DEFAULT 'PRE_AUTH',
    "status" "ClaimStatus" NOT NULL DEFAULT 'DRAFT',
    "diagnosis" TEXT,
    "claimedAmount" DECIMAL(12,2) NOT NULL,
    "approvedAmount" DECIMAL(12,2),
    "settledAmount" DECIMAL(12,2),
    "insurerRef" TEXT,
    "remarks" TEXT,
    "submittedAt" TIMESTAMP(3),
    "decisionAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsuranceClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaimEvent" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "detail" TEXT,
    "amount" DECIMAL(12,2),
    "byId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClaimEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InsuranceClaim_claimNo_key" ON "InsuranceClaim"("claimNo");

-- CreateIndex
CREATE INDEX "InsuranceClaim_status_createdAt_idx" ON "InsuranceClaim"("status", "createdAt");

-- CreateIndex
CREATE INDEX "InsuranceClaim_patientId_idx" ON "InsuranceClaim"("patientId");

-- CreateIndex
CREATE INDEX "ClaimEvent_claimId_createdAt_idx" ON "ClaimEvent"("claimId", "createdAt");

-- AddForeignKey
ALTER TABLE "InsuranceClaim" ADD CONSTRAINT "InsuranceClaim_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceClaim" ADD CONSTRAINT "InsuranceClaim_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimEvent" ADD CONSTRAINT "ClaimEvent_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "InsuranceClaim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimEvent" ADD CONSTRAINT "ClaimEvent_byId_fkey" FOREIGN KEY ("byId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
