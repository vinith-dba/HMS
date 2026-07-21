-- CreateTable
CREATE TABLE "PrescriptionUpload" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "fileUrl" TEXT NOT NULL,
    "storage" TEXT NOT NULL DEFAULT 'local',
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "title" TEXT,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrescriptionUpload_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrescriptionUpload_patientId_createdAt_idx" ON "PrescriptionUpload"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "PrescriptionUpload_appointmentId_idx" ON "PrescriptionUpload"("appointmentId");

-- AddForeignKey
ALTER TABLE "PrescriptionUpload" ADD CONSTRAINT "PrescriptionUpload_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrescriptionUpload" ADD CONSTRAINT "PrescriptionUpload_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
