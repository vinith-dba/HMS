import { collectionByMode, type ModeTotal } from "./reports.service";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { logAudit } from "./audit.service";
import { chargePharmacyToRoom } from "./ipd.service";
import { createInvoice, type BillLineInput } from "./billing.service";
import type { AuthUser } from "@/lib/auth/types";
import type { Prisma } from "@prisma/client";

const r2 = (n: number) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------------------
// The clinical reality this models: the doctor writes the prescription BY HAND.
// Reception scans it and dispatches it here. The pharmacist reads the scan on
// screen, picks the medicines, and the system does FEFO batch selection,
// stock decrement, traceability and GST billing.
// ---------------------------------------------------------------------------

export interface MedicineDTO {
  id: string; name: string; genericName: string | null; manufacturer: string | null;
  hsnCode: string | null; gstRatePct: string; unit: string; rackLocation: string | null;
  reorderThreshold: number; active: boolean;
  courseCritical: boolean;   // antibiotic / TB drug — a partial course is harmful
  inStock: number;              // sum of non-expired batch qty
  expiredQty: number;           // expired stock STILL PHYSICALLY ON THE SHELF — must be pulled
  mrp: string | null;           // MRP of the batch we'd dispense next (FEFO)
  nearestExpiry: string | null; // that batch's expiry
  lowStock: boolean;
}

/** Catalog with live stock. Stock excludes expired batches — they can't be sold. */
export async function listMedicines(query?: string): Promise<MedicineDTO[]> {
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const meds = await prisma.medicine.findMany({
    where: {
      active: true,
      ...(query
        ? { OR: [
            { name: { contains: query, mode: "insensitive" } },
            { genericName: { contains: query, mode: "insensitive" } },
          ] }
        : {}),
    },
    orderBy: { name: "asc" },
    take: 200,
    select: {
      id: true, name: true, genericName: true, manufacturer: true, hsnCode: true,
      gstRatePct: true, unit: true, rackLocation: true, reorderThreshold: true, active: true,
      courseCritical: true,
      batches: {
        // ALL batches with stock — expired ones are split out below so the
        // pharmacist is told what to physically pull off the shelf.
        where: { quantity: { gt: 0 } },
        orderBy: { expiryDate: "asc" }, // FEFO
        select: { quantity: true, mrp: true, expiryDate: true },
      },
    },
  });

  type Row = {
    id: string; name: string; genericName: string | null; manufacturer: string | null;
    hsnCode: string | null; gstRatePct: { toString(): string }; unit: string;
    rackLocation: string | null; reorderThreshold: number; active: boolean; courseCritical: boolean;
    batches: { quantity: number; mrp: { toString(): string }; expiryDate: Date }[];
  };

  return (meds as Row[]).map((m) => {
    const live = m.batches.filter((b) => b.expiryDate >= today);
    const expired = m.batches.filter((b) => b.expiryDate < today);
    const inStock = live.reduce((s, b) => s + b.quantity, 0);
    const first = live[0]; // FEFO: the batch we'd dispense next
    return {
      id: m.id, name: m.name, genericName: m.genericName, manufacturer: m.manufacturer,
      hsnCode: m.hsnCode, gstRatePct: m.gstRatePct.toString(), unit: m.unit,
      rackLocation: m.rackLocation, reorderThreshold: m.reorderThreshold, active: m.active,
      courseCritical: m.courseCritical,
      inStock,
      expiredQty: expired.reduce((s, b) => s + b.quantity, 0),
      mrp: first ? first.mrp.toString() : null,
      nearestExpiry: first ? first.expiryDate.toISOString().slice(0, 10) : null,
      lowStock: inStock <= m.reorderThreshold,
    };
  });
}

