import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { nextId } from "@/lib/ids";
import { logAudit } from "./audit.service";
import { createInvoice, recordPayment, type PaymentModeT } from "./billing.service";
import type { AuthUser } from "@/lib/auth/types";
import type { Prisma, PaymentMode, ChargeCategory } from "@prisma/client";

// ---------------------------------------------------------------------------
// IPD — inpatient admissions.
//
// The shape of the flow: pick the patient by their Jeeva ID, check the bed
// board, admit them onto an AVAILABLE bed with an attending doctor and the
// caring person's details. The bed flips OCCUPIED. On discharge, the stay is
// billed (days × the rate snapshotted at admission), the bed is freed, and
// the case is closed. Nothing is ever deleted.
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;

/** Charged per started day, minimum 1 — standard hospital practice. */
export function stayDays(admittedAt: Date, until: Date): number {
  return Math.max(1, Math.ceil((until.getTime() - admittedAt.getTime()) / DAY_MS));
}

// ---------------------------------------------------------------------------
// Wards & beds (setup lives with admin; the board is for everyone clinical)
// ---------------------------------------------------------------------------

export async function upsertWard(
  actor: AuthUser,
  input: { id?: string; name: string; category: string; floor?: string; dailyCharge: number; gstRatePct: number; active?: boolean },
  ctx: { ipAddress?: string; userAgent?: string }
): Promise<void> {
  const data = {
    name: input.name.trim(),
    category: input.category.trim().toUpperCase(),
    floor: input.floor?.trim() || null,
    dailyCharge: input.dailyCharge.toFixed(2),
    gstRatePct: input.gstRatePct.toFixed(2),
    active: input.active ?? true,
  };
  if (input.id) {
    await prisma.ward.update({ where: { id: input.id }, data });
    await logAudit(actor, { action: "WARD_UPDATED", targetTable: "Ward", targetId: input.id, meta: { dailyCharge: input.dailyCharge }, ...ctx });
  } else {
    const w = await prisma.ward.create({ data, select: { id: true } });
    await logAudit(actor, { action: "WARD_CREATED", targetTable: "Ward", targetId: w.id, meta: { name: data.name }, ...ctx });
  }
}

/** Add N beds to a ward, auto-numbered after the highest existing number. */
export async function addBeds(
  actor: AuthUser,
  input: { wardId: string; count: number; prefix?: string },
  ctx: { ipAddress?: string; userAgent?: string }
): Promise<void> {
  if (input.count < 1 || input.count > 50) throw new ApiError(400, "Add between 1 and 50 beds at a time");
  const ward = await prisma.ward.findUnique({ where: { id: input.wardId }, select: { id: true, name: true, beds: { select: { bedNo: true } } } });
  if (!ward) throw new ApiError(404, "Ward not found");

  const prefix = (input.prefix ?? ward.name.slice(0, 3).toUpperCase()).replace(/\s/g, "");
  const existingNums = (ward.beds as { bedNo: string }[])
    .map((b) => Number(b.bedNo.replace(/^\D+/, "")))
    .filter((n) => !Number.isNaN(n));
  let next = existingNums.length ? Math.max(...existingNums) + 1 : 1;

  await prisma.bed.createMany({
    data: Array.from({ length: input.count }, () => ({
      wardId: input.wardId,
      bedNo: `${prefix}-${String(next++).padStart(2, "0")}`,
    })),
  });
  await logAudit(actor, { action: "BEDS_ADDED", targetTable: "Ward", targetId: input.wardId, meta: { count: input.count }, ...ctx });
}

export async function setBedStatus(
  actor: AuthUser,
  input: { bedId: string; status: "AVAILABLE" | "MAINTENANCE" },
  ctx: { ipAddress?: string; userAgent?: string }
): Promise<void> {
  const bed = await prisma.bed.findUnique({ where: { id: input.bedId }, select: { id: true, status: true } });
  if (!bed) throw new ApiError(404, "Bed not found");
  if (bed.status === "OCCUPIED") throw new ApiError(400, "That bed is occupied — discharge the patient first");
  await prisma.bed.update({ where: { id: input.bedId }, data: { status: input.status } });
  await logAudit(actor, { action: "BED_STATUS_SET", targetTable: "Bed", targetId: input.bedId, meta: { status: input.status }, ...ctx });
}

/**
 * The bed board: every ward, every bed, who's in it. This is the availability
 * check — reception admits straight off this screen.
 */
