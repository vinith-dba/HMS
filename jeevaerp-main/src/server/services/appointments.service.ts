import { prisma } from "@/lib/prisma";
import { nextId } from "@/lib/ids";
import { ApiError } from "@/lib/api";
import { logAudit } from "./audit.service";
import { createInvoice } from "./billing.service";
import type { AuthUser } from "@/lib/auth/types";
import type { Prisma } from "@prisma/client";

export interface DoctorDTO {
  id: string; name: string; specialization: string; department: string; fee: string;
  qualification: string | null; experienceYears: number | null; age: number | null;
  languages: string | null; photoUrl: string | null; bio: string | null;
}
export interface SlotDTO { id: string; startTime: string; endTime: string; }

/** Reception-facing appointment (NO referral fields — those are admin-only). */
export interface AppointmentDTO {
  checkedInAt?: string | null;
  id: string; opNumber: string; time: string; status: string; type: string; price: string;
  patient: { id: string; displayId: string; name: string };
  doctor: { id: string; name: string; department: string };
}

/** Admin-facing appointment — INCLUDES the referral snapshot. */
export interface AdminAppointmentDTO extends AppointmentDTO {
  visitDate: string;
  referredByName: string | null;
  referralSource: string | null;
  /** Most recent invoice raised against this visit, with how it was paid. */
  bill: { total: string; status: string; paymentModes: string[] } | null;
}

export async function listDoctors(): Promise<DoctorDTO[]> {
  const rows = await prisma.doctor.findMany({
    where: { active: true }, orderBy: { name: "asc" },
    select: {
      id: true, name: true, specialization: true, department: true, consultationFee: true,
      qualification: true, experienceYears: true, age: true, languages: true, photoUrl: true, bio: true,
    },
  });
  type Row = {
    id: string; name: string; specialization: string; department: string; consultationFee: { toString(): string };
    qualification: string | null; experienceYears: number | null; age: number | null; languages: string | null; photoUrl: string | null; bio: string | null;
  };
  return (rows as Row[]).map((d) => ({
    id: d.id, name: d.name, specialization: d.specialization, department: d.department, fee: d.consultationFee.toString(),
    qualification: d.qualification, experienceYears: d.experienceYears, age: d.age, languages: d.languages, photoUrl: d.photoUrl, bio: d.bio,
  }));
}

export async function listAvailableSlots(doctorId: string, date: string): Promise<SlotDTO[]> {
  const day = new Date(date);
  if (Number.isNaN(day.getTime())) throw new ApiError(400, "Invalid date");
  day.setHours(0, 0, 0, 0);
  const rows = await prisma.doctorSlot.findMany({
    where: { doctorId, date: day, isBooked: false, isBlocked: false },
    orderBy: { startTime: "asc" },
    select: { id: true, startTime: true, endTime: true },
  });

  // Real-time: for today, a slot whose start time has already passed can't be
  // booked — drop it so the grid only ever offers times still ahead of the clock.
  const now = new Date();
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  if (day.getTime() === todayStart.getTime()) {
    const nowMin = now.getHours() * 60 + now.getMinutes();
    return rows.filter((s: SlotDTO) => {
      const [h, m] = s.startTime.split(":").map(Number);
      return h * 60 + m > nowMin;
    });
  }
  return rows;
}

/**
 * Book an appointment. Concurrency-safe atomic slot claim:
 *   updateMany({ where: { id, isBooked: false }, data: { isBooked: true } })
 * count 0 => already taken. Whole op in a transaction (rollback frees the slot);
 * Appointment.slotId UNIQUE is the second guarantee. Consultation fee and the
 * per-visit referral are snapshotted onto the appointment at this moment.
 */