/** Receive stock (a purchase). Creates/tops-up a batch and writes the ledger. */
export async function addBatch(
  actor: AuthUser,
  input: { medicineId: string; batchNo: string; expiryDate: string; quantity: number; mrp: number; purchasePrice?: number; supplierRef?: string },
  ctx: { ipAddress?: string; userAgent?: string }
): Promise<void> {
  if (input.quantity <= 0) throw new ApiError(400, "Quantity must be at least 1");

  const expiry = new Date(input.expiryDate);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (expiry < today) throw new ApiError(400, "That batch has already expired");

  const med = await prisma.medicine.findUnique({ where: { id: input.medicineId }, select: { id: true, name: true } });
  if (!med) throw new ApiError(404, "Medicine not found");

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // A batch number is unique per medicine — receiving the same batch again tops it up.
    const batch = await tx.stockBatch.upsert({
      where: { medicineId_batchNo: { medicineId: input.medicineId, batchNo: input.batchNo.trim() } },
      update: {
        quantity: { increment: input.quantity },
        mrp: input.mrp.toFixed(2),
        ...(input.purchasePrice !== undefined ? { purchasePrice: input.purchasePrice.toFixed(2) } : {}),
      },
      create: {
        medicineId: input.medicineId,
        batchNo: input.batchNo.trim(),
        expiryDate: expiry,
        quantity: input.quantity,
        mrp: input.mrp.toFixed(2),
        purchasePrice: input.purchasePrice !== undefined ? input.purchasePrice.toFixed(2) : null,
      },
      select: { id: true },
    });

    await tx.stockTransaction.create({
      data: {
        batchId: batch.id, type: "PURCHASE", qty: input.quantity,
        refId: input.supplierRef?.trim() || null,
        reason: "Stock received", performedById: actor.id,
      },
    });

    await logAudit(actor, { action: "STOCK_RECEIVED", targetTable: "StockBatch", targetId: batch.id, meta: { medicine: med.name, qty: input.quantity, batchNo: input.batchNo }, ...ctx }, tx);
  });
}

export interface BulkBatchRow {
  medicineId?: string;
  medicine?: string;
  /// create the medicine (by name) if it isn't already in the catalog
  createNew?: boolean;
  hsn?: string;
  gstRatePct?: number;
  batchNo: string;
  expiryDate: string;
  quantity: number;
  mrp: number;
  purchasePrice?: number;
  supplierRef?: string;
}
export interface BulkBatchResult { row: number; medicine: string; batchNo: string; ok: boolean; error?: string; created?: boolean; }

/**
 * Receive many batches at once — from a parsed spreadsheet or a keyed-in
 * scanned invoice. Each row is committed on its own, so one bad line (a
 * medicine that isn't in the catalog, an expired date) fails alone and the
 * rest still land. Returns a per-row report so the counter can see exactly
 * what went in and what didn't.
 */
