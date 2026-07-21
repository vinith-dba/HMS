import { z } from "zod";

export const createStaffSchema = z.object({
  /** role.name — e.g. reception.ravi */
  username: z.string().trim().toLowerCase()
    .regex(/^(admin|reception|labs|pharmacy|doctor)\.[a-z0-9_]{2,30}$/, "Username must be role.name (e.g. reception.ravi)"),
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().trim().regex(/^\d{10}$/, "Enter a valid 10-digit number"),
  role: z.enum(["ADMIN", "RECEPTIONIST", "LAB_TECH", "PHARMACIST", "DOCTOR"]),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
});

export const setStaffActiveSchema = z.object({
  userId: z.string().trim().min(1),
  isActive: z.boolean(),
});

export const catalogItemSchema = z.object({
  id: z.string().trim().optional(),
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().max(20).optional().or(z.literal("")),
  price: z.coerce.number().min(0),
  gstRatePct: z.coerce.number().min(0).max(28),
  active: z.boolean().optional().default(true),
});

export const hospitalConfigSchema = z.object({
  legalName: z.string().trim().min(2).max(120),
  addressLine: z.string().trim().min(2).max(200),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(80),
  stateCode: z.string().trim().regex(/^\d{2}$/, "State code is 2 digits (Telangana = 36)"),
  pincode: z.string().trim().regex(/^\d{6}$/, "6-digit PIN"),
  gstin: z.string().trim().max(20).optional().or(z.literal("")),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  email: z.string().trim().email().optional().or(z.literal("")),
});
