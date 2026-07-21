import { z } from "zod";

export const addBatchSchema = z.object({
  medicineId: z.string().trim().min(1),
  batchNo: z.string().trim().min(1, "Batch number is required").max(40),
  expiryDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
  mrp: z.coerce.number().min(0),
  purchasePrice: z.coerce.number().min(0).optional(),
  supplierRef: z.string().trim().max(60).optional(),
});

/** Bulk stock receipt — from a spreadsheet or a keyed-in scanned invoice.
 *  Each row identifies its medicine by catalog id (preferred) or by name. */
export const bulkAddBatchesSchema = z.object({
  rows: z.array(
    z.object({
      medicineId: z.string().trim().min(1).optional(),
      medicine: z.string().trim().max(120).optional(),
      /// when true and the name isn't in the catalog, create the medicine first
      createNew: z.boolean().optional(),
      hsn: z.string().trim().max(20).optional(),
      gstRatePct: z.coerce.number().min(0).max(28).optional(),
      batchNo: z.string().trim().min(1, "Batch number is required").max(40),
      expiryDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
      quantity: z.coerce.number().int().min(1),
      mrp: z.coerce.number().min(0),
      purchasePrice: z.coerce.number().min(0).optional(),
      supplierRef: z.string().trim().max(60).optional(),
    }).refine((r) => r.medicineId || r.medicine, { message: "medicine id or name is required" })
  ).min(1, "Nothing to import").max(500, "Import up to 500 rows at a time"),
});

export const adjustStockSchema = z.object({
  batchId: z.string().trim().min(1),
  delta: z.coerce.number().int(),
  reason: z.string().trim().min(3, "Give a reason").max(160),
});

export const dispenseSchema = z.object({
  patientId: z.string().trim().min(1),
  prescriptionUploadId: z.string().trim().optional(),
  items: z.array(z.object({
    medicineId: z.string().trim().min(1),
    qty: z.coerce.number().int().min(1),
  })).min(1, "Add at least one medicine"),
  discountAmount: z.coerce.number().min(0).optional(),
  shortSupplyReason: z.string().trim().max(200).optional(),
  payment: z.object({
    mode: z.enum(["CASH", "UPI", "CARD", "NETBANKING", "OTHER"]),
    amount: z.coerce.number().min(0),
    reference: z.string().trim().max(80).optional(),
  }).optional(),
  // Split settlement: part cash, part UPI, etc. Each leg must be > ₹0.
  payments: z.array(z.object({
    mode: z.enum(["CASH", "UPI", "CARD", "NETBANKING", "OTHER"]),
    amount: z.coerce.number().min(0.01),
    reference: z.string().trim().max(80).optional(),
  })).min(1).max(4).optional(),
});

export const medicineSchema = z.object({
  id: z.string().trim().optional(),
  name: z.string().trim().min(2).max(120),
  genericName: z.string().trim().max(120).optional().or(z.literal("")),
  manufacturer: z.string().trim().max(120).optional().or(z.literal("")),
  hsnCode: z.string().trim().max(20).optional().or(z.literal("")),
  gstRatePct: z.coerce.number().min(0).max(28),
  unit: z.string().trim().max(30).default("tablet"),
  reorderThreshold: z.coerce.number().int().min(0).default(10),
  rackLocation: z.string().trim().max(30).optional().or(z.literal("")),
  active: z.boolean().optional().default(true),
  courseCritical: z.boolean().optional().default(false),
});