export async function bulkAddBatches(
  actor: AuthUser,
  rows: BulkBatchRow[],
  ctx: { ipAddress?: string; userAgent?: string }
): Promise<{ created: number; createdMedicines: number; results: BulkBatchResult[] }> {
  const meds = await prisma.medicine.findMany({ where: { active: true }, select: { id: true, name: true, genericName: true } });
  const byName = new Map<string, { id: string; name: string }>();
  for (const m of meds) {
    byName.set(m.name.trim().toLowerCase(), { id: m.id, name: m.name });
    if (m.genericName) byName.set(m.genericName.trim().toLowerCase(), { id: m.id, name: m.name });
  }
  const byId = new Map(meds.map((m) => [m.id, m.name]));
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const results: BulkBatchResult[] = [];
  let created = 0;
  let createdMedicines = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const label = (r.medicine || r.medicineId || "").toString();
    try {
      let medId = r.medicineId;
      let medName = label;
      let medNew = false;
      if (medId) {
        const nm = byId.get(medId);
        if (!nm) throw new Error("Medicine not found in catalog");
        medName = nm;
      } else {
        const nameKey = (r.medicine || "").trim().toLowerCase();
        const found = byName.get(nameKey);
        if (found) {
          medId = found.id; medName = found.name;
        } else if (r.createNew && (r.medicine || "").trim().length > 1) {
          // New product off the invoice — create it, then stock it. name is unique.
          const nm = r.medicine!.trim();
          const med = await prisma.medicine.upsert({
            where: { name: nm },
            update: {},
            create: { name: nm, hsnCode: r.hsn?.trim() || null, gstRatePct: (r.gstRatePct ?? 5).toFixed(2), unit: "unit" },
            select: { id: true },
          });
          medId = med.id; medName = nm;
          if (!byId.has(med.id)) {
            createdMedicines++; medNew = true;
            byId.set(med.id, nm); byName.set(nameKey, { id: med.id, name: nm });
            await logAudit(actor, { action: "MEDICINE_CREATED", targetTable: "Medicine", targetId: med.id, meta: { name: nm, source: "invoice-import" }, ...ctx });
          }
        } else {
          throw new Error(`"${r.medicine}" is not in the catalog`);
        }
      }

      const qty = Math.floor(r.quantity);
      if (!(qty > 0)) throw new Error("Quantity must be at least 1");
      const expiry = new Date(r.expiryDate);
      if (Number.isNaN(expiry.getTime())) throw new Error("Invalid expiry date");
      if (expiry < today) throw new Error("Batch has already expired");

      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const batch = await tx.stockBatch.upsert({
          where: { medicineId_batchNo: { medicineId: medId!, batchNo: r.batchNo.trim() } },
          update: {
            quantity: { increment: qty },
            mrp: r.mrp.toFixed(2),
            ...(r.purchasePrice !== undefined ? { purchasePrice: r.purchasePrice.toFixed(2) } : {}),
          },
          create: {
            medicineId: medId!,
            batchNo: r.batchNo.trim(),
            expiryDate: expiry,
            quantity: qty,
            mrp: r.mrp.toFixed(2),
            purchasePrice: r.purchasePrice !== undefined ? r.purchasePrice.toFixed(2) : null,
          },
          select: { id: true },
        });
        await tx.stockTransaction.create({
          data: { batchId: batch.id, type: "PURCHASE", qty, refId: r.supplierRef?.trim() || null, reason: "Bulk import", performedById: actor.id },
        });
        await logAudit(actor, { action: "STOCK_RECEIVED", targetTable: "StockBatch", targetId: batch.id, meta: { medicine: medName, qty, batchNo: r.batchNo, source: "bulk" }, ...ctx }, tx);
      });

      created++;
      results.push({ row: i + 1, medicine: medName, batchNo: r.batchNo, ok: true, created: medNew });
    } catch (e) {
      results.push({ row: i + 1, medicine: label, batchNo: r.batchNo || "", ok: false, error: e instanceof Error ? e.message : "Failed" });
    }
  }

  return { created, createdMedicines, results };
}

/** Manual stock correction (damage, count mismatch, expiry write-off). */
export async function adjustStock(
  actor: AuthUser,
  input: { batchId: string; delta: number; reason: string },
  ctx: { ipAddress?: string; userAgent?: string }
): Promise<void> {
  if (!input.reason?.trim()) throw new ApiError(400, "A reason is required for a stock adjustment");
  if (input.delta === 0) throw new ApiError(400, "Adjustment can't be zero");

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const batch = await tx.stockBatch.findUnique({ where: { id: input.batchId }, select: { id: true, quantity: true } });
    if (!batch) throw new ApiError(404, "Batch not found");
    if (batch.quantity + input.delta < 0) throw new ApiError(400, "That would take stock below zero");

    await tx.stockBatch.update({ where: { id: input.batchId }, data: { quantity: { increment: input.delta } } });
    await tx.stockTransaction.create({
      data: { batchId: input.batchId, type: "ADJUSTMENT", qty: input.delta, reason: input.reason.trim(), performedById: actor.id },
    });
    await logAudit(actor, { action: "STOCK_ADJUSTED", targetTable: "StockBatch", targetId: input.batchId, meta: { delta: input.delta, reason: input.reason }, ...ctx }, tx);
  });
}

/**
 * FEFO — First Expiry, First Out. The correct rule for pharmacy: always dispense
 * the batch that expires soonest, so stock doesn't die on the shelf. A single
 * line may span several batches if one doesn't cover the quantity.
 */
async function pickBatchesFEFO(
  tx: Prisma.TransactionClient,
  medicineId: string,
  qtyNeeded: number
): Promise<{ batchId: string; batchNo: string; qty: number; mrp: number }[]> {
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const batches = await tx.stockBatch.findMany({
    where: { medicineId, quantity: { gt: 0 }, expiryDate: { gte: today } },
    orderBy: { expiryDate: "asc" }, // soonest expiry first
    select: { id: true, batchNo: true, quantity: true, mrp: true },
  });

  const picks: { batchId: string; batchNo: string; qty: number; mrp: number }[] = [];
  let remaining = qtyNeeded;

  for (const b of batches as { id: string; batchNo: string; quantity: number; mrp: { toString(): string } }[]) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, b.quantity);
    picks.push({ batchId: b.id, batchNo: b.batchNo, qty: take, mrp: Number(b.mrp.toString()) });
    remaining -= take;
  }

  if (remaining > 0) {
    const med = await tx.medicine.findUnique({ where: { id: medicineId }, select: { name: true } });
    const have = qtyNeeded - remaining;
    throw new ApiError(400, `Not enough stock for ${med?.name ?? "that medicine"} — need ${qtyNeeded}, only ${have} available`);
  }
  return picks;
}

