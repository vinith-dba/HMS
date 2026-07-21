import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { storeFile } from "@/lib/storage";
import { logAudit } from "./audit.service";
import { opdPrintData } from "./appointments.service";
import { generateOpdPdf } from "@/server/print/opd-pdf";
import type { AuthUser } from "@/lib/auth/types";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

export interface PrescriptionUploadDTO {
  id: string;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  title: string | null;
  status: string;
  createdAt: string;
  appointment: { opNumber: string; visitDate: string; doctorName: string } | null;
}

/**
 * Reception uploads a scanned prescription. Validates type/size, stores the
 * file (Cloudinary or local), and records a row linked to BOTH the patient and
 * (optionally) the appointment — so the patient sees it in their profile by UHID.
 */
export async function uploadPrescription(
  actor: AuthUser,
  input: {
    patientId: string;
    appointmentId?: string;
  admissionId?: string;   // an INPATIENT Rx belongs to the stay, not a visit
    title?: string;
    file: { buffer: Buffer; fileName: string; mimeType: string; size: number };
    /** Medicines transcribed by reception from the handwriting — this is what
     *  lets the pharmacy pre-pick before the patient reaches the counter. */
    items?: { medicineName: string; medicineId?: string; qty?: number; dosage?: string }[];
    /** Upload and dispatch to the pharmacy queue in one motion. */
    sendNow?: boolean;
  },
  ctx: { ipAddress?: string; userAgent?: string }
): Promise<PrescriptionUploadDTO> {
  if (!ALLOWED.has(input.file.mimeType)) {
    throw new ApiError(400, "Only PDF, JPG, PNG or WebP files are allowed");
  }
  if (input.file.size > MAX_BYTES) {
    throw new ApiError(400, "File too large (max 10 MB)");
  }

  // Patient must exist.
  const patient = await prisma.patient.findUnique({
    where: { id: input.patientId },
    select: { id: true, mergedIntoId: true, deletedAt: true },
  });
  if (!patient || patient.mergedIntoId || patient.deletedAt) {
    throw new ApiError(404, "Patient not found");
  }

  // If an appointment is given, it must belong to this patient. We also
  // snapshot the doctor's name — that's whose handwriting this is.
  let doctorName: string | null = null;
  if (input.appointmentId) {
    const appt = await prisma.appointment.findUnique({
      where: { id: input.appointmentId },
      select: { patientId: true, doctor: { select: { name: true } } },
    });
    if (!appt || appt.patientId !== input.patientId) {
      throw new ApiError(400, "That appointment doesn't belong to this patient");
    }
    doctorName = appt.doctor.name;
  }

  // An inpatient Rx hangs off the STAY. Same ownership check, same doctor
  // snapshot — this time the attending doctor whose round produced the chit.
  if (input.admissionId) {
    const adm = await prisma.admission.findUnique({
      where: { id: input.admissionId },
      select: { patientId: true, status: true, doctor: { select: { name: true } } },
    });
    if (!adm || adm.patientId !== input.patientId) {
      throw new ApiError(400, "That admission doesn't belong to this patient");
    }
    if (adm.status !== "ADMITTED") throw new ApiError(409, "That patient is already discharged");
    doctorName = adm.doctor.name;
  }

  const stored = await storeFile(input.file.buffer, {
    fileName: input.file.fileName,
    mimeType: input.file.mimeType,
  });

  const cleanItems = (input.items ?? [])
    .map((it) => ({
      medicineName: it.medicineName.trim(),
      medicineId: it.medicineId || null,
      qty: Math.max(1, Math.floor(it.qty ?? 1)),
      dosage: it.dosage?.trim() || null,
    }))
    .filter((it) => it.medicineName.length > 0);

  const row = await prisma.prescriptionUpload.create({
    data: {
      patientId: input.patientId,
      appointmentId: input.appointmentId ?? null,
      admissionId: input.admissionId ?? null,
      fileUrl: stored.fileUrl,
      storage: stored.storage,
      fileName: input.file.fileName,
      mimeType: input.file.mimeType,
      fileSize: input.file.size,
      title: input.title?.trim() || null,
      uploadedById: actor.id,
      doctorName,
      ...(input.sendNow ? { status: "SENT_TO_PHARMACY", sentToPharmacyAt: new Date() } : {}),
      ...(cleanItems.length ? { items: { create: cleanItems } } : {}),
    },
    select: {
      id: true, fileUrl: true, fileName: true, mimeType: true, fileSize: true,
      title: true, status: true, createdAt: true,
      appointment: { select: { opNumber: true, visitDate: true, doctor: { select: { name: true } } } },
    },
  });

  await logAudit(actor, {
    action: input.sendNow ? "PRESCRIPTION_UPLOADED_AND_SENT" : "PRESCRIPTION_UPLOADED",
    targetTable: "PrescriptionUpload",
    targetId: row.id,
    meta: { patientId: input.patientId },
    ...ctx,
  });

  return toDTO(row);
}