export async function bedBoard(): Promise<{
  summary: { total: number; available: number; occupied: number; maintenance: number };
  wards: {
    id: string; name: string; category: string; floor: string | null;
    dailyCharge: string; gstRatePct: string; available: number; total: number;
    beds: {
      id: string; bedNo: string; status: string;
      patient: { displayId: string; fullName: string; ipNumber: string; admissionId: string } | null;
    }[];
  }[];
}> {
  const wards = await prisma.ward.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: {
      id: true, name: true, category: true, floor: true, dailyCharge: true, gstRatePct: true,
      beds: {
        orderBy: { bedNo: "asc" },
        select: {
          id: true, bedNo: true, status: true,
          admissions: {
            where: { status: "ADMITTED" },
            take: 1,
            select: { id: true, ipNumber: true, patient: { select: { displayId: true, fullName: true } } },
          },
        },
      },
    },
  });

  type WardRow = {
    id: string; name: string; category: string; floor: string | null;
    dailyCharge: { toString(): string }; gstRatePct: { toString(): string };
    beds: { id: string; bedNo: string; status: string; admissions: { id: string; ipNumber: string; patient: { displayId: string; fullName: string } }[] }[];
  };

  let total = 0, available = 0, occupied = 0, maintenance = 0;
  const mapped = (wards as WardRow[]).map((w) => {
    const beds = w.beds.map((b) => {
      total++;
      if (b.status === "AVAILABLE") available++;
      else if (b.status === "OCCUPIED") occupied++;
      else maintenance++;
      const adm = b.admissions[0];
      return {
        id: b.id, bedNo: b.bedNo, status: b.status,
        patient: adm ? { displayId: adm.patient.displayId, fullName: adm.patient.fullName, ipNumber: adm.ipNumber, admissionId: adm.id } : null,
      };
    });
    return {
      id: w.id, name: w.name, category: w.category, floor: w.floor,
      dailyCharge: w.dailyCharge.toString(), gstRatePct: w.gstRatePct.toString(),
      available: beds.filter((b) => b.status === "AVAILABLE").length,
      total: beds.length,
      beds,
    };
  });

  return { summary: { total, available, occupied, maintenance }, wards: mapped };
}

// ---------------------------------------------------------------------------
// Admissions
// ---------------------------------------------------------------------------

export async function admitPatient(
  actor: AuthUser,
  input: {
    patientDisplayId: string;
    bedId: string;
    doctorId: string;          // the attending / referred doctor inside the hospital
    reason?: string;
    attendantName?: string;    // the caring person
    attendantPhone?: string;
    attendantRelation?: string;
    notes?: string;
  },
  ctx: { ipAddress?: string; userAgent?: string }
): Promise<{ admissionId: string; ipNumber: string; bedNo: string; ward: string }> {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const patient = await tx.patient.findUnique({
      where: { displayId: input.patientDisplayId.toUpperCase() },
      select: { id: true, displayId: true, fullName: true, mergedIntoId: true, deletedAt: true },
    });
    if (!patient || patient.mergedIntoId || patient.deletedAt) throw new ApiError(404, "Patient not found — check the Jeeva ID");

    // One active admission per patient. A person cannot be in two beds.
    const already = await tx.admission.findFirst({
      where: { patientId: patient.id, status: "ADMITTED" },
      select: { ipNumber: true },
    });
    if (already) throw new ApiError(409, `${patient.fullName} is already admitted (${already.ipNumber})`);

    // Claim the bed atomically — two receptionists racing for the last ICU
    // bed must not both win.
    const claim = await tx.bed.updateMany({
      where: { id: input.bedId, status: "AVAILABLE" },
      data: { status: "OCCUPIED" },
    });
    if (claim.count === 0) throw new ApiError(409, "That bed was just taken or is unavailable — pick another from the board");

    const bed = await tx.bed.findUnique({
      where: { id: input.bedId },
      select: { bedNo: true, ward: { select: { name: true, dailyCharge: true, gstRatePct: true } } },
    });
    if (!bed) throw new ApiError(404, "Bed not found");

    const doctor = await tx.doctor.findUnique({ where: { id: input.doctorId }, select: { id: true } });
    if (!doctor) throw new ApiError(404, "Doctor not found");

    const ipNumber = await nextId("IP", { tx });
    const nn = (v?: string) => (v && v.trim() ? v.trim() : null);

    const adm = await tx.admission.create({
      data: {
        ipNumber,
        patientId: patient.id,
        bedId: input.bedId,
        doctorId: input.doctorId,
        reason: nn(input.reason),
        attendantName: nn(input.attendantName),
        attendantPhone: nn(input.attendantPhone),
        attendantRelation: nn(input.attendantRelation),
        notes: nn(input.notes),
        dailyChargeAtAdmit: bed.ward.dailyCharge,
        wardNameAtAdmit: bed.ward.name,
        gstRatePctAtAdmit: bed.ward.gstRatePct,
        admittedById: actor.id,
      },
      select: { id: true },
    });

    await logAudit(actor, {
      action: "PATIENT_ADMITTED", targetTable: "Admission", targetId: adm.id,
      meta: { ipNumber, patient: patient.displayId, bed: bed.bedNo, ward: bed.ward.name }, ...ctx,
    }, tx);

    return { admissionId: adm.id, ipNumber, bedNo: bed.bedNo, ward: bed.ward.name };
  });
}

