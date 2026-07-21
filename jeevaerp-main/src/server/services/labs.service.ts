import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { storeFile } from "@/lib/storage";
import { logAudit } from "./audit.service";
import { createInvoice, type BillLineInput } from "./billing.service";
import { collectionByMode, type ModeTotal } from "./reports.service";
import type { AuthUser } from "@/lib/auth/types";
import type { Prisma } from "@prisma/client";

export interface CatalogItemDTO {
  id: string; name: string; code: string | null; price: string; gstRatePct: string; active: boolean;
}
export interface LabTestDTO {
  id: string; testName: string; status: string; price: string | null;
  reportFileUrl: string | null; createdAt: string; completedAt: string | null;
  patient: { id: string; displayId: string; fullName: string; phone: string } | null;
  appointment: { opNumber: string; doctorName: string; visitDate: string } | null;
  billed: boolean;
}

/** Active test catalog (what the lab can order/bill). */
export async function listCatalog(): Promise<CatalogItemDTO[]> {
  const rows = await prisma.labTestCatalog.findMany({
    where: { active: true }, orderBy: { name: "asc" },
    select: { id: true, name: true, code: true, price: true, gstRatePct: true, active: true },
  });
  return rows.map((c: { id: string; name: string; code: string | null; price: { toString(): string }; gstRatePct: { toString(): string }; active: boolean }) => ({
    id: c.id, name: c.name, code: c.code, price: c.price.toString(), gstRatePct: c.gstRatePct.toString(), active: c.active,
  }));
}

const testSelect = {
  id: true, testName: true, status: true, priceAtOrder: true,
  reportFileUrl: true, createdAt: true, completedAt: true,
  patient: { select: { id: true, displayId: true, fullName: true, phone: true } },
  appointment: {
    select: {
      opNumber: true, visitDate: true,
      doctor: { select: { name: true } },
      patient: { select: { id: true, displayId: true, fullName: true, phone: true } },
    },
  },
  invoiceItems: { select: { id: true } },
} as const;

type TestRow = {
  id: string; testName: string; status: string; priceAtOrder: { toString(): string } | null;
  reportFileUrl: string | null; createdAt: Date; completedAt: Date | null;
  patient: { id: string; displayId: string; fullName: string; phone: string } | null;
  appointment: {
    opNumber: string; visitDate: Date; doctor: { name: string };
    patient: { id: string; displayId: string; fullName: string; phone: string };
  } | null;
  invoiceItems: { id: string }[];
};

function toTestDTO(t: TestRow): LabTestDTO {
  // A test links to a patient directly (walk-in) or via its appointment.
  const p = t.patient ?? t.appointment?.patient ?? null;
  return {
    id: t.id, testName: t.testName, status: t.status,
    price: t.priceAtOrder ? t.priceAtOrder.toString() : null,
    reportFileUrl: t.reportFileUrl,
    createdAt: t.createdAt.toISOString(),
    completedAt: t.completedAt ? t.completedAt.toISOString() : null,
    patient: p,
    appointment: t.appointment
      ? { opNumber: t.appointment.opNumber, doctorName: t.appointment.doctor.name, visitDate: t.appointment.visitDate.toISOString().slice(0, 10) }
      : null,
    billed: t.invoiceItems.length > 0,
  };
}

/** The lab work queue — pending first, newest first. */
export async function listLabTests(status?: "PENDING" | "COMPLETED"): Promise<LabTestDTO[]> {
  const rows: TestRow[] = await prisma.labTest.findMany({
    where: status ? { status } : {},
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
    select: testSelect,
  });
  return rows.map(toTestDTO);
}

/** Order one or more tests for a patient (walk-in — no doctor visit needed). */
/**
 * Order tests for a patient.
 *
 * If the patient is ADMITTED, the tests belong to the stay, not to a visit —
 * they file against the admission and the money posts to the ROOM TAB, exactly
 * like pharmacy. Nobody chases an inpatient's family to the lab counter with a
 * bill; it all settles once, at discharge.
 *
 * The caller doesn't have to know. We look it up.
 */