/**
 * Dispense against a scanned prescription (or as a walk-in OTC sale).
 * Decrements stock FEFO, writes a ledger row per batch, and raises a TAXABLE
 * GST invoice — medicines are 5%/12%, unlike diagnostics which are exempt.
 */
export async function dispense(
  actor: AuthUser,
  input: {
    patientId: string;
    prescriptionUploadId?: string;
    items: { medicineId: string; qty: number }[];
    discountAmount?: number;
    /** Set when the patient is taking less than was prescribed — recorded on the bill. */
    shortSupplyReason?: string;
    payment?: { mode: "CASH" | "UPI" | "CARD" | "NETBANKING" | "OTHER"; amount: number; reference?: string };
    payments?: { mode: "CASH" | "UPI" | "CARD" | "NETBANKING" | "OTHER"; amount: number; reference?: string }[];
  },
  ctx: { ipAddress?: string; userAgent?: string }
) {
  if (!input.items.length) throw new ApiError(400, "Add at least one medicine");

  // Resolve batches + build bill lines inside a transaction so stock can't race.
  const lines = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const built: BillLineInput[] = [];

    for (const item of input.items) {
      if (item.qty <= 0) throw new ApiError(400, "Quantity must be at least 1");

      const med = await tx.medicine.findUnique({
        where: { id: item.medicineId },
        select: { id: true, name: true, unit: true, hsnCode: true, gstRatePct: true },
      });
      if (!med) throw new ApiError(404, "Medicine not found");

      const picks = await pickBatchesFEFO(tx, item.medicineId, item.qty);

      for (const p of picks) {
        // decrement stock
        await tx.stockBatch.update({ where: { id: p.batchId }, data: { quantity: { decrement: p.qty } } });
        // ledger row — full traceability of which batch went to which patient
        await tx.stockTransaction.create({
          data: { batchId: p.batchId, type: "DISPENSE", qty: -p.qty, reason: "Dispensed", performedById: actor.id },
        });
        // one bill line per batch, so the invoice shows the exact batch
        built.push({
          description: `${med.name} (${med.unit}) · Batch ${p.batchNo}`,
          qty: p.qty,
          unitPrice: p.mrp, // Indian pharmacies bill at printed MRP
          gstRatePct: Number(med.gstRatePct.toString()),
          hsnSac: med.hsnCode ?? undefined,
          batchId: p.batchId,
        });
      }
    }
    return built;
  });

  // ── Is this patient lying in a bed upstairs? ────────────────────────────────
  // An admitted patient does NOT pay at the medicine counter. The medicine goes
  // on their room tab and settles in the discharge bill. Billing them here would
  // make them pay twice — once at the window, once at discharge.
  const liveAdmission = await prisma.admission.findFirst({
    where: { patientId: input.patientId, status: "ADMITTED" },
    select: { id: true, ipNumber: true },
  });

  if (liveAdmission) {
    await chargePharmacyToRoom(actor, {
      admissionId: liveAdmission.id,
      lines: lines.map((l: BillLineInput) => ({
        description: l.description,
        qty: l.qty ?? 1,
        unitPrice: l.unitPrice,
        gstRatePct: l.gstRatePct ?? 0,
        batchId: l.batchId,
      })),
    });

    if (input.prescriptionUploadId) {
      await prisma.prescriptionUpload.update({
        where: { id: input.prescriptionUploadId },
        data: { status: "DISPENSED", dispensedAt: new Date(), dispensedById: actor.id },
      });
    }
    await logAudit(actor, {
      action: "PHARMACY_CHARGED_TO_ROOM", targetTable: "Admission", targetId: liveAdmission.id,
      meta: { ipNumber: liveAdmission.ipNumber, lines: lines.length }, ...ctx,
    });

    // No invoice — deliberately. The caller is told so it can say so on screen.
    return { chargedToRoom: true as const, ipNumber: liveAdmission.ipNumber, invoice: null };
  }

  const invoice = await createInvoice(
    actor,
    {
      patientId: input.patientId,
      source: "PHARMACY",
      prescriptionUploadId: input.prescriptionUploadId,
      lines,
      discountAmount: input.discountAmount,
      notes: input.shortSupplyReason ? `Short supply: ${input.shortSupplyReason}` : undefined,
      payment: input.payment,
      payments: input.payments,
    },
    ctx
  );

  // Close the loop on the scanned prescription.
  if (input.prescriptionUploadId) {
    await prisma.prescriptionUpload.update({
      where: { id: input.prescriptionUploadId },
      data: { status: "DISPENSED", dispensedAt: new Date(), dispensedById: actor.id },
    });
  }

  await logAudit(actor, { action: "MEDICINES_DISPENSED", targetTable: "Invoice", targetId: invoice.id, meta: { lines: lines.length, prescriptionUploadId: input.prescriptionUploadId ?? null }, ...ctx });
  return { chargedToRoom: false as const, ipNumber: null, invoice };
}