function toDTO(row: {
  id: string; fileUrl: string; fileName: string; mimeType: string; fileSize: number;
  title: string | null;
  status: string; createdAt: Date;
  appointment: { opNumber: string; visitDate: Date; doctor: { name: string } } | null;
}): PrescriptionUploadDTO {
  return {
    id: row.id, fileUrl: row.fileUrl, fileName: row.fileName, mimeType: row.mimeType,
    fileSize: row.fileSize, title: row.title, status: row.status, createdAt: row.createdAt.toISOString(),
    appointment: row.appointment
      ? { opNumber: row.appointment.opNumber, visitDate: row.appointment.visitDate.toISOString().slice(0, 10), doctorName: row.appointment.doctor.name }
      : null,
  };
}

/**
 * Send the OPD prescription *sheet itself* — no scan needed.
 *
 * Instead of asking reception to photograph the doctor's paper, this renders
 * the same OPD stationery they'd print (letterhead, patient block, vitals and
 * the typed medicines) into a proper PDF, files it against the patient + visit,
 * and — when sendNow — drops it straight into the pharmacy queue. Because the
 * record is linked to the patient by UHID, it's on the patient's own record too
 * (their copy). The old scan-upload path still exists; this just doesn't need it.
 */
export async function sendOpdSheetToPharmacy(
  actor: AuthUser,
  input: {
    appointmentId: string;
    items: { medicineName: string; medicineId?: string; qty?: number; dosage?: string }[];
    title?: string;
    sendNow?: boolean;
    diagnosis?: string;
    advice?: string;
    nextVisit?: string;
    labs?: string[];
  },
  ctx: { ipAddress?: string; userAgent?: string }
): Promise<PrescriptionUploadDTO> {
  // Ownership + a name to stamp on the sheet as "whose handwriting this is".
  const appt = await prisma.appointment.findUnique({
    where: { id: input.appointmentId },
    select: {
      patientId: true,
      patient: { select: { mergedIntoId: true, deletedAt: true } },
      doctor: { select: { name: true } },
    },
  });
  if (!appt || appt.patient.mergedIntoId || appt.patient.deletedAt) {
    throw new ApiError(404, "Appointment not found");
  }

  const cleanItems = (input.items ?? [])
    .map((it) => ({
      medicineName: it.medicineName.trim(),
      medicineId: it.medicineId || null,
      qty: Math.max(1, Math.floor(it.qty ?? 1)),
      dosage: it.dosage?.trim() || null,
    }))
    .filter((it) => it.medicineName.length > 0);

  const labs = (input.labs ?? []).map((s) => s.trim()).filter(Boolean);
  const clinical = {
    diagnosis: input.diagnosis?.trim() || null,
    advice: input.advice?.trim() || null,
    nextVisit: input.nextVisit?.trim() || null,
    labs,
  };

  // Same bundle the printed OPD sheet is built from (hospital, patient, doctor,
  // visit, vitals). We override its rxItems with what reception just typed —
  // those aren't persisted anywhere yet, so they can't be read back.
  const bundle = await opdPrintData(input.appointmentId);

  const pdf = await generateOpdPdf({
    hospital: bundle.hospital,
    appointment: {
      opNumber: bundle.appointment.opNumber,
      visitDate: bundle.appointment.visitDate,
      time: bundle.appointment.time,
      referredByName: bundle.appointment.referredByName,
      visitNumber: bundle.appointment.visitNumber,
    },
    doctor: bundle.doctor,
    patient: bundle.patient,
    items: cleanItems.map((it) => ({ medicineName: it.medicineName, qty: it.qty, dosage: it.dosage })),
    vitals: bundle.vitals,
    clinical,
  });

  const fileName = `OPD-${bundle.appointment.opNumber}.pdf`;
  const stored = await storeFile(pdf, { fileName, mimeType: "application/pdf" });

  const row = await prisma.prescriptionUpload.create({
    data: {
      patientId: appt.patientId,
      appointmentId: input.appointmentId,
      fileUrl: stored.fileUrl,
      storage: stored.storage,
      fileName,
      mimeType: "application/pdf",
      fileSize: pdf.length,
      title: input.title?.trim() || null,
      uploadedById: actor.id,
      doctorName: appt.doctor.name,
      diagnosis: clinical.diagnosis,
      advice: clinical.advice,
      labsAdvised: labs.length ? labs.join("\n") : null,
      nextVisit: clinical.nextVisit,
      ...(input.sendNow ? { status: "SENT_TO_PHARMACY", sentToPharmacyAt: new Date() } : {}),
      ...(cleanItems.length ? { items: { create: cleanItems } } : {}),
    },
    select: {
      id: true, fileUrl: true, fileName: true, mimeType: true, fileSize: true,
      title: true, status: true, createdAt: true,
      appointment: { select: { opNumber: true, visitDate: true, doctor: { select: { name: true } } } },
    },
  });

  await logAudit(actor, {
    action: input.sendNow ? "OPD_SHEET_SENT_TO_PHARMACY" : "OPD_SHEET_SAVED",
    targetTable: "PrescriptionUpload",
    targetId: row.id,
    meta: { patientId: appt.patientId, appointmentId: input.appointmentId, generated: true },
    ...ctx,
  });

  return toDTO(row);
}