/** Everyone currently in a bed, with the running charge so far. */
export async function currentInpatients(): Promise<{
  id: string; ipNumber: string; admittedAt: string; days: number;
  ward: string; bedNo: string; dailyCharge: string; runningCharge: string;
  bedCharge: string; extrasCharge: string; extras: number;
  reason: string | null; attendantName: string | null; attendantPhone: string | null;
  doctor: { name: string; department: string };
  patient: { id: string; displayId: string; fullName: string; age: number | null; gender: string | null; phone: string };
}[]> {
  const rows = await prisma.admission.findMany({
    where: { status: "ADMITTED" },
    orderBy: { admittedAt: "asc" },
    select: {
      id: true, ipNumber: true, admittedAt: true, reason: true,
      attendantName: true, attendantPhone: true,
      dailyChargeAtAdmit: true, wardNameAtAdmit: true,
      bed: { select: { bedNo: true } },
      charges: { select: { qty: true, unitPrice: true } },
      doctor: { select: { name: true, department: true } },
      patient: { select: { id: true, displayId: true, fullName: true, age: true, gender: true, phone: true } },
    },
  });

  const now = new Date();
  return rows.map((r: {
    id: string; ipNumber: string; admittedAt: Date; reason: string | null;
    attendantName: string | null; attendantPhone: string | null;
    dailyChargeAtAdmit: { toString(): string }; wardNameAtAdmit: string;
    bed: { bedNo: string };
    charges: { qty: number; unitPrice: { toString(): string } }[];
    doctor: { name: string; department: string };
    patient: { id: string; displayId: string; fullName: string; age: number | null; gender: string | null; phone: string };
  }) => {
    const days = stayDays(r.admittedAt, now);
    const daily = Number(r.dailyChargeAtAdmit.toString());
    const bedCharge = days * daily;
    // The bed is not the bill. Procedures, oxygen and pharmacy all ride along.
    const extrasCharge = r.charges.reduce((s, c) => s + c.qty * Number(c.unitPrice.toString()), 0);
    return {
      id: r.id, ipNumber: r.ipNumber, admittedAt: r.admittedAt.toISOString(),
      days, ward: r.wardNameAtAdmit, bedNo: r.bed.bedNo,
      dailyCharge: daily.toFixed(2),
      bedCharge: bedCharge.toFixed(2),
      extrasCharge: extrasCharge.toFixed(2),
      extras: r.charges.length,
      runningCharge: (bedCharge + extrasCharge).toFixed(2),
      reason: r.reason, attendantName: r.attendantName, attendantPhone: r.attendantPhone,
      doctor: r.doctor, patient: r.patient,
    };
  });
}

/**
 * Discharge: close the case, free the bed, and raise the IPD invoice for the
 * bed charges (days × rate-at-admission). Lab and pharmacy bills have already
 * accrued separately against the patient, exactly as they do for outpatients.
 */
type ChargeLine = {
  description: string; qty: number; category: string;
  unitPrice: { toString(): string }; gstRatePct: { toString(): string };
};

