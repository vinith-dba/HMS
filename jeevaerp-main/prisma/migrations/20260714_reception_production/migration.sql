-- ─────────────────────────────────────────────────────────────────────────────
-- RECEPTION → PRODUCTION
--   Refund            money going back to a patient, with a reason and an author
--   BedStay           one row per bed occupied — a stay can now cross wards
--   AdmissionAdvance  the deposit taken at admission
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE "Refund" (
    "id"           TEXT NOT NULL,
    "invoiceId"    TEXT NOT NULL,
    "mode"         "PaymentMode" NOT NULL,
    "amount"       DECIMAL(10,2) NOT NULL,
    "reason"       TEXT NOT NULL,
    "reference"    TEXT,
    "refundedById" TEXT NOT NULL,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Refund_invoiceId_idx" ON "Refund"("invoiceId");
CREATE INDEX "Refund_createdAt_idx" ON "Refund"("createdAt");
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_refundedById_fkey"
  FOREIGN KEY ("refundedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "BedStay" (
    "id"          TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "bedId"       TEXT NOT NULL,
    "wardName"    TEXT NOT NULL,
    "dailyCharge" DECIMAL(10,2) NOT NULL,
    "gstRatePct"  DECIMAL(5,2) NOT NULL DEFAULT 0,
    "fromDate"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "toDate"      TIMESTAMP(3),
    "reason"      TEXT,
    "movedById"   TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BedStay_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BedStay_admissionId_idx" ON "BedStay"("admissionId");
CREATE INDEX "BedStay_bedId_idx" ON "BedStay"("bedId");
ALTER TABLE "BedStay" ADD CONSTRAINT "BedStay_admissionId_fkey"
  FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BedStay" ADD CONSTRAINT "BedStay_bedId_fkey"
  FOREIGN KEY ("bedId") REFERENCES "Bed"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BedStay" ADD CONSTRAINT "BedStay_movedById_fkey"
  FOREIGN KEY ("movedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "AdmissionAdvance" (
    "id"           TEXT NOT NULL,
    "admissionId"  TEXT NOT NULL,
    "mode"         "PaymentMode" NOT NULL,
    "amount"       DECIMAL(10,2) NOT NULL,
    "reference"    TEXT,
    "receivedById" TEXT NOT NULL,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdmissionAdvance_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AdmissionAdvance_admissionId_idx" ON "AdmissionAdvance"("admissionId");
ALTER TABLE "AdmissionAdvance" ADD CONSTRAINT "AdmissionAdvance_admissionId_fkey"
  FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdmissionAdvance" ADD CONSTRAINT "AdmissionAdvance_receivedById_fkey"
  FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── BACKFILL ────────────────────────────────────────────────────────────────
-- Discharge will now bill from BedStay rows. An existing admission has none, so
-- it would bill ZERO days. Give every admission the bed stay it has implicitly
-- had all along, reconstructed from the snapshot already on the row.
INSERT INTO "BedStay" ("id", "admissionId", "bedId", "wardName", "dailyCharge", "gstRatePct", "fromDate", "toDate", "movedById", "createdAt")
SELECT
    'bs_' || a."id",
    a."id",
    a."bedId",
    a."wardNameAtAdmit",
    a."dailyChargeAtAdmit",
    COALESCE(w."gstRatePct", 0),
    a."admittedAt",
    a."dischargedAt",            -- NULL for anyone still admitted = current bed
    a."admittedById",
    a."admittedAt"
FROM "Admission" a
LEFT JOIN "Bed"  b ON b."id" = a."bedId"
LEFT JOIN "Ward" w ON w."id" = b."wardId";
