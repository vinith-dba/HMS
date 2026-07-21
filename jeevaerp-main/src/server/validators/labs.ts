import { z } from "zod";

export const orderTestsSchema = z.object({
  patientId: z.string().trim().min(1, "Select a patient"),
  catalogIds: z.array(z.string().trim().min(1)).min(1, "Select at least one test"),
  appointmentId: z.string().trim().optional(),
});

const paymentSchema = z.object({
  mode: z.enum(["CASH", "UPI", "CARD", "NETBANKING", "OTHER"]),
  amount: z.coerce.number().min(0),
  reference: z.string().trim().max(80).optional(),
});

/** A single leg of a split (part cash, part UPI). Every leg must be > ₹0. */
const paymentLegSchema = z.object({
  mode: z.enum(["CASH", "UPI", "CARD", "NETBANKING", "OTHER"]),
  amount: z.coerce.number().min(0.01),
  reference: z.string().trim().max(80).optional(),
});

/** Up to four tenders on one bill — plenty for cash + UPI (+ card) at a desk. */
export const paymentsSchema = z.array(paymentLegSchema).min(1).max(4);

export const billLabTestsSchema = z.object({
  patientId: z.string().trim().min(1),
  labTestIds: z.array(z.string().trim().min(1)).min(1, "Select at least one test"),
  discountAmount: z.coerce.number().min(0).optional(),
  payment: paymentSchema.optional(),
  payments: paymentsSchema.optional(),
});

/** Walk-in OP consultation bill (patient pays for a consultation at the counter). */
export const billConsultationSchema = z.object({
  patientId: z.string().trim().min(1),
  appointmentId: z.string().trim().optional(),
  description: z.string().trim().min(2).max(120).default("Doctor consultation"),
  amount: z.coerce.number().min(0),
  gstRatePct: z.coerce.number().min(0).max(28).optional().default(0),
  discountAmount: z.coerce.number().min(0).optional(),
  payment: paymentSchema.optional(),
  payments: paymentsSchema.optional(),
});

export const recordPaymentSchema = z
  .object({
    invoiceId: z.string().trim().min(1),
    // A single tender (mode + amount) OR a split via `payments`. One is required.
    mode: z.enum(["CASH", "UPI", "CARD", "NETBANKING", "OTHER"]).optional(),
    amount: z.coerce.number().min(0.01).optional(),
    reference: z.string().trim().max(80).optional(),
    payments: paymentsSchema.optional(),
  })
  .refine((d) => (d.payments && d.payments.length > 0) || (d.mode != null && d.amount != null), {
    message: "Enter a payment amount",
  });

export const updateInvoiceSchema = z.object({
  invoiceId: z.string().trim().min(1),
  lines: z.array(z.object({
    description: z.string().trim().min(1).max(120),
    qty: z.coerce.number().int().min(1).optional(),
    unitPrice: z.coerce.number().min(0),
    gstRatePct: z.coerce.number().min(0).max(28).optional(),
    hsnSac: z.string().trim().max(20).optional(),
    labTestId: z.string().trim().optional(),
  })).min(1, "An invoice needs at least one item"),
  discountAmount: z.coerce.number().min(0).optional(),
  notes: z.string().trim().max(300).optional(),
});

export const cancelInvoiceSchema = z.object({
  reason: z.string().trim().min(3, "Give a reason for cancelling").max(200),
});