export async function orderTests(
  actor: AuthUser,
  input: { patientId: string; catalogIds: string[]; appointmentId?: string },
  ctx: { ipAddress?: string; userAgent?: string }
): Promise<LabTestDTO[] & { chargedToRoom?: boolean }> {
  if (!input.catalogIds.length) throw new ApiError(400, "Select at least one test");

  const patient = await prisma.patient.findUnique({
    where: { id: input.patientId },
    select: { id: true, mergedIntoId: true, deletedAt: true },
  });
  if (!patient || patient.mergedIntoId || patient.deletedAt) throw new ApiError(404, "Patient not found");

  const catalog = await prisma.labTestCatalog.findMany({
    where: { id: { in: input.catalogIds }, active: true },
    select: { id: true, name: true, price: true },
  });
  if (catalog.length !== input.catalogIds.length) throw new ApiError(400, "One or more tests are unavailable");

  // Is this patient in a bed? That single fact decides where the money goes.
  const admission = await prisma.admission.findFirst({
    where: { patientId: input.patientId, status: "ADMITTED" },
    orderBy: { admittedAt: "desc" },
    select: { id: true, ipNumber: true },
  });

  const created = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const ids: string[] = [];
    for (const c of catalog) {
      const t = await tx.labTest.create({
        data: {
          patientId: input.patientId,
          // an inpatient's test hangs off the STAY; an outpatient's off the visit
          appointmentId: admission ? null : (input.appointmentId ?? null),
          admissionId: admission?.id ?? null,
          catalogId: c.id,
          testName: c.name,
          priceAtOrder: c.price, // snapshot — survives catalog price changes
          status: "PENDING",
        },
        select: { id: true },
      });
      ids.push(t.id);

      // INPATIENT: post it straight to the room tab. Diagnostics are GST-exempt.
      if (admission) {
        await tx.admissionCharge.create({
          data: {
            admissionId: admission.id,
            category: "INVESTIGATION",
            description: c.name,
            qty: 1,
            unitPrice: c.price,
            gstRatePct: 0,
            addedById: actor.id,
          },
        });
      }
    }
    await logAudit(actor, {
      action: admission ? "LAB_TESTS_ORDERED_IP" : "LAB_TESTS_ORDERED",
      targetTable: "LabTest", targetId: ids[0],
      meta: { count: ids.length, patientId: input.patientId, ipNumber: admission?.ipNumber ?? null },
      ...ctx,
    }, tx);
    return ids;
  });

  const rows: TestRow[] = await prisma.labTest.findMany({ where: { id: { in: created } }, select: testSelect });
  const dtos = rows.map(toTestDTO) as LabTestDTO[] & { chargedToRoom?: boolean };
  // The UI must be able to say "do not take money" — same contract as pharmacy.
  dtos.chargedToRoom = !!admission;
  return dtos;
}

/** Upload a report file and mark the test completed. */
export async function uploadReport(
  actor: AuthUser,
  input: { labTestId: string; file: { buffer: Buffer; fileName: string; mimeType: string; size: number } },
  ctx: { ipAddress?: string; userAgent?: string }
): Promise<LabTestDTO> {
  const allowed = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
  if (!allowed.has(input.file.mimeType)) throw new ApiError(400, "Only PDF, JPG, PNG or WebP reports are allowed");
  if (input.file.size > 10 * 1024 * 1024) throw new ApiError(400, "File too large (max 10 MB)");

  const test = await prisma.labTest.findUnique({ where: { id: input.labTestId }, select: { id: true } });
  if (!test) throw new ApiError(404, "Test not found");

  const stored = await storeFile(input.file.buffer, { fileName: input.file.fileName, mimeType: input.file.mimeType, folder: "jeeva/lab-reports" });

  await prisma.labTest.update({
    where: { id: input.labTestId },
    data: {
      reportFileUrl: stored.fileUrl,
      reportUploadedAt: new Date(),
      status: "COMPLETED",
      completedAt: new Date(),
      technicianId: actor.id,
    },
  });
  await logAudit(actor, { action: "LAB_REPORT_UPLOADED", targetTable: "LabTest", targetId: input.labTestId, ...ctx });

  const row: TestRow | null = await prisma.labTest.findUnique({ where: { id: input.labTestId }, select: testSelect });
  if (!row) throw new ApiError(404, "Test not found");
  return toTestDTO(row);
}