export async function dischargePatient(
  actor: AuthUser,
  input: {
    admissionId: string;
    discountAmount?: number;
    payment?: { mode: "CASH" | "UPI" | "CARD" | "NETBANKING" | "OTHER"; amount: number; reference?: string };
    payments?: { mode: "CASH" | "UPI" | "CARD" | "NETBANKING" | "OTHER"; amount: number; reference?: string }[];
    notes?: string;
  },
  ctx: { ipAddress?: string; userAgent?: string }
) {
  // Close the stay + free the bed atomically.
  const adm = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const a = await tx.admission.findUnique({
      where: { id: input.admissionId },
      select: {
        id: true, status: true, admittedAt: true, ipNumber: true, bedId: true,
        dailyChargeAtAdmit: true, wardNameAtAdmit: true, gstRatePctAtAdmit: true,
        charges: {
          orderBy: { createdAt: "asc" },
          select: { description: true, qty: true, unitPrice: true, gstRatePct: true, category: true },
        },
        patientId: true, patient: { select: { displayId: true } },
        bed: { select: { bedNo: true } },
        notes: true,
      },
    });
    if (!a) throw new ApiError(404, "Admission not found");
    if (a.status === "DISCHARGED") throw new ApiError(400, "Already discharged");

    const dischargedAt = new Date();
    await tx.admission.update({
      where: { id: a.id },
      data: {
        status: "DISCHARGED",
        dischargedAt,
        dischargedById: actor.id,
        ...(input.notes?.trim() ? { notes: [a.notes, input.notes.trim()].filter(Boolean).join("\n") } : {}),
      },
    });
    await tx.bed.update({ where: { id: a.bedId }, data: { status: "AVAILABLE" } });

    await logAudit(actor, {
      action: "PATIENT_DISCHARGED", targetTable: "Admission", targetId: a.id,
      meta: { ipNumber: a.ipNumber, bed: a.bed.bedNo }, ...ctx,
    }, tx);

    return { ...a, dischargedAt };
  });

  // ── BED LINES — one per LEG of the stay ──
  //
  // A patient who moved General → ICU on day 3 did not spend the whole stay in
  // either. Billing one flat rate would rob one side or the other. So each
  // BedStay is priced on its own, at the rate that ward carried when they were
  // in it — a mid-stay price revision can never reach back and re-price days
  // already lived.
  const stays = await prisma.bedStay.findMany({
    where: { admissionId: adm.id },
    orderBy: { fromDate: "asc" },
    select: { wardName: true, dailyCharge: true, gstRatePct: true, fromDate: true, toDate: true, bed: { select: { bedNo: true } } },
  });

  type StayRow = {
    wardName: string; dailyCharge: { toString(): string }; gstRatePct: { toString(): string };
    fromDate: Date; toDate: Date | null; bed: { bedNo: string } | null;
  };

  const bedLines = (stays as StayRow[]).length > 0
    ? (stays as StayRow[]).map((st) => {
        const days = stayDays(st.fromDate, st.toDate ?? adm.dischargedAt);
        return {
          description: `Bed · ${st.wardName} · ${st.bed?.bedNo ?? "—"} · ${days} day${days > 1 ? "s" : ""}`,
          qty: days,
          unitPrice: Number(st.dailyCharge.toString()),
          gstRatePct: Number(st.gstRatePct.toString()),
        };
      })
    // Fallback for an admission created before BedStay existed and somehow not
    // backfilled. Never silently bill zero days for a bed someone slept in.
    : [{
        description: `Bed charges · ${adm.wardNameAtAdmit} · ${adm.bed.bedNo} · ${adm.ipNumber} · ${stayDays(adm.admittedAt, adm.dischargedAt)} day(s)`,
        qty: stayDays(adm.admittedAt, adm.dischargedAt),
        unitPrice: Number(adm.dailyChargeAtAdmit.toString()),
        gstRatePct: Number(adm.gstRatePctAtAdmit.toString()),
      }];

  const invoice = await createInvoice(
    actor,
    {
      patientId: adm.patientId,
      source: "IPD",
      admissionId: adm.id,
      // The bed is only the first line (or lines — see above). Everything on the
      // running tab — procedures, oxygen, doctor rounds, lab tests, medicines sent
      // up from the pharmacy — is billed here, once, at discharge. Each line keeps
      // its own GST rate: a ₹5,500 room and a 12% syrup are not taxed the same way.
      lines: [
        ...bedLines,
        ...(adm.charges as ChargeLine[]).map((c) => ({
          description: c.description,
          qty: c.qty,
          unitPrice: Number(c.unitPrice.toString()),
          gstRatePct: Number(c.gstRatePct.toString()),
        })),
      ],
      discountAmount: input.discountAmount,
      payment: input.payment,
      payments: input.payments,
    },
    ctx
  );

  // ── ADVANCE ──
  // The deposit taken at admission is money the hospital ALREADY holds. Record it
  // against this invoice as a payment, so the family is asked only for the
  // balance — and if the advance exceeds the bill, the difference shows up as
  // refundable rather than quietly disappearing.
  const advances = await prisma.admissionAdvance.findMany({
    where: { admissionId: adm.id },
    select: { amount: true, mode: true },
  });
  if (advances.length > 0) {
    const advTotal = (advances as { amount: { toString(): string }; mode: string }[])
      .reduce((sum, a) => sum + Number(a.amount.toString()), 0);
    if (advTotal > 0) {
      await recordPayment(
        actor,
        {
          invoiceId: invoice.id,
          mode: (advances as { mode: PaymentModeT }[])[0].mode,
          amount: advTotal,
          reference: `Advance taken at admission (${adm.ipNumber})`,
        },
        ctx
      );
    }
  }

  // whole-stay length, for the receipt header (individual legs are on the bill)
  const days = stayDays(adm.admittedAt, adm.dischargedAt);
  return { ipNumber: adm.ipNumber, days, invoice };
}

/** Small stat strip for the reception dashboard. */
export async function ipdStats(): Promise<{ admitted: number; availableBeds: number; totalBeds: number; dischargedToday: number }> {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const [admitted, availableBeds, totalBeds, dischargedToday] = await Promise.all([
    prisma.admission.count({ where: { status: "ADMITTED" } }),
    prisma.bed.count({ where: { status: "AVAILABLE" } }),
    prisma.bed.count(),
    prisma.admission.count({ where: { status: "DISCHARGED", dischargedAt: { gte: today, lt: tomorrow } } }),
  ]);
  return { admitted, availableBeds, totalBeds, dischargedToday };
}

/**
 * One-click ward setup for a hospital starting from nothing.
 *
 * Idempotent (upsert by ward name, upsert by ward+bed number), so it is safe to
 * press twice and safe to run against a half-configured hospital. Same shape as
 * the seed — this exists so go-live doesn't require a developer at a terminal.
 *
 * GST: room rent over ₹5,000/day (non-ICU) attracts 5%; below that it is exempt,
 * and ICU is exempt regardless. Only Private (₹5,500) carries a rate here. The
 * client's CA has the final say — admin can edit every rate afterwards.
 */