/** The pharmacy work queue: scans reception has dispatched here. */
export async function pharmacyRxQueue(status?: "SENT_TO_PHARMACY" | "DISPENSED"): Promise<{
  id: string; fileUrl: string; fileName: string; mimeType: string; title: string | null; doctorName: string | null;
  status: string; sentToPharmacyAt: string | null; dispensedAt: string | null; createdAt: string;
  patient: { id: string; displayId: string; fullName: string; phone: string; age: number | null };
  items: { medicineName: string; medicineId: string | null; qty: number; dosage: string | null }[];
}[]> {
  const rows = await prisma.prescriptionUpload.findMany({
    where: { status: status ?? "SENT_TO_PHARMACY" },
    orderBy: { sentToPharmacyAt: "desc" },
    take: 60,
    select: {
      id: true, fileUrl: true, fileName: true, mimeType: true, title: true, doctorName: true,
      status: true, sentToPharmacyAt: true, dispensedAt: true, createdAt: true,
      patient: { select: { id: true, displayId: true, fullName: true, phone: true, age: true } },
      items: { select: { medicineName: true, medicineId: true, qty: true, dosage: true } },
    },
  });
  return rows.map((r: {
    id: string; fileUrl: string; fileName: string; mimeType: string; title: string | null; doctorName: string | null;
    status: string; sentToPharmacyAt: Date | null; dispensedAt: Date | null; createdAt: Date;
    patient: { id: string; displayId: string; fullName: string; phone: string; age: number | null };
    items: { medicineName: string; medicineId: string | null; qty: number; dosage: string | null }[];
  }) => ({
    id: r.id, fileUrl: r.fileUrl, fileName: r.fileName, mimeType: r.mimeType, title: r.title, doctorName: r.doctorName,
    status: r.status,
    sentToPharmacyAt: r.sentToPharmacyAt ? r.sentToPharmacyAt.toISOString() : null,
    dispensedAt: r.dispensedAt ? r.dispensedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    patient: r.patient,
    items: r.items,
  }));
}

/** Batches for one medicine (FEFO order) — what the pharmacist sees on the shelf. */
export async function medicineBatches(medicineId: string) {
  const rows = await prisma.stockBatch.findMany({
    where: { medicineId },
    orderBy: { expiryDate: "asc" },
    select: { id: true, batchNo: true, expiryDate: true, quantity: true, mrp: true, purchasePrice: true },
  });
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return rows.map((b: { id: string; batchNo: string; expiryDate: Date; quantity: number; mrp: { toString(): string }; purchasePrice: { toString(): string } | null }) => {
    const mrp = Number(b.mrp.toString());
    const rate = b.purchasePrice != null ? Number(b.purchasePrice.toString()) : null;
    const margin = rate != null ? mrp - rate : null;
    return {
      id: b.id, batchNo: b.batchNo,
      expiryDate: b.expiryDate.toISOString().slice(0, 10),
      quantity: b.quantity,
      mrp: b.mrp.toString(),
      rate: rate != null ? rate.toFixed(2) : null,
      margin: margin != null ? margin.toFixed(2) : null,
      marginPct: rate != null && mrp > 0 ? Math.round(((mrp - rate) / mrp) * 1000) / 10 : null,
      expired: b.expiryDate < today,
    };
  });
}