/** Mark a test completed without a file (result given on paper). */
export async function completeTest(actor: AuthUser, labTestId: string, ctx: { ipAddress?: string; userAgent?: string }): Promise<LabTestDTO> {
  const test = await prisma.labTest.findUnique({ where: { id: labTestId }, select: { id: true, status: true } });
  if (!test) throw new ApiError(404, "Test not found");
  if (test.status === "COMPLETED") throw new ApiError(400, "This test is already completed");

  await prisma.labTest.update({
    where: { id: labTestId },
    data: { status: "COMPLETED", completedAt: new Date(), technicianId: actor.id },
  });
  await logAudit(actor, { action: "LAB_TEST_COMPLETED", targetTable: "LabTest", targetId: labTestId, ...ctx });

  const row: TestRow | null = await prisma.labTest.findUnique({ where: { id: labTestId }, select: testSelect });
  if (!row) throw new ApiError(404, "Test not found");
  return toTestDTO(row);
}

/**
 * Generate a GST bill for one or more lab tests. GST rate comes from each
 * test's catalog entry (0% = exempt, the correct default for diagnostics —
 * the hospital's CA can set real rates per test in the catalog).
 */
export async function billLabTests(
  actor: AuthUser,
  input: {
    patientId: string;
    labTestIds: string[];
    discountAmount?: number;
    payment?: { mode: "CASH" | "UPI" | "CARD" | "NETBANKING" | "OTHER"; amount: number; reference?: string };
    payments?: { mode: "CASH" | "UPI" | "CARD" | "NETBANKING" | "OTHER"; amount: number; reference?: string }[];
  },
  ctx: { ipAddress?: string; userAgent?: string }
) {
  if (!input.labTestIds.length) throw new ApiError(400, "Select at least one test to bill");

  const tests = await prisma.labTest.findMany({
    where: { id: { in: input.labTestIds } },
    select: {
      id: true, testName: true, priceAtOrder: true, patientId: true,
      appointmentId: true,
      catalog: { select: { gstRatePct: true, code: true } },
      invoiceItems: { select: { id: true } },
      appointment: { select: { patientId: true } },
    },
  });
  if (tests.length !== input.labTestIds.length) throw new ApiError(400, "One or more tests not found");

  const lines: BillLineInput[] = [];
  for (const t of tests) {
    if (t.invoiceItems.length > 0) throw new ApiError(400, `"${t.testName}" is already billed`);
    const owner = t.patientId ?? t.appointment?.patientId;
    if (owner !== input.patientId) throw new ApiError(400, "A test doesn't belong to this patient");
    lines.push({
      description: t.testName,
      qty: 1,
      unitPrice: Number(t.priceAtOrder?.toString() ?? 0),
      gstRatePct: Number(t.catalog?.gstRatePct?.toString() ?? 0),
      hsnSac: t.catalog?.code ?? undefined,
      labTestId: t.id,
    });
  }

  const appointmentId = tests.find((t: { appointmentId: string | null }) => t.appointmentId)?.appointmentId ?? undefined;

  return createInvoice(
    actor,
    { patientId: input.patientId, source: "LAB", appointmentId, lines, discountAmount: input.discountAmount, payment: input.payment, payments: input.payments },
    ctx
  );
}

/** Lab dashboard counters. */
export async function labStats(): Promise<{
  pending: number; completedToday: number; totalToday: number; revenueToday: string; unbilled: number;
  collections: ModeTotal[];
}> {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);

  const [pending, completedToday, totalToday, invoices, unbilled] = await Promise.all([
    prisma.labTest.count({ where: { status: "PENDING" } }),
    prisma.labTest.count({ where: { status: "COMPLETED", completedAt: { gte: today, lt: tomorrow } } }),
    prisma.labTest.count({ where: { createdAt: { gte: today, lt: tomorrow } } }),
    prisma.invoice.findMany({
      where: { source: "LAB", createdAt: { gte: today, lt: tomorrow }, status: { not: "CANCELLED" } },
      select: { totalAmount: true },
    }),
    prisma.labTest.count({ where: { invoiceItems: { none: {} } } }),
  ]);

  const revenue = invoices.reduce((s: number, i: { totalAmount: { toString(): string } }) => s + Number(i.totalAmount.toString()), 0);
  // What the lab till took today, split by payment type.
  const collections = await collectionByMode({ sources: ["LAB"] });
  return { pending, completedToday, totalToday, revenueToday: revenue.toFixed(2), unbilled, collections: collections.modes };
}

