import { z } from "zod";

const phone10 = z.string().trim().regex(/^\d{10}$/, "Enter a valid 10-digit mobile number");
const optStr = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

/** Full patient registration — rich production fields. Only first name + phone required. */
export const registerPatientSchema = z.object({
  // name
  firstName: z.string().trim().min(1, "First name is required").max(80),
  middleName: optStr(80),
  lastName: optStr(80),
  // demographics
  dob: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date").optional().or(z.literal("")),
  age: z.coerce.number().int().min(0).max(120).optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  bloodGroup: z.enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]).optional(),
  maritalStatus: z.enum(["SINGLE", "MARRIED", "DIVORCED", "WIDOWED", "OTHER"]).optional(),
  // contact
  phone: phone10,
  alternatePhone: z.string().trim().regex(/^\d{10}$/, "Enter 10 digits").optional().or(z.literal("")),
  email: z.string().trim().email("Invalid email").optional().or(z.literal("")),
  address: optStr(300),
  city: optStr(80),
  state: optStr(80),
  country: optStr(80),
  postalCode: z.string().trim().regex(/^\d{4,10}$/, "Invalid PIN").optional().or(z.literal("")),
  // personal
  occupation: optStr(80),
  nationality: optStr(80),
  preferredLanguage: optStr(40),
  // emergency contact + medical + id
  emergencyContactName: optStr(80),
  emergencyContactRelation: optStr(40),
  emergencyContactPhone: z.string().trim().regex(/^\d{10}$/, "Enter 10 digits").optional().or(z.literal("")),
  allergies: optStr(300),
  govtIdNumber: optStr(40),
  // referral (admin-only snapshot)
  referredByName: optStr(120),
  referralSource: optStr(80),
  // flags
  isVip: z.boolean().optional().default(false),
  remarks: optStr(500),
});

export type RegisterPatientInput = z.infer<typeof registerPatientSchema>;

/** Send the generated OPD prescription sheet (no scan) to pharmacy / patient. */
export const sendOpdSheetSchema = z.object({
  appointmentId: z.string().trim().min(1, "appointmentId is required"),
  title: optStr(120),
  sendNow: z.boolean().optional().default(true),
  items: z
    .array(
      z.object({
        medicineName: z.string().trim().min(1).max(120),
        medicineId: z.string().trim().optional(),
        qty: z.coerce.number().int().min(1).max(999).optional(),
        dosage: z.string().trim().max(120).optional().or(z.literal("")),
      })
    )
    .max(30)
    .default([]),
  /// clinical details typed from the handwritten sheet — all optional
  diagnosis: optStr(300),
  advice: optStr(600),
  nextVisit: optStr(80),
  /// prescribed lab tests, printed on the sheet as advisory text
  labs: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
});

export const patientSearchSchema = z.object({
  q: z.string().trim().max(80).optional().default(""),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

/** Book an appointment: patient + slot + optional per-visit referral (admin-only). */
export const bookAppointmentSchema = z.object({
  patientId: z.string().trim().min(1, "Select a patient"),
  slotId: z.string().trim().min(1, "Select a time slot"),
  type: z.enum(["WALKIN", "ONLINE"]).optional().default("WALKIN"),
  referredByName: optStr(120),
  referralSource: optStr(80),
  billNow: z
    .object({
      discountAmount: z.coerce.number().min(0).optional(),
      payment: z
        .object({
          mode: z.enum(["CASH", "UPI", "CARD", "NETBANKING", "OTHER"]),
          amount: z.coerce.number().min(0),
          reference: z.string().trim().max(80).optional(),
        })
        .optional(),
      // Split settlement (part cash, part UPI). Each leg must be > ₹0.
      payments: z
        .array(
          z.object({
            mode: z.enum(["CASH", "UPI", "CARD", "NETBANKING", "OTHER"]),
            amount: z.coerce.number().min(0.01),
            reference: z.string().trim().max(80).optional(),
          })
        )
        .min(1)
        .max(4)
        .optional(),
    })
    .optional(),
});

export type BookAppointmentInput = z.infer<typeof bookAppointmentSchema>;

/** Everything on registerPatientSchema, but all optional (partial update). */
export const updatePatientSchema = registerPatientSchema.partial();

/** A patient editing their OWN contact details. */
export const updateOwnContactSchema = z.object({
  phone: phone10.optional(),
  alternatePhone: z.string().trim().regex(/^\d{10}$/, "Enter 10 digits").optional().or(z.literal("")),
  email: z.string().trim().email("Invalid email").optional().or(z.literal("")),
  address: optStr(300),
  city: optStr(80),
  state: optStr(80),
  postalCode: z.string().trim().regex(/^\d{4,10}$/, "Invalid PIN").optional().or(z.literal("")),
});

export const cancelAppointmentSchema = z.object({
  reason: z.string().trim().min(3, "Give a reason").max(200),
});

export const rescheduleAppointmentSchema = z.object({
  newSlotId: z.string().trim().min(1),
});

export const doctorLeaveSchema = z.object({
  doctorId: z.string().trim().min(1),
  date: z.string().trim().min(1),
  reason: z.string().trim().min(3, "Give a reason").max(160),
});

export const clearLeaveSchema = z.object({
  doctorId: z.string().trim().min(1),
  date: z.string().trim().min(1),
});

export const toggleSlotSchema = z.object({
  slotId: z.string().trim().min(1),
  blocked: z.boolean(),
  reason: z.string().trim().max(160).optional(),
});

/** Giving money back. A reason is NOT optional. */
export const refundSchema = z.object({
  amount: z.coerce.number().positive("A refund must be more than ₹0"),
  mode: z.enum(["CASH", "UPI", "CARD", "NETBANKING", "OTHER"]),
  reason: z.string().trim().min(3, "Say why the money is going back"),
  reference: z.string().trim().max(80).optional(),
});

/** Folding a duplicate patient record into the real one. Irreversible. */
export const mergePatientsSchema = z.object({
  keepId: z.string().trim().min(1),
  mergeId: z.string().trim().min(1),
  reason: z.string().trim().min(3, "Say why these are the same person"),
});

/**
 * Vitals typed in by reception from the doctor's handwritten OPD sheet.
 * Every field optional — the desk types whatever was actually written down,
 * not a full set. Sane clinical ranges catch fat-finger entry.
 */
export const recordVitalsSchema = z.object({
  bpSystolic: z.coerce.number().int().min(40).max(300).optional(),
  bpDiastolic: z.coerce.number().int().min(20).max(200).optional(),
  pulse: z.coerce.number().int().min(20).max(250).optional(),
  tempF: z.coerce.number().min(85).max(112).optional(),
  spo2: z.coerce.number().int().min(50).max(100).optional(),
  heightCm: z.coerce.number().min(20).max(250).optional(),
  weightKg: z.coerce.number().min(0.5).max(400).optional(),
});