/** Pharmacy profit numbers — reusable by the pharmacy dashboard and the admin overview. */
export async function pharmacyProfitSummary(): Promise<{
  profitToday: string; marginPct: number;
  stockValueCost: string; stockValueMrp: string; potentialProfit: string;
}> {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const [todayItems, batches] = await Promise.all([
    prisma.invoiceItem.findMany({
      where: { batchId: { not: null }, invoice: { source: "PHARMACY", createdAt: { gte: today, lt: tomorrow }, status: { not: "CANCELLED" } } },
      select: { qty: true, unitPrice: true, batch: { select: { purchasePrice: true } } },
    }),
    prisma.stockBatch.findMany({
      where: { quantity: { gt: 0 }, expiryDate: { gte: today } },
      select: { quantity: true, mrp: true, purchasePrice: true },
    }),
  ]);

  let profitToday = 0, costedRevenue = 0;
  for (const it of todayItems as { qty: number; unitPrice: { toString(): string }; batch: { purchasePrice: { toString(): string } | null } | null }[]) {
    const pp = it.batch?.purchasePrice;
    if (pp == null) continue;
    const up = Number(it.unitPrice.toString());
    profitToday = r2(profitToday + (up - Number(pp.toString())) * it.qty);
    costedRevenue = r2(costedRevenue + up * it.qty);
  }
  const marginPct = costedRevenue > 0 ? Math.round((profitToday / costedRevenue) * 1000) / 10 : 0;

  let stockValueCost = 0, stockValueMrp = 0;
  for (const b of batches as { quantity: number; mrp: { toString(): string }; purchasePrice: { toString(): string } | null }[]) {
    stockValueMrp = r2(stockValueMrp + b.quantity * Number(b.mrp.toString()));
    if (b.purchasePrice != null) stockValueCost = r2(stockValueCost + b.quantity * Number(b.purchasePrice.toString()));
  }
  const potentialProfit = r2(stockValueMrp - stockValueCost);

  return {
    profitToday: profitToday.toFixed(2), marginPct,
    stockValueCost: stockValueCost.toFixed(2), stockValueMrp: stockValueMrp.toFixed(2), potentialProfit: potentialProfit.toFixed(2),
  };
}