export async function bookAppointment(
  actor: AuthUser,
  input: {
    patientId: string; slotId: string; type: "WALKIN" | "ONLINE";
    referredByName?: string; referralSource?: string;
    /** Reception can bill the consultation in the same motion, so the patient
     *  leaves the desk with an OP number AND a receipt — one queue, not two. */
    billNow?: {
      discountAmount?: number;
      payment?: { mode: "CASH" | "UPI" | "CARD" | "NETBANKING" | "OTHER"; amount: number; reference?: string };
      payments?: { mode: "CASH" | "UPI" | "CARD" | "NETBANKING" | "OTHER"; amount: number; reference?: string }[];
    };
  },
  ctx: { ipAddress?: string; userAgent?: string }
): Promise<AppointmentDTO & { invoice?: { id: string; receiptNo: string; totalAmount: string; status: string } }> {
  const nn = (v: string | undefined) => (v && v.trim() ? v.trim() : null);

  const appt = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const patient = await tx.patient.findUnique({
      where: { id: input.patientId },
      select: { id: true, displayId: true, fullName: true, mergedIntoId: true, deletedAt: true },
    });
    if (!patient || patient.mergedIntoId || patient.deletedAt) throw new ApiError(404, "Patient not found");

    const slot = await tx.doctorSlot.findUnique({
      where: { id: input.slotId },
      // startTime was MISSING here. `timeAtBooking: slot.startTime` therefore
      // wrote `undefined`, and because the column carries @default("00:00"),
      // Prisma quietly stored midnight instead of throwing. Every appointment
      // ever booked was 00:00; reschedule looked "fixed" only because ITS select
      // happened to include startTime. A default on a field that must always be
      // set explicitly turns a crash into silent data corruption.
      select: { id: true, doctorId: true, date: true, startTime: true, isBooked: true },
    });
    if (!slot) throw new ApiError(404, "That time slot no longer exists");
    if (slot.isBooked) throw new ApiError(409, "That slot was just taken. Please pick another.");
    // Defence in depth: never let the column default swallow this again.
    if (!slot.startTime) throw new ApiError(500, "That slot has no start time — tell IT before booking.");

    const claim = await tx.doctorSlot.updateMany({
      where: { id: slot.id, isBooked: false }, data: { isBooked: true },
    });
    if (claim.count === 0) throw new ApiError(409, "That slot was just taken. Please pick another.");

    // snapshot the consultation fee now
    const doctor = await tx.doctor.findUnique({
      where: { id: slot.doctorId }, select: { consultationFee: true },
    });

    const opNumber = await nextId("OP", { tx });
    const created = await tx.appointment.create({
      data: {
        patientId: patient.id,
        doctorId: slot.doctorId,
        slotId: slot.id,
        visitDate: slot.date,
        timeAtBooking: slot.startTime,
        type: input.type,
        status: "BOOKED",
        opNumber,
        priceAtBooking: doctor?.consultationFee ?? 0,
        referredByName: nn(input.referredByName),
        referralSource: nn(input.referralSource),
        createdById: actor.id,
      },
      select: {
        id: true, opNumber: true, status: true, type: true, priceAtBooking: true,
        timeAtBooking: true,
        patient: { select: { id: true, displayId: true, fullName: true } },
        doctor: { select: { id: true, name: true, department: true } },
      },
    });

    await logAudit(
      actor,
      { action: "APPOINTMENT_BOOKED", targetTable: "Appointment", targetId: created.id, meta: { opNumber, patientId: patient.displayId }, ...ctx },
      tx
    );
    return created;
  });

  const dto = {
    id: appt.id, opNumber: appt.opNumber, time: appt.timeAtBooking, status: appt.status,
    type: appt.type, price: appt.priceAtBooking.toString(),
    patient: { id: appt.patient.id, displayId: appt.patient.displayId, name: appt.patient.fullName },
    doctor: appt.doctor,
  };

  // Book + bill in one motion. The consultation invoice reuses the same
  // engine as labs/pharmacy — consultation is GST-exempt by default.
  if (input.billNow) {
    const invoice = await createInvoice(
      actor,
      {
        patientId: appt.patient.id,
        source: "CONSULTATION",
        appointmentId: appt.id,
        lines: [{
          description: `Consultation · ${appt.doctor.name} (${appt.doctor.department}) · ${appt.opNumber}`,
          qty: 1,
          unitPrice: Number(appt.priceAtBooking.toString()),
          gstRatePct: 0,
        }],
        discountAmount: input.billNow.discountAmount,
        payment: input.billNow.payment,
        payments: input.billNow.payments,
      },
      ctx
    );
    return { ...dto, invoice: { id: invoice.id, receiptNo: invoice.receiptNo, totalAmount: invoice.totalAmount, status: invoice.status } };
  }

  return dto;
}

