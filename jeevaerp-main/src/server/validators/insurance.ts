import { z } from "zod";

/** Raise a new claim against a patient's treatment. */
export const createClaimSchema = z.object({
  patientId: z.string().trim().min(1, "Pick a patient"),
  insurer: z.string().trim().min(1, "Insurer / TPA is required").max(120),
  policyNo: z.string().trim().min(1, "Policy number is required").max(60),
  memberId: z.string().trim().max(60).optional(),
  sumInsured: z.coerce.number().min(0).optional(),
  type: z.enum(["CASHLESS", "REIMBURSEMENT"]).default("CASHLESS"),
  stage: z.enum(["PRE_AUTH", "FINAL"]).default("PRE_AUTH"),
  diagnosis: z.string().trim().max(300).optional(),
  claimedAmount: z.coerce.number().min(1, "Enter the amount claimed"),
  admissionId: z.string().trim().optional(),
  invoiceId: z.string().trim().optional(),
  remarks: z.string().trim().max(500).optional(),
});

/** Move a claim along its lifecycle. */
export const claimActionSchema = z.object({
  action: z.enum(["SUBMIT", "QUERY", "APPROVE", "REJECT", "SETTLE", "NOTE"]),
  /// approved amount (APPROVE) or amount received (SETTLE)
  amount: z.coerce.number().min(0).optional(),
  insurerRef: z.string().trim().max(80).optional(),
  detail: z.string().trim().max(500).optional(),
});