export async function setupStandardWards(
  actor: AuthUser,
  ctx: { ipAddress?: string; userAgent?: string }
): Promise<{ wards: number; beds: number }> {
  const PLAN = [
    { name: "General Ward", category: "GENERAL",      floor: "1st Floor", dailyCharge: 1500, gstRatePct: 0, beds: 10, prefix: "GW" },
    { name: "Semi-Private", category: "SEMI_PRIVATE", floor: "2nd Floor", dailyCharge: 3000, gstRatePct: 0, beds: 6,  prefix: "SP" },
    { name: "Private Room", category: "PRIVATE",      floor: "2nd Floor", dailyCharge: 5500, gstRatePct: 5, beds: 4,  prefix: "PR" },
    { name: "ICU",          category: "ICU",          floor: "3rd Floor", dailyCharge: 8000, gstRatePct: 0, beds: 4,  prefix: "ICU" },
  ];

  let bedCount = 0;
  for (const w of PLAN) {
    const ward = await prisma.ward.upsert({
      where: { name: w.name },
      update: {},
      create: {
        name: w.name, category: w.category, floor: w.floor,
        dailyCharge: w.dailyCharge.toFixed(2), gstRatePct: w.gstRatePct.toFixed(2), active: true,
      },
      select: { id: true },
    });
    for (let i = 1; i <= w.beds; i++) {
      const bedNo = `${w.prefix}-${String(i).padStart(2, "0")}`;
      await prisma.bed.upsert({
        where: { wardId_bedNo: { wardId: ward.id, bedNo } },
        update: {},
        create: { wardId: ward.id, bedNo, status: "AVAILABLE" },
      });
      bedCount++;
    }
  }

  await logAudit(actor, {
    action: "WARDS_STANDARD_SETUP", targetTable: "Ward", targetId: "bulk",
    meta: { wards: PLAN.length, beds: bedCount }, ...ctx,
  });
  return { wards: PLAN.length, beds: bedCount };
}

// ─────────────────────────────────────────────────────────────────────────────
// THE RUNNING TAB
// A stay is not just a bed. It's the bed PLUS everything done in it. Every
// procedure, oxygen hour, doctor's round and strip of medicine goes on this
// ledger, and the whole thing is billed once at discharge.
// ─────────────────────────────────────────────────────────────────────────────

export interface ChargeDTO {
  id: string; category: string; description: string;
  qty: number; unitPrice: string; gstRatePct: string; amount: string;
  addedBy: string; createdAt: string; fromPharmacy: boolean;
}

/** Add a line to an inpatient's tab. */
export async function addAdmissionCharge(
  actor: AuthUser,
  input: {
    admissionId: string; category: string; description: string;
    qty: number; unitPrice: number; gstRatePct?: number;
  },
  ctx: { ipAddress?: string; userAgent?: string }
): Promise<void> {
  const adm = await prisma.admission.findUnique({
    where: { id: input.admissionId },
    select: { id: true, status: true, ipNumber: true },
  });
  if (!adm) throw new ApiError(404, "Admission not found");
  if (adm.status !== "ADMITTED") {
    throw new ApiError(409, "This patient is already discharged — their bill is closed");
  }
  if (input.qty < 1) throw new ApiError(400, "Quantity must be at least 1");
  if (input.unitPrice < 0) throw new ApiError(400, "Price can't be negative");

  await prisma.admissionCharge.create({
    data: {
      admissionId: input.admissionId,
      // validated upstream against the ChargeCategory values; narrow for Prisma
      category: input.category as ChargeCategory,
      description: input.description.trim(),
      qty: input.qty,
      unitPrice: input.unitPrice.toFixed(2),
      gstRatePct: (input.gstRatePct ?? 0).toFixed(2),
      addedById: actor.id,
    },
  });
  await logAudit(actor, {
    action: "IPD_CHARGE_ADDED", targetTable: "Admission", targetId: input.admissionId,
    meta: { ipNumber: adm.ipNumber, description: input.description, amount: input.qty * input.unitPrice },
    ...ctx,
  });
}

/** Remove a line that was added by mistake. Only while the patient is still in. */
export async function removeAdmissionCharge(
  actor: AuthUser,
  chargeId: string,
  ctx: { ipAddress?: string; userAgent?: string }
): Promise<void> {
  const charge = await prisma.admissionCharge.findUnique({
    where: { id: chargeId },
    select: { id: true, sourceRef: true, admission: { select: { id: true, status: true, ipNumber: true } } },
  });
  if (!charge) throw new ApiError(404, "Charge not found");
  if (charge.admission.status !== "ADMITTED") {
    throw new ApiError(409, "That stay is already billed — the charge can't be removed");
  }
  if (charge.sourceRef) {
    // Deleting it here would silently un-bill medicine that physically left the shelf.
    throw new ApiError(400, "This came from a pharmacy dispense. Reverse it in the pharmacy, not here.");
  }
  await prisma.admissionCharge.delete({ where: { id: chargeId } });
  await logAudit(actor, {
    action: "IPD_CHARGE_REMOVED", targetTable: "Admission", targetId: charge.admission.id,
    meta: { ipNumber: charge.admission.ipNumber, chargeId }, ...ctx,
  });
}