const apptSelect = {
  id: true, opNumber: true, status: true, type: true, priceAtBooking: true, visitDate: true,
  referredByName: true, referralSource: true, timeAtBooking: true, checkedInAt: true,
  patient: { select: { id: true, displayId: true, fullName: true } },
  doctor: { select: { id: true, name: true, department: true } },
} as const;

type ApptRow = {
  id: string; opNumber: string; status: string; type: string;
  priceAtBooking: { toString(): string }; visitDate: Date;
  referredByName: string | null; referralSource: string | null;
  timeAtBooking: string; checkedInAt: Date | null;
  patient: { id: string; displayId: string; fullName: string };
  doctor: { id: string; name: string; department: string };
};

/** Reception queue for today — referral STRIPPED. */
export async function todaysAppointments(): Promise<AppointmentDTO[]> {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const rows: ApptRow[] = await prisma.appointment.findMany({
    where: { visitDate: today, status: { not: "CANCELLED" } },
    orderBy: { timeAtBooking: "asc" }, select: apptSelect,
  });
  return rows.map((a) => ({
    id: a.id, opNumber: a.opNumber, time: a.timeAtBooking, status: a.status, type: a.type,
    price: a.priceAtBooking.toString(),
    checkedInAt: a.checkedInAt ? a.checkedInAt.toISOString() : null,
    patient: { id: a.patient.id, displayId: a.patient.displayId, name: a.patient.fullName },
    doctor: a.doctor,
  }));
}

/** ADMIN-ONLY appointment history — INCLUDES referral snapshot. */
export async function adminAppointmentHistory(limit = 100): Promise<AdminAppointmentDTO[]> {
  const MODE_ORDER = ["CASH", "UPI", "CARD", "NETBANKING", "OTHER"];
  const rows = await prisma.appointment.findMany({
    orderBy: { createdAt: "desc" }, take: limit,
    select: {
      ...apptSelect,
      invoices: {
        orderBy: { createdAt: "desc" }, take: 1,
        select: { totalAmount: true, status: true, payments: { select: { mode: true, amount: true } } },
      },
    },
  });
  type Inv = { totalAmount: { toString(): string }; status: string; payments: { mode: string; amount: { toString(): string } }[] };
  return rows.map((a: ApptRow & { invoices: Inv[] }) => {
    const inv = a.invoices[0];
    const bill = inv
      ? {
          total: inv.totalAmount.toString(),
          status: inv.status,
          paymentModes: MODE_ORDER.filter((m) => inv.payments.some((p) => p.mode === m && Number(p.amount.toString()) > 0)),
        }
      : null;
    return {
      id: a.id, opNumber: a.opNumber, time: a.timeAtBooking, status: a.status, type: a.type,
      price: a.priceAtBooking.toString(),
      visitDate: a.visitDate.toISOString().slice(0, 10),
      referredByName: a.referredByName, referralSource: a.referralSource,
      patient: { id: a.patient.id, displayId: a.patient.displayId, name: a.patient.fullName },
      doctor: a.doctor,
      bill,
    };
  });
}

export async function receptionTodayStats(): Promise<{
  total: number; expected: number; waiting: number; checkedIn: number; completed: number; newPatients: number;
}> {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const [total, expected, checkedIn, completed, newPatients] = await Promise.all([
    prisma.appointment.count({ where: { visitDate: today, status: { not: "CANCELLED" } } }),
    prisma.appointment.count({ where: { visitDate: today, status: "BOOKED" } }),
    prisma.appointment.count({ where: { visitDate: today, status: "CHECKED_IN" } }),
    prisma.appointment.count({ where: { visitDate: today, status: "COMPLETED" } }),
    prisma.patient.count({ where: { createdAt: { gte: today, lt: tomorrow } } }),
  ]);
  // "waiting" = arrived and sitting outside the doctor's room. It is NOT
  // "total minus completed" — that counted people who hadn't walked in yet.
  return { total, expected, waiting: checkedIn, checkedIn, completed, newPatients };
}

