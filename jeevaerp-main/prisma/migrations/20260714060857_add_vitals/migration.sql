-- CreateTable
CREATE TABLE "Vitals" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "bpSystolic" INTEGER,
    "bpDiastolic" INTEGER,
    "pulse" INTEGER,
    "tempF" DECIMAL(4,1),
    "spo2" INTEGER,
    "heightCm" DECIMAL(5,1),
    "weightKg" DECIMAL(5,1),
    "recordedById" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vitals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Vitals_appointmentId_key" ON "Vitals"("appointmentId");

-- AddForeignKey
ALTER TABLE "Vitals" ADD CONSTRAINT "Vitals_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vitals" ADD CONSTRAINT "Vitals_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