/** The full running tab: bed so far + every charge, with a live total. */
export async function admissionSheet(admissionId: string): Promise<{
  admission: {
    id: string; ipNumber: string; status: string; admittedAt: string; reason: string | null;
    wardName: string; bedNo: string; dailyCharge: string; gstRatePct: string;
    attendantName: string | null; attendantPhone: string | null; attendantRelation: string | null;
    patient: { id: string; displayId: string; fullName: string; age: number | null; gender: string | null; phone: string };
    doctor: { name: string; department: string };
  };
  days: number;
  bedTotal: string;
  charges: ChargeDTO[];
  chargesTotal: string;
  grandTotal: string;
  /** One row per bed occupied. Two rows means they were transferred. */
  legs: { wardName: string; bedNo: string; dailyCharge: string; days: number; total: string; current: boolean }[];
  /** Deposit already held. Comes off the discharge bill. */
  advanceTotal: string;
  /** grandTotal − advanceTotal, floored at 0. What the family still owes today. */
  balance: string;
}> {
  const a = await prisma.admission.findUnique({
    where: { id: admissionId },
    select: {
      id: true, ipNumber: true, status: true, admittedAt: true, dischargedAt: true, reason: true,
      wardNameAtAdmit: true, dailyChargeAtAdmit: true, gstRatePctAtAdmit: true,
      attendantName: true, attendantPhone: true, attendantRelation: true,
      bed: { select: { bedNo: true } },
      patient: { select: { id: true, displayId: true, fullName: true, age: true, gender: true, phone: true } },
      doctor: { select: { name: true, department: true } },
      charges: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true, category: true, description: true, qty: true, unitPrice: true,
          gstRatePct: true, sourceRef: true, createdAt: true,
          addedBy: { select: { name: true } },
        },
      },
    },
  });
  if (!a) throw new ApiError(404, "Admission not found");

  type ChargeRow = {
    id: string; category: string; description: string; qty: number;
    unitPrice: { toString(): string }; gstRatePct: { toString(): string };
    sourceRef: string | null; createdAt: Date; addedBy: { name: string };
  };

  const days = stayDays(a.admittedAt, a.dischargedAt ?? new Date());
  // ── BED, PER LEG ──
  // A transferred patient did not spend the whole stay in one ward. Sum each leg
  // at the rate it actually carried, or the running bill on screen won't match
  // the invoice they get at discharge.
  const stays = await prisma.bedStay.findMany({
    where: { admissionId },
    orderBy: { fromDate: "asc" },
    select: {
      wardName: true, dailyCharge: true, fromDate: true, toDate: true,
      bed: { select: { bedNo: true } },
    },
  });

  type StayRow = {
    wardName: string; dailyCharge: { toString(): string };
    fromDate: Date; toDate: Date | null; bed: { bedNo: string } | null;
  };

  const until = a.dischargedAt ?? new Date();
  const legs = (stays as StayRow[]).map((st) => {
    const d = stayDays(st.fromDate, st.toDate ?? until);
    const daily = Number(st.dailyCharge.toString());
    return {
      wardName: st.wardName,
      bedNo: st.bed?.bedNo ?? "—",
      dailyCharge: daily.toFixed(2),
      days: d,
      total: (d * daily).toFixed(2),
      current: st.toDate === null,
    };
  });

  // Fall back to the flat rate only if no BedStay exists (pre-migration rows).
  const bedTotal = legs.length > 0
    ? legs.reduce((sum, l) => sum + Number(l.total), 0)
    : days * Number(a.dailyChargeAtAdmit.toString());

  // ── ADVANCE ── money the hospital is already holding for this stay.
  const advances = await prisma.admissionAdvance.findMany({
    where: { admissionId },
    select: { amount: true },
  });
  const advanceTotal = (advances as { amount: { toString(): string } }[])
    .reduce((sum, x) => sum + Number(x.amount.toString()), 0);

  const charges: ChargeDTO[] = (a.charges as ChargeRow[]).map((c) => {
    const amount = c.qty * Number(c.unitPrice.toString());
    return {
      id: c.id, category: c.category, description: c.description, qty: c.qty,
      unitPrice: c.unitPrice.toString(), gstRatePct: c.gstRatePct.toString(),
      amount: amount.toFixed(2),
      addedBy: c.addedBy.name,
      createdAt: c.createdAt.toISOString(),
      fromPharmacy: Boolean(c.sourceRef),
    };
  });
  const chargesTotal = charges.reduce((s, c) => s + Number(c.amount), 0);

  return {
    admission: {
      id: a.id, ipNumber: a.ipNumber, status: a.status,
      admittedAt: a.admittedAt.toISOString(), reason: a.reason,
      wardName: a.wardNameAtAdmit, bedNo: a.bed.bedNo,
      dailyCharge: a.dailyChargeAtAdmit.toString(), gstRatePct: a.gstRatePctAtAdmit.toString(),
      attendantName: a.attendantName, attendantPhone: a.attendantPhone, attendantRelation: a.attendantRelation,
      patient: a.patient, doctor: a.doctor,
    },
    days,
    bedTotal: bedTotal.toFixed(2),
    chargesTotal: chargesTotal.toFixed(2),
    grandTotal: (bedTotal + chargesTotal).toFixed(2),
    charges,
    legs,
    advanceTotal: advanceTotal.toFixed(2),
    // Never negative. An advance bigger than the bill is a REFUND owed, not a
    // negative debt that would quietly subtract from the day's takings.
    balance: Math.max(0, bedTotal + chargesTotal - advanceTotal).toFixed(2),
  };
}

/**
 * Post a pharmacy dispense to an inpatient's room instead of billing them at the
 * counter. An admitted patient does NOT pay for medicine at the pharmacy window —
 * it goes on the tab and settles at discharge. Returns false when the upload isn't
 * tied to a live admission, so the caller bills normally.
 */