/** Everything the printed OPD sheet needs, in one fetch. */
export async function opdPrintData(appointmentId: string): Promise<{
  hospital: { legalName: string; addressLine: string; city: string; state: string; stateCode: string; pincode: string; gstin: string | null; phone: string | null } | null;
  appointment: { id: string; opNumber: string; type: string; status: string; visitDate: string; time: string; referredByName: string | null; visitNumber: number };
  doctor: { name: string; specialization: string; department: string };
  patient: { displayId: string; fullName: string; age: number | null; gender: string | null; bloodGroup: string | null; phone: string; address: string | null; city: string | null };
  rxItems: { medicineName: string; qty: number; dosage: string | null }[];
  vitals: VitalsDTO | null;
  clinical: { diagnosis: string | null; advice: string | null; labs: string[]; nextVisit: string | null } | null;
}> {
  const a = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: {
      id: true, opNumber: true, type: true, status: true, visitDate: true, referredByName: true, createdAt: true, patientId: true,
      timeAtBooking: true,
      doctor: { select: { name: true, specialization: true, department: true } },
      patient: { select: { displayId: true, fullName: true, age: true, gender: true, bloodGroup: true, phone: true, address: true, city: true } },
    },
  });
  if (!a) throw new ApiError(404, "Appointment not found");

  const [hospital, visitNumber, upload, vitals] = await Promise.all([
    prisma.hospitalConfig.findFirst(),
    // "#Visit: 3" the way the paper shows it — this visit's ordinal for the patient.
    prisma.appointment.count({ where: { patientId: a.patientId, createdAt: { lte: a.createdAt } } }),
    prisma.prescriptionUpload.findFirst({
      where: { appointmentId: a.id },
      orderBy: { createdAt: "desc" },
      select: {
        items: { select: { medicineName: true, qty: true, dosage: true }, orderBy: { id: "asc" } },
        diagnosis: true, advice: true, labsAdvised: true, nextVisit: true,
      },
    }),
    prisma.vitals.findUnique({ where: { appointmentId: a.id } }),
  ]);

  return {
    hospital,
    appointment: {
      id: a.id, opNumber: a.opNumber, type: a.type, status: a.status,
      visitDate: a.visitDate.toISOString().slice(0, 10),
      time: a.timeAtBooking, referredByName: a.referredByName, visitNumber,
    },
    doctor: a.doctor,
    patient: a.patient,
    rxItems: upload?.items ?? [],
    vitals: vitals ? toVitalsDTO(vitals) : null,
    clinical: upload && (upload.diagnosis || upload.advice || upload.labsAdvised || upload.nextVisit)
      ? {
          diagnosis: upload.diagnosis,
          advice: upload.advice,
          labs: upload.labsAdvised?.split("\n").filter(Boolean) ?? [],
          nextVisit: upload.nextVisit,
        }
      : null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// VITALS — BP, pulse, height, weight, temp, SpO2 for one visit. Printed blank
// at booking for the triage pen; reception types the handwritten numbers back
// in here afterwards, same two-step paper-first flow as the ℞ table.
// ─────────────────────────────────────────────────────────────────────────────

export interface VitalsDTO {
  bpSystolic: number | null; bpDiastolic: number | null; pulse: number | null;
  tempF: number | null; spo2: number | null; heightCm: number | null; weightKg: number | null;
  recordedAt: string;
}

function toVitalsDTO(v: {
  bpSystolic: number | null; bpDiastolic: number | null; pulse: number | null;
  tempF: Prisma.Decimal | null; spo2: number | null;
  heightCm: Prisma.Decimal | null; weightKg: Prisma.Decimal | null;
  recordedAt: Date;
}): VitalsDTO {
  return {
    bpSystolic: v.bpSystolic, bpDiastolic: v.bpDiastolic, pulse: v.pulse,
    tempF: v.tempF ? Number(v.tempF) : null, spo2: v.spo2,
    heightCm: v.heightCm ? Number(v.heightCm) : null,
    weightKg: v.weightKg ? Number(v.weightKg) : null,
    recordedAt: v.recordedAt.toISOString(),
  };
}

/** Fetch the vitals typed in so far for this visit (or null — nothing typed yet). */
export async function getVitals(appointmentId: string): Promise<VitalsDTO | null> {
  const v = await prisma.vitals.findUnique({ where: { appointmentId } });
  return v ? toVitalsDTO(v) : null;
}

/**
 * Upsert vitals for a visit. Every field optional and independently
 * overwritable — reception fills in whatever the handwritten sheet has,
 * and can come back and add the rest later without clobbering what's there
 * (fields left out of `input` are simply not part of this call's `data`,
 * but since this is a full-row upsert a caller resubmitting the whole form
 * is the expected pattern — same as the ℞ item list on prescriptions).
 */
export async function recordVitals(
  actor: AuthUser,
  appointmentId: string,
  input: {
    bpSystolic?: number; bpDiastolic?: number; pulse?: number;
    tempF?: number; spo2?: number; heightCm?: number; weightKg?: number;
  },
  ctx: { ipAddress?: string; userAgent?: string }
): Promise<VitalsDTO> {
  const appt = await prisma.appointment.findUnique({ where: { id: appointmentId }, select: { id: true } });
  if (!appt) throw new ApiError(404, "Appointment not found");

  const data = {
    bpSystolic: input.bpSystolic ?? null,
    bpDiastolic: input.bpDiastolic ?? null,
    pulse: input.pulse ?? null,
    tempF: input.tempF ?? null,
    spo2: input.spo2 ?? null,
    heightCm: input.heightCm ?? null,
    weightKg: input.weightKg ?? null,
  };

  const row = await prisma.vitals.upsert({
    where: { appointmentId },
    create: { appointmentId, recordedById: actor.id, ...data },
    update: { recordedById: actor.id, ...data },
  });

  await logAudit(actor, {
    action: "VITALS_RECORDED",
    targetTable: "Vitals",
    targetId: row.id,
    meta: { appointmentId },
    ...ctx,
  });

  return toVitalsDTO(row);
}

// ─────────────────────────────────────────────────────────────────────────────
// VISIT LIFECYCLE — the front desk's actual verbs.
// The schema always had CHECKED_IN / CANCELLED / checkedInAt / cancelledAt.
// Nothing ever wrote them, so "Checked in" read 0 forever and a booking could
// never be undone. These close that loop.
// ─────────────────────────────────────────────────────────────────────────────

/** Patient physically walked in. BOOKED -> CHECKED_IN. */
export async function checkInAppointment(
  actor: AuthUser,
  appointmentId: string,
  ctx: { ipAddress?: string; userAgent?: string }
): Promise<{ id: string; status: string; checkedInAt: string }> {
  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: { id: true, status: true, opNumber: true },
  });
  if (!appt) throw new ApiError(404, "Appointment not found");
  if (appt.status === "CHECKED_IN") throw new ApiError(409, "This patient is already checked in");
  if (appt.status === "COMPLETED") throw new ApiError(409, "This visit is already complete");
  if (appt.status === "CANCELLED") throw new ApiError(409, "This visit was cancelled");

  const now = new Date();
  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: "CHECKED_IN", checkedInAt: now },
  });
  await logAudit(actor, {
    action: "APPOINTMENT_CHECKED_IN", targetTable: "Appointment", targetId: appointmentId,
    meta: { opNumber: appt.opNumber }, ...ctx,
  });
  return { id: appointmentId, status: "CHECKED_IN", checkedInAt: now.toISOString() };
}