/** All uploaded prescriptions for a patient (newest first). */
export async function listPatientPrescriptions(patientId: string): Promise<PrescriptionUploadDTO[]> {
  const rows = await prisma.prescriptionUpload.findMany({
    where: { patientId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, fileUrl: true, fileName: true, mimeType: true, fileSize: true,
      title: true, status: true, createdAt: true,
      appointment: { select: { opNumber: true, visitDate: true, doctor: { select: { name: true } } } },
    },
  });
  return rows.map(toDTO);
}

/** Replace the file on an existing prescription upload (keeps the same record). */
export async function replacePrescriptionFile(
  actor: AuthUser,
  input: { id: string; title?: string; file?: { buffer: Buffer; fileName: string; mimeType: string; size: number } },
  ctx: { ipAddress?: string; userAgent?: string }
): Promise<PrescriptionUploadDTO> {
  const existing = await prisma.prescriptionUpload.findUnique({ where: { id: input.id }, select: { id: true } });
  if (!existing) throw new ApiError(404, "Prescription not found");

  const data: Record<string, unknown> = {};
  if (input.title !== undefined) data.title = input.title.trim() || null;

  if (input.file) {
    if (!ALLOWED.has(input.file.mimeType)) throw new ApiError(400, "Only PDF, JPG, PNG or WebP files are allowed");
    if (input.file.size > MAX_BYTES) throw new ApiError(400, "File too large (max 10 MB)");
    const stored = await storeFile(input.file.buffer, { fileName: input.file.fileName, mimeType: input.file.mimeType });
    data.fileUrl = stored.fileUrl;
    data.storage = stored.storage;
    data.fileName = input.file.fileName;
    data.mimeType = input.file.mimeType;
    data.fileSize = input.file.size;
  }
  if (Object.keys(data).length === 0) throw new ApiError(400, "Nothing to update");

  const row = await prisma.prescriptionUpload.update({
    where: { id: input.id },
    data,
    select: {
      id: true, fileUrl: true, fileName: true, mimeType: true, fileSize: true, title: true, status: true, createdAt: true,
      appointment: { select: { opNumber: true, visitDate: true, doctor: { select: { name: true } } } },
    },
  });
  await logAudit(actor, { action: "PRESCRIPTION_REPLACED", targetTable: "PrescriptionUpload", targetId: input.id, ...ctx });
  return toDTO(row);
}

