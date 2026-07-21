import { z } from "zod";

const payment = z.object({
  mode: z.enum(["CASH", "UPI", "CARD", "NETBANKING", "OTHER"]),
  amount: z.coerce.number().min(0),
  reference: z.string().trim().max(80).optional(),
});

/** A split leg (part cash, part UPI). Each must be > ₹0. */
const paymentLeg = z.object({
  mode: z.enum(["CASH", "UPI", "CARD", "NETBANKING", "OTHER"]),
  amount: z.coerce.number().min(0.01),
  reference: z.string().trim().max(80).optional(),
});

export const wardSchema = z.object({
  id: z.string().trim().optional(),
  name: z.string().trim().min(2).max(60),
  category: z.string().trim().min(2).max(30),
  floor: z.string().trim().max(20).optional().or(z.literal("")),
  dailyCharge: z.coerce.number().min(0),
  gstRatePct: z.coerce.number().min(0).max(28),
  active: z.boolean().optional(),
});

export const addBedsSchema = z.object({
  wardId: z.string().trim().min(1),
  count: z.coerce.number().int().min(1).max(50),
  prefix: z.string().trim().max(8).optional().or(z.literal("")),
});

export const bedStatusSchema = z.object({
  bedId: z.string().trim().min(1),
  status: z.enum(["AVAILABLE", "MAINTENANCE"]),
});

export const admitSchema = z.object({
  patientDisplayId: z.string().trim().min(6, "Enter the patient's Jeeva ID"),
  bedId: z.string().trim().min(1, "Pick a bed from the board"),
  doctorId: z.string().trim().min(1, "Pick the attending doctor"),
  reason: z.string().trim().max(300).optional().or(z.literal("")),
  attendantName: z.string().trim().max(100).optional().or(z.literal("")),
  attendantPhone: z.string().trim().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile").optional().or(z.literal("")),
  attendantRelation: z.string().trim().max(40).optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export const dischargeSchema = z.object({
  admissionId: z.string().trim().min(1),
  discountAmount: z.coerce.number().min(0).optional(),
  payment: payment.optional(),
  payments: z.array(paymentLeg).min(1).max(4).optional(),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export const addChargeSchema = z.object({
  category: z.enum(["PROCEDURE", "DOCTOR_VISIT", "NURSING", "OXYGEN", "INVESTIGATION", "CONSUMABLE", "PHARMACY", "OTHER"]),
  description: z.string().trim().min(2).max(160),
  qty: z.coerce.number().int().min(1).max(999),
  unitPrice: z.coerce.number().min(0),
  gstRatePct: z.coerce.number().min(0).max(28).optional(),
});

/** Moving a patient to another bed mid-stay. */
export const transferBedSchema = z.object({
  toBedId: z.string().trim().min(1, "Pick a bed"),
  reason: z.string().trim().max(200).optional(),
});

/** The deposit taken at admission. */
export const advanceSchema = z.object({
  amount: z.coerce.number().positive("An advance must be more than ₹0"),
  mode: z.enum(["CASH", "UPI", "CARD", "NETBANKING", "OTHER"]),
  reference: z.string().trim().max(80).optional(),
});