/** Undo a mis-click. CHECKED_IN -> BOOKED. Refused once the doctor has seen them. */
export async function undoCheckIn(
  actor: AuthUser,
  appointmentId: string,
  ctx: { ipAddress?: string; userAgent?: string }
): Promise<void> {
  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId }, select: { status: true, opNumber: true },
  });
  if (!appt) throw new ApiError(404, "Appointment not found");
  if (appt.status !== "CHECKED_IN") throw new ApiError(409, "That visit isn't checked in");

  await prisma.appointment.update({
    where: { id: appointmentId }, data: { status: "BOOKED", checkedInAt: null },
  });
  await logAudit(actor, {
    action: "APPOINTMENT_CHECKIN_UNDONE", targetTable: "Appointment", targetId: appointmentId,
    meta: { opNumber: appt.opNumber }, ...ctx,
  });
}

/**
 * Cancel a visit AND RELEASE THE SLOT so someone else can take it.
 *
 * The release is the whole point. Appointment.slotId is UNIQUE, so if a cancelled
 * row kept holding its slot, that time would be burned forever — no one could
 * ever book it again. We null slotId (Postgres permits many NULLs under a unique
 * index) and flip the slot back to isBooked=false. The visit row itself is kept:
 * nothing medical is hard-deleted, and timeAtBooking preserves when it *was*.
 *
 * Any bill already raised for this visit is deliberately NOT touched — refunding
 * money is a separate, deliberate act. The caller is told a paid bill exists.
 */