/** Delete a prescription upload record (reception/admin). */
export async function deletePrescription(
  actor: AuthUser,
  id: string,
  ctx: { ipAddress?: string; userAgent?: string }
): Promise<void> {
  const existing = await prisma.prescriptionUpload.findUnique({ where: { id }, select: { id: true, patientId: true } });
  if (!existing) throw new ApiError(404, "Prescription not found");
  await prisma.prescriptionUpload.delete({ where: { id } });
  await logAudit(actor, { action: "PRESCRIPTION_DELETED", targetTable: "PrescriptionUpload", targetId: id, meta: { patientId: existing.patientId }, ...ctx });
}

/**
 * Dispatch a scanned handwritten prescription to the pharmacy queue.
 * This is the hand-off: the doctor wrote it on paper, reception scanned it,
 * and now the pharmacist can see it and dispense against it.
 */
export async function sendToPharmacy(
  actor: AuthUser,
  id: string,
  ctx: { ipAddress?: string; userAgent?: string }
): Promise<void> {
  const rx = await prisma.prescriptionUpload.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!rx) throw new ApiError(404, "Prescription not found");
  if (rx.status === "DISPENSED") throw new ApiError(400, "This prescription has already been dispensed");
  if (rx.status === "SENT_TO_PHARMACY") throw new ApiError(400, "This is already in the pharmacy queue");

  await prisma.prescriptionUpload.update({
    where: { id },
    data: { status: "SENT_TO_PHARMACY", sentToPharmacyAt: new Date() },
  });
  await logAudit(actor, { action: "RX_SENT_TO_PHARMACY", targetTable: "PrescriptionUpload", targetId: id, ...ctx });
}

/** Pull a scan back out of the pharmacy queue (sent by mistake). */
export async function recallFromPharmacy(
  actor: AuthUser,
  id: string,
  ctx: { ipAddress?: string; userAgent?: string }
): Promise<void> {
  const rx = await prisma.prescriptionUpload.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!rx) throw new ApiError(404, "Prescription not found");
  if (rx.status === "DISPENSED") throw new ApiError(400, "Already dispensed — it can't be recalled");

  await prisma.prescriptionUpload.update({
    where: { id },
    data: { status: "UPLOADED", sentToPharmacyAt: null },
  });
  await logAudit(actor, { action: "RX_RECALLED", targetTable: "PrescriptionUpload", targetId: id, ...ctx });
}


/**
 * The patient's recent COMPLETED consultations — reception links the scan to
 * one of these so the record shows whose handwriting it is and which visit
 * it belongs to.
 */
export async function recentCompletedVisits(displayId: string): Promise<{
  id: string; opNumber: string; visitDate: string; doctorName: string; department: string;
}[]> {
  const patient = await prisma.patient.findUnique({
    where: { displayId: displayId.toUpperCase() },
    select: { id: true, mergedIntoId: true, deletedAt: true },
  });
  if (!patient || patient.mergedIntoId || patient.deletedAt) throw new ApiError(404, "Patient not found");

  const rows = await prisma.appointment.findMany({
    where: { patientId: patient.id, status: "COMPLETED" },
    orderBy: { visitDate: "desc" },
    take: 6,
    select: {
      id: true, opNumber: true, visitDate: true,
      doctor: { select: { name: true, department: true } },
    },
  });

  return rows.map((r: { id: string; opNumber: string; visitDate: Date; doctor: { name: string; department: string } }) => ({
    id: r.id,
    opNumber: r.opNumber,
    visitDate: r.visitDate.toISOString().slice(0, 10),
    doctorName: r.doctor.name,
    department: r.doctor.department,
  }));
}