/** A patient's lab history + last visit — what the lab needs at the counter. */
export async function patientLabHistory(displayId: string): Promise<{
  patient: { id: string; displayId: string; fullName: string; phone: string; age: number | null; gender: string | null; bloodGroup: string | null };
  lastVisit: { opNumber: string; visitDate: string; doctorName: string; department: string; status: string } | null;
  tests: LabTestDTO[];
  invoices: { receiptNo: string; totalAmount: string; status: string; createdAt: string }[];
}> {
  const patient = await prisma.patient.findUnique({
    where: { displayId },
    select: {
      id: true, displayId: true, fullName: true, phone: true, age: true,
      gender: true, bloodGroup: true, mergedIntoId: true, deletedAt: true,
    },
  });
  if (!patient || patient.mergedIntoId || patient.deletedAt) throw new ApiError(404, "No patient found with that ID");

  const [lastAppt, tests, invoices] = await Promise.all([
    prisma.appointment.findFirst({
      where: { patientId: patient.id },
      orderBy: { visitDate: "desc" },
      select: { opNumber: true, visitDate: true, status: true, doctor: { select: { name: true, department: true } } },
    }),
    prisma.labTest.findMany({
      where: { OR: [{ patientId: patient.id }, { appointment: { patientId: patient.id } }] },
      orderBy: { createdAt: "desc" }, take: 50, select: testSelect,
    }),
    prisma.invoice.findMany({
      where: { patientId: patient.id, source: "LAB" },
      orderBy: { createdAt: "desc" }, take: 20,
      select: { receiptNo: true, totalAmount: true, status: true, createdAt: true },
    }),
  ]);

  return {
    patient: {
      id: patient.id, displayId: patient.displayId, fullName: patient.fullName, phone: patient.phone,
      age: patient.age, gender: patient.gender, bloodGroup: patient.bloodGroup,
    },
    lastVisit: lastAppt
      ? {
          opNumber: lastAppt.opNumber,
          visitDate: lastAppt.visitDate.toISOString().slice(0, 10),
          doctorName: lastAppt.doctor.name,
          department: lastAppt.doctor.department,
          status: lastAppt.status,
        }
      : null,
    tests: (tests as TestRow[]).map(toTestDTO),
    invoices: invoices.map((i: { receiptNo: string; totalAmount: { toString(): string }; status: string; createdAt: Date }) => ({
      receiptNo: i.receiptNo, totalAmount: i.totalAmount.toString(), status: i.status, createdAt: i.createdAt.toISOString(),
    })),
  };
}

/** Remove a lab report file and reopen the test (back to PENDING). */
export async function removeReport(
  actor: AuthUser,
  labTestId: string,
  ctx: { ipAddress?: string; userAgent?: string }
): Promise<LabTestDTO> {
  const test = await prisma.labTest.findUnique({ where: { id: labTestId }, select: { id: true, reportFileUrl: true } });
  if (!test) throw new ApiError(404, "Test not found");
  if (!test.reportFileUrl) throw new ApiError(400, "This test has no report to remove");

  await prisma.labTest.update({
    where: { id: labTestId },
    data: { reportFileUrl: null, reportUploadedAt: null, status: "PENDING", completedAt: null },
  });
  await logAudit(actor, { action: "LAB_REPORT_REMOVED", targetTable: "LabTest", targetId: labTestId, ...ctx });

  const row: TestRow | null = await prisma.labTest.findUnique({ where: { id: labTestId }, select: testSelect });
  if (!row) throw new ApiError(404, "Test not found");
  return toTestDTO(row);
}