export async function cancelAppointment(
  actor: AuthUser,
  input: { appointmentId: string; reason: string },
  ctx: { ipAddress?: string; userAgent?: string }
): Promise<{ id: string; opNumber: string; paidInvoice: { receiptNo: string; amountPaid: string } | null }> {
  if (!input.reason?.trim()) throw new ApiError(400, "A cancellation reason is required");

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const appt = await tx.appointment.findUnique({
      where: { id: input.appointmentId },
      select: {
        id: true, opNumber: true, status: true, slotId: true,
        invoices: {
          where: { status: { not: "CANCELLED" } },
          select: { receiptNo: true, totalAmount: true, payments: { select: { amount: true } } },
        },
      },
    });
    if (!appt) throw new ApiError(404, "Appointment not found");
    if (appt.status === "CANCELLED") throw new ApiError(409, "Already cancelled");
    if (appt.status === "COMPLETED") throw new ApiError(409, "This visit is already complete — it can't be cancelled");

    // release the slot back to the pool
    if (appt.slotId) {
      await tx.doctorSlot.update({ where: { id: appt.slotId }, data: { isBooked: false } });
    }
    await tx.appointment.update({
      where: { id: input.appointmentId },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancellationReason: input.reason.trim(),
        slotId: null, // frees the UNIQUE so the slot can be rebooked
      },
    });

    await logAudit(actor, {
      action: "APPOINTMENT_CANCELLED", targetTable: "Appointment", targetId: input.appointmentId,
      meta: { opNumber: appt.opNumber, reason: input.reason.trim() }, ...ctx,
    }, tx);

    // Warn the desk if money already changed hands. We do NOT auto-refund.
    type InvRow = { receiptNo: string; payments: { amount: { toString(): string } }[] };
    const paid = (appt.invoices as InvRow[])
      .map((i: InvRow) => ({
        receiptNo: i.receiptNo,
        amountPaid: i.payments.reduce((s: number, p: { amount: { toString(): string } }) => s + Number(p.amount.toString()), 0),
      }))
      .find((i: { amountPaid: number }) => i.amountPaid > 0);

    return {
      id: appt.id,
      opNumber: appt.opNumber,
      paidInvoice: paid ? { receiptNo: paid.receiptNo, amountPaid: paid.amountPaid.toFixed(2) } : null,
    };
  });
}

/**
 * Move a visit to a different slot with the SAME doctor.
 *
 * Same doctor only, deliberately: the consultation fee was snapshotted at booking
 * and may already be billed. Moving to a different doctor could silently change
 * what the patient owes. If they want another doctor, cancel and rebook — that
 * makes the money decision explicit instead of hiding it inside a reschedule.
 *
 * The new slot is claimed with the same atomic updateMany used at booking, so two
 * receptionists racing for the same slot can't both win.
 */