export async function chargePharmacyToRoom(
  actor: AuthUser,
  input: {
    admissionId: string;
    lines: { description: string; qty: number; unitPrice: number; gstRatePct: number; batchId?: string }[];
  },
  tx?: Prisma.TransactionClient
): Promise<void> {
  const db = tx ?? prisma;
  for (const l of input.lines) {
    await db.admissionCharge.create({
      data: {
        admissionId: input.admissionId,
        category: "PHARMACY",
        description: l.description,
        qty: l.qty,
        unitPrice: l.unitPrice.toFixed(2),
        gstRatePct: l.gstRatePct.toFixed(2),
        sourceRef: l.batchId ?? "pharmacy",
        addedById: actor.id,
      },
    });
  }
}

/** Beds that can actually be filled right now, grouped by ward — for the admit form. */
export async function availableBeds(): Promise<{
  id: string; name: string; category: string; floor: string | null;
  dailyCharge: string; gstRatePct: string;
  beds: { id: string; bedNo: string }[];
}[]> {
  const wards = await prisma.ward.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: {
      id: true, name: true, category: true, floor: true, dailyCharge: true, gstRatePct: true,
      beds: {
        where: { status: "AVAILABLE" },
        orderBy: { bedNo: "asc" },
        select: { id: true, bedNo: true },
      },
    },
  });
  type W = {
    id: string; name: string; category: string; floor: string | null;
    dailyCharge: { toString(): string }; gstRatePct: { toString(): string };
    beds: { id: string; bedNo: string }[];
  };
  return (wards as W[]).map((w) => ({
    id: w.id, name: w.name, category: w.category, floor: w.floor,
    dailyCharge: w.dailyCharge.toString(), gstRatePct: w.gstRatePct.toString(),
    beds: w.beds,
  }));
}

/**
 * Is this patient in a bed RIGHT NOW?
 *
 * The single question the whole IP/OP switch turns on. Reception asks it the
 * moment a patient is picked, and everything downstream — where a prescription
 * files, where a lab test bills — follows from the answer. Returns null for an
 * outpatient, which is the overwhelmingly common case.
 */
export async function activeAdmissionFor(patientRef: string): Promise<{
  id: string; ipNumber: string; admittedAt: Date;
  wardName: string; bedNo: string;
  doctorName: string; reason: string | null;
} | null> {
  // Callers hold different handles on the same person: the search box has a UHID
  // (JMH2026OP00001), the inpatient picker has the internal id. Resolve either
  // rather than pushing that distinction onto the frontend.
  const patient = await prisma.patient.findFirst({
    where: { OR: [{ id: patientRef }, { displayId: patientRef.toUpperCase() }] },
    select: { id: true },
  });
  if (!patient) return null;

  const adm = await prisma.admission.findFirst({
    where: { patientId: patient.id, status: "ADMITTED" },
    orderBy: { admittedAt: "desc" },
    select: {
      id: true, ipNumber: true, admittedAt: true, reason: true,
      bed: { select: { bedNo: true, ward: { select: { name: true } } } },
      doctor: { select: { name: true } },
    },
  });
  if (!adm) return null;
  return {
    id: adm.id,
    ipNumber: adm.ipNumber,
    admittedAt: adm.admittedAt,
    wardName: adm.bed?.ward?.name ?? "—",
    bedNo: adm.bed?.bedNo ?? "—",
    doctorName: adm.doctor?.name ?? "—",
    reason: adm.reason,
  };
}

/**
 * TRANSFER a patient to another bed, mid-stay.
 *
 * General → ICU is the single most common event in a hospital, and until now the
 * only way to do it was discharge-and-readmit — which SPLITS ONE STAY INTO TWO
 * BILLS and hands the family two invoices for one illness.
 *
 * Instead: close the current BedStay, open a new one at the new ward's rate. The
 * old bed is freed, the new one taken, atomically. The discharge bill then prices
 * each leg on its own — 3 days General, 4 days ICU — which is both what actually
 * happened and what the patient should pay.
 */
