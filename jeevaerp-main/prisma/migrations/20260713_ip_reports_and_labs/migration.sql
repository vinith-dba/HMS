-- An inpatient's lab tests belong to the STAY, not an outpatient visit.
-- Nullable: every existing lab test is an OP test and stays exactly as it is.
ALTER TABLE "LabTest" ADD COLUMN "admissionId" TEXT;

ALTER TABLE "LabTest"
  ADD CONSTRAINT "LabTest_admissionId_fkey"
  FOREIGN KEY ("admissionId") REFERENCES "Admission"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "LabTest_admissionId_idx" ON "LabTest"("admissionId");