export async function rescheduleAppointment(
  actor: AuthUser,
  input: { appointmentId: string; newSlotId: string },
  ctx: { ipAddress?: string; userAgent?: string }
): Promise<{ id: string; opNumber: string; visitDate: string; time: string }> {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const appt = await tx.appointment.findUnique({
      where: { id: input.appointmentId },
      select: { id: true, opNumber: true, status: true, slotId: true, doctorId: true },
    });
    if (!appt) throw new ApiError(404, "Appointment not found");
    if (appt.status === "COMPLETED") throw new ApiError(409, "This visit is already complete");
    if (appt.status === "CANCELLED") throw new ApiError(409, "This visit was cancelled — book a new one");

    const slot = await tx.doctorSlot.findUnique({
      where: { id: input.newSlotId },
      select: { id: true, doctorId: true, date: true, startTime: true, isBooked: true },
    });
    if (!slot) throw new ApiError(404, "That slot doesn't exist");
    if (slot.doctorId !== appt.doctorId) {
      throw new ApiError(400, "Pick a slot with the same doctor. To change doctor, cancel and book again.");
    }
    if (slot.id === appt.slotId) throw new ApiError(400, "That's the slot it's already in");

    // atomic claim — identical guarantee to booking
    const claim = await tx.doctorSlot.updateMany({
      where: { id: slot.id, isBooked: false }, data: { isBooked: true },
    });
    if (claim.count === 0) throw new ApiError(409, "That slot was just taken. Please pick another.");

    // release the old one
    if (appt.slotId) {
      await tx.doctorSlot.update({ where: { id: appt.slotId }, data: { isBooked: false } });
    }

    await tx.appointment.update({
      where: { id: appt.id },
      data: {
        slotId: slot.id,
        visitDate: slot.date,
        timeAtBooking: slot.startTime,
        status: "BOOKED",   // if they'd checked in, arrival no longer applies
        checkedInAt: null,
      },
    });

    await logAudit(actor, {
      action: "APPOINTMENT_RESCHEDULED", targetTable: "Appointment", targetId: appt.id,
      meta: { opNumber: appt.opNumber, to: `${slot.date.toISOString().slice(0, 10)} ${slot.startTime}` }, ...ctx,
    }, tx);

    return {
      id: appt.id, opNumber: appt.opNumber,
      visitDate: slot.date.toISOString().slice(0, 10), time: slot.startTime,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// DOCTOR AVAILABILITY — leave / surgery / emergency.
// Without this, a doctor could be on leave and reception would keep selling
// their slots. The patient arrives to an empty room.
// ─────────────────────────────────────────────────────────────────────────────

export interface DaySlot {
  id: string; startTime: string; endTime: string;
  state: "FREE" | "BOOKED" | "BLOCKED";
  blockReason: string | null;
  appointment: { id: string; opNumber: string; status: string; patient: { displayId: string; fullName: string; phone: string } } | null;
}

/** Every slot for one doctor on one day, whatever its state. */
export async function doctorDaySchedule(doctorId: string, date: string): Promise<{
  doctor: { id: string; name: string; department: string };
  onLeave: boolean;
  slots: DaySlot[];
}> {
  const day = new Date(date);
  if (Number.isNaN(day.getTime())) throw new ApiError(400, "Invalid date");
  day.setHours(0, 0, 0, 0);

  const doctor = await prisma.doctor.findUnique({
    where: { id: doctorId }, select: { id: true, name: true, department: true },
  });
  if (!doctor) throw new ApiError(404, "Doctor not found");

  const rows = await prisma.doctorSlot.findMany({
    where: { doctorId, date: day },
    orderBy: { startTime: "asc" },
    select: {
      id: true, startTime: true, endTime: true, isBooked: true, isBlocked: true, blockReason: true,
      appointment: {
        select: {
          id: true, opNumber: true, status: true,
          patient: { select: { displayId: true, fullName: true, phone: true } },
        },
      },
    },
  });

  type Row = {
    id: string; startTime: string; endTime: string; isBooked: boolean; isBlocked: boolean; blockReason: string | null;
    appointment: { id: string; opNumber: string; status: string; patient: { displayId: string; fullName: string; phone: string } } | null;
  };

  const slots: DaySlot[] = (rows as Row[]).map((s) => ({
    id: s.id, startTime: s.startTime, endTime: s.endTime,
    state: s.isBlocked ? "BLOCKED" : s.isBooked ? "BOOKED" : "FREE",
    blockReason: s.blockReason,
    appointment: s.appointment,
  }));

  // "On leave" = there are slots, and none of them are still sellable.
  const sellable = slots.filter((s) => s.state === "FREE").length;
  return { doctor, onLeave: slots.length > 0 && sellable === 0 && slots.some((s) => s.state === "BLOCKED"), slots };
}

/**
 * Mark a doctor unavailable for a day.
 *
 * Blocks every FREE slot. Slots that are already BOOKED are deliberately left
 * alone — cancelling a patient's visit behind their back would be worse than the
 * problem. Instead we hand the caller the list of affected patients (with phone
 * numbers) so the desk can ring them and reschedule or cancel, one by one, on
 * purpose.
 */
export async function setDoctorLeave(
  actor: AuthUser,
  input: { doctorId: string; date: string; reason: string },
  ctx: { ipAddress?: string; userAgent?: string }
): Promise<{
  blocked: number;
  affected: { id: string; opNumber: string; time: string; patient: { displayId: string; fullName: string; phone: string } }[];
}> {
  if (!input.reason?.trim()) throw new ApiError(400, "Give a reason (leave, surgery, emergency…)");
  const day = new Date(input.date);
  if (Number.isNaN(day.getTime())) throw new ApiError(400, "Invalid date");
  day.setHours(0, 0, 0, 0);

  const res = await prisma.doctorSlot.updateMany({
    where: { doctorId: input.doctorId, date: day, isBooked: false, isBlocked: false },
    data: { isBlocked: true, blockReason: input.reason.trim() },
  });

  // Who already holds a booking on this day? They need a phone call.
  const booked = await prisma.appointment.findMany({
    where: { doctorId: input.doctorId, visitDate: day, status: { in: ["BOOKED", "CHECKED_IN"] } },
    orderBy: { timeAtBooking: "asc" },
    select: {
      id: true, opNumber: true, timeAtBooking: true,
      patient: { select: { displayId: true, fullName: true, phone: true } },
    },
  });

  await logAudit(actor, {
    action: "DOCTOR_LEAVE_SET", targetTable: "Doctor", targetId: input.doctorId,
    meta: { date: input.date, reason: input.reason.trim(), blocked: res.count, alreadyBooked: booked.length },
    ...ctx,
  });

  type B = { id: string; opNumber: string; timeAtBooking: string; patient: { displayId: string; fullName: string; phone: string } };
  return {
    blocked: res.count,
    affected: (booked as B[]).map((b) => ({
      id: b.id, opNumber: b.opNumber, time: b.timeAtBooking, patient: b.patient,
    })),
  };
}

/** Doctor is back. Blocked slots become sellable again. */
export async function clearDoctorLeave(
  actor: AuthUser,
  input: { doctorId: string; date: string },
  ctx: { ipAddress?: string; userAgent?: string }
): Promise<{ reopened: number }> {
  const day = new Date(input.date);
  if (Number.isNaN(day.getTime())) throw new ApiError(400, "Invalid date");
  day.setHours(0, 0, 0, 0);

  const res = await prisma.doctorSlot.updateMany({
    where: { doctorId: input.doctorId, date: day, isBlocked: true },
    data: { isBlocked: false, blockReason: null },
  });

  await logAudit(actor, {
    action: "DOCTOR_LEAVE_CLEARED", targetTable: "Doctor", targetId: input.doctorId,
    meta: { date: input.date, reopened: res.count }, ...ctx,
  });
  return { reopened: res.count };
}

/** Block or reopen ONE slot — the doctor stepped out for an hour, not the day. */
export async function toggleSlotBlock(
  actor: AuthUser,
  input: { slotId: string; blocked: boolean; reason?: string },
  ctx: { ipAddress?: string; userAgent?: string }
): Promise<void> {
  const slot = await prisma.doctorSlot.findUnique({
    where: { id: input.slotId }, select: { id: true, isBooked: true },
  });
  if (!slot) throw new ApiError(404, "Slot not found");
  if (slot.isBooked) throw new ApiError(409, "That slot has a patient in it — reschedule or cancel the visit first");

  await prisma.doctorSlot.update({
    where: { id: input.slotId },
    data: input.blocked
      ? { isBlocked: true, blockReason: input.reason?.trim() || "Unavailable" }
      : { isBlocked: false, blockReason: null },
  });
  await logAudit(actor, {
    action: input.blocked ? "SLOT_BLOCKED" : "SLOT_REOPENED",
    targetTable: "DoctorSlot", targetId: input.slotId, ...ctx,
  });
}