export async function transferBed(
  actor: AuthUser,
  input: { admissionId: string; toBedId: string; reason?: string },
  ctx: { ipAddress?: string; userAgent?: string }
): Promise<{ ipNumber: string; fromWard: string; fromBed: string; toWard: string; toBed: string; newDailyCharge: string }> {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const adm = await tx.admission.findUnique({
      where: { id: input.admissionId },
      select: {
        id: true, ipNumber: true, status: true, bedId: true,
        bed: { select: { bedNo: true, ward: { select: { name: true } } } },
      },
    });
    if (!adm) throw new ApiError(404, "Admission not found");
    if (adm.status !== "ADMITTED") throw new ApiError(400, "That patient has already been discharged");
    if (adm.bedId === input.toBedId) throw new ApiError(400, "They're already in that bed");

    const toBed = await tx.bed.findUnique({
      where: { id: input.toBedId },
      select: {
        id: true, bedNo: true, status: true,
        ward: { select: { name: true, dailyCharge: true, gstRatePct: true } },
      },
    });
    if (!toBed) throw new ApiError(404, "That bed doesn't exist");
    if (toBed.status !== "AVAILABLE") throw new ApiError(409, "That bed isn't free");

    // Atomic claim — two clerks can't move two patients into one bed.
    const claim = await tx.bed.updateMany({
      where: { id: toBed.id, status: "AVAILABLE" },
      data: { status: "OCCUPIED" },
    });
    if (claim.count === 0) throw new ApiError(409, "That bed was just taken. Pick another.");

    const now = new Date();

    // close the leg they're leaving
    await tx.bedStay.updateMany({
      where: { admissionId: adm.id, toDate: null },
      data: { toDate: now },
    });

    // open the leg they're entering, priced at TODAY's rate for that ward
    await tx.bedStay.create({
      data: {
        admissionId: adm.id,
        bedId: toBed.id,
        wardName: toBed.ward.name,
        dailyCharge: toBed.ward.dailyCharge,
        gstRatePct: toBed.ward.gstRatePct,
        fromDate: now,
        reason: input.reason?.trim() || null,
        movedById: actor.id,
      },
    });

    // free the old bed, point the admission at the new one
    if (adm.bedId) {
      await tx.bed.update({ where: { id: adm.bedId }, data: { status: "AVAILABLE" } });
    }
    await tx.admission.update({
      where: { id: adm.id },
      data: { bedId: toBed.id, wardNameAtAdmit: toBed.ward.name, dailyChargeAtAdmit: toBed.ward.dailyCharge },
    });

    await logAudit(actor, {
      action: "BED_TRANSFERRED",
      targetTable: "Admission",
      targetId: adm.id,
      meta: {
        ipNumber: adm.ipNumber,
        from: `${adm.bed?.ward?.name} ${adm.bed?.bedNo}`,
        to: `${toBed.ward.name} ${toBed.bedNo}`,
        reason: input.reason ?? null,
      },
      ...ctx,
    }, tx);

    return {
      ipNumber: adm.ipNumber,
      fromWard: adm.bed?.ward?.name ?? "—",
      fromBed: adm.bed?.bedNo ?? "—",
      toWard: toBed.ward.name,
      toBed: toBed.bedNo,
      newDailyCharge: toBed.ward.dailyCharge.toString(),
    };
  });
}

/**
 * The deposit taken at admission.
 *
 * Every hospital takes one. Without it a family can run up lakhs and walk out,
 * and the hospital has no recourse. Adjusted against the discharge bill — and if
 * the advance turns out to EXCEED the final bill, the difference is refunded,
 * not quietly kept.
 */
export async function addAdvance(
  actor: AuthUser,
  input: { admissionId: string; amount: number; mode: string; reference?: string },
  ctx: { ipAddress?: string; userAgent?: string }
): Promise<{ ipNumber: string; totalAdvance: string }> {
  if (!(input.amount > 0)) throw new ApiError(400, "An advance must be more than ₹0");

  const adm = await prisma.admission.findUnique({
    where: { id: input.admissionId },
    select: { id: true, ipNumber: true, status: true },
  });
  if (!adm) throw new ApiError(404, "Admission not found");
  if (adm.status !== "ADMITTED") throw new ApiError(400, "That patient has already been discharged");

  await prisma.admissionAdvance.create({
    data: {
      admissionId: adm.id,
      // validated upstream against the PaymentMode values; narrow for Prisma
      mode: input.mode as PaymentMode,
      amount: Math.round(input.amount * 100) / 100,
      reference: input.reference?.trim() || null,
      receivedById: actor.id,
    },
  });

  const all = await prisma.admissionAdvance.findMany({
    where: { admissionId: adm.id },
    select: { amount: true },
  });
  const total = all.reduce((s: number, a: { amount: { toString(): string } }) => s + Number(a.amount.toString()), 0);

  await logAudit(actor, {
    action: "IPD_ADVANCE_TAKEN",
    targetTable: "Admission",
    targetId: adm.id,
    meta: { ipNumber: adm.ipNumber, amount: input.amount, mode: input.mode },
    ...ctx,
  });

  return { ipNumber: adm.ipNumber, totalAdvance: total.toFixed(2) };
}

/** Free beds a patient could be moved INTO — never their own, never occupied. */
export async function transferTargets(admissionId: string): Promise<{
  wards: { id: string; name: string; dailyCharge: string; gstRatePct: string; beds: { id: string; bedNo: string }[] }[];
}> {
  const adm = await prisma.admission.findUnique({
    where: { id: admissionId },
    select: { bedId: true },
  });
  const wards = await prisma.ward.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true, name: true, dailyCharge: true, gstRatePct: true,
      beds: {
        where: { status: "AVAILABLE", id: { not: adm?.bedId ?? "" } },
        orderBy: { bedNo: "asc" },
        select: { id: true, bedNo: true },
      },
    },
  });
  return {
    wards: wards
      .filter((w: { beds: unknown[] }) => w.beds.length > 0)
      .map((w: { id: string; name: string; dailyCharge: { toString(): string }; gstRatePct: { toString(): string }; beds: { id: string; bedNo: string }[] }) => ({
        id: w.id, name: w.name,
        dailyCharge: w.dailyCharge.toString(),
        gstRatePct: w.gstRatePct.toString(),
        beds: w.beds,
      })),
  };
}