/** Dashboard: queue depth, stock health, expiry risk, today's revenue. */
export async function pharmacyStats(): Promise<{
  pendingRx: number; dispensedToday: number; revenueToday: string;
  lowStock: number; expiringSoon: number; expired: number;
  /** Realized gross profit today = sum of (MRP - purchase rate) x qty on dispensed lines with a known rate. */
  profitToday: string; marginPct: number;
  /** Unrealized margin sitting in current stock. */
  stockValueCost: string; stockValueMrp: string; potentialProfit: string;
  collections: ModeTotal[];
}> {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const in90 = new Date(today); in90.setDate(today.getDate() + 90);

  const [pendingRx, dispensedToday, invoices, meds, expiringSoon, expired, todayItems] = await Promise.all([
    prisma.prescriptionUpload.count({ where: { status: "SENT_TO_PHARMACY" } }),
    prisma.prescriptionUpload.count({ where: { status: "DISPENSED", dispensedAt: { gte: today, lt: tomorrow } } }),
    prisma.invoice.findMany({
      where: { source: "PHARMACY", createdAt: { gte: today, lt: tomorrow }, status: { not: "CANCELLED" } },
      select: { totalAmount: true },
    }),
    prisma.medicine.findMany({
      where: { active: true },
      select: {
        reorderThreshold: true,
        batches: { where: { quantity: { gt: 0 }, expiryDate: { gte: today } }, select: { quantity: true, mrp: true, purchasePrice: true } },
      },
    }),
    prisma.stockBatch.count({ where: { quantity: { gt: 0 }, expiryDate: { gte: today, lt: in90 } } }),
    prisma.stockBatch.count({ where: { quantity: { gt: 0 }, expiryDate: { lt: today } } }),
    prisma.invoiceItem.findMany({
      where: { batchId: { not: null }, invoice: { source: "PHARMACY", createdAt: { gte: today, lt: tomorrow }, status: { not: "CANCELLED" } } },
      select: { qty: true, unitPrice: true, batch: { select: { purchasePrice: true } } },
    }),
  ]);

  const revenue = invoices.reduce((s: number, i: { totalAmount: { toString(): string } }) => r2(s + Number(i.totalAmount.toString())), 0);
  type MedB = { reorderThreshold: number; batches: { quantity: number; mrp: { toString(): string }; purchasePrice: { toString(): string } | null }[] };
  const lowStock = (meds as MedB[])
    .filter((m) => m.batches.reduce((s, b) => s + b.quantity, 0) <= m.reorderThreshold).length;

  // Realized gross profit today — only lines whose batch has a known purchase rate.
  let profitToday = 0, costedRevenue = 0;
  for (const it of todayItems as { qty: number; unitPrice: { toString(): string }; batch: { purchasePrice: { toString(): string } | null } | null }[]) {
    const pp = it.batch?.purchasePrice;
    if (pp == null) continue;
    const up = Number(it.unitPrice.toString());
    profitToday = r2(profitToday + (up - Number(pp.toString())) * it.qty);
    costedRevenue = r2(costedRevenue + up * it.qty);
  }
  const marginPct = costedRevenue > 0 ? Math.round((profitToday / costedRevenue) * 1000) / 10 : 0;

  // Unrealized margin sitting in current (in-date) stock.
  let stockValueCost = 0, stockValueMrp = 0;
  for (const m of meds as MedB[]) {
    for (const b of m.batches) {
      stockValueMrp = r2(stockValueMrp + b.quantity * Number(b.mrp.toString()));
      if (b.purchasePrice != null) stockValueCost = r2(stockValueCost + b.quantity * Number(b.purchasePrice.toString()));
    }
  }
  const potentialProfit = r2(stockValueMrp - stockValueCost);

  // What the pharmacy till took today, split by payment type.
  const collections = await collectionByMode({ sources: ["PHARMACY"] });

  return {
    pendingRx, dispensedToday, revenueToday: revenue.toFixed(2),
    lowStock, expiringSoon, expired,
    profitToday: profitToday.toFixed(2), marginPct,
    stockValueCost: stockValueCost.toFixed(2), stockValueMrp: stockValueMrp.toFixed(2), potentialProfit: potentialProfit.toFixed(2),
    collections: collections.modes,
  };
}

/** Expiry & reorder watchlist — the report a pharmacist actually acts on. */
export async function stockAlerts(): Promise<{
  expiring: { batchId: string; medicine: string; batchNo: string; expiryDate: string; quantity: number; daysLeft: number }[];
  lowStock: { medicineId: string; name: string; inStock: number; reorderThreshold: number }[];
}> {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const in90 = new Date(today); in90.setDate(today.getDate() + 90);

  const [batches, meds] = await Promise.all([
    prisma.stockBatch.findMany({
      where: { quantity: { gt: 0 }, expiryDate: { lt: in90 } },
      orderBy: { expiryDate: "asc" }, take: 50,
      select: { id: true, batchNo: true, expiryDate: true, quantity: true, medicine: { select: { name: true } } },
    }),
    prisma.medicine.findMany({
      where: { active: true },
      select: {
        id: true, name: true, reorderThreshold: true,
        batches: { where: { quantity: { gt: 0 }, expiryDate: { gte: today } }, select: { quantity: true } },
      },
    }),
  ]);

  return {
    expiring: (batches as { id: string; batchNo: string; expiryDate: Date; quantity: number; medicine: { name: string } }[]).map((b) => ({
      batchId: b.id, medicine: b.medicine.name, batchNo: b.batchNo,
      expiryDate: b.expiryDate.toISOString().slice(0, 10),
      quantity: b.quantity,
      daysLeft: Math.round((b.expiryDate.getTime() - today.getTime()) / 86400000),
    })),
    lowStock: (meds as { id: string; name: string; reorderThreshold: number; batches: { quantity: number }[] }[])
      .map((m) => ({ medicineId: m.id, name: m.name, inStock: m.batches.reduce((s, b) => s + b.quantity, 0), reorderThreshold: m.reorderThreshold }))
      .filter((m) => m.inStock <= m.reorderThreshold),
  };
}
