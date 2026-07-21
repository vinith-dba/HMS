import { z } from "zod";

/** Jeeva patient display ID, e.g. JMH-2026-000123 (case-insensitive input). */
export const otpRequestSchema = z.object({
  patientId: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^JMH\d{4}OP\d{5}$/, "Enter a valid Jeeva ID (e.g. JMH2026OP00123)"),
});

export const otpVerifySchema = z.object({
  patientId: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^JMH\d{4}OP\d{5}$/, "Enter a valid Jeeva ID (e.g. JMH2026OP00123)"),
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
});

export const staffLoginSchema = z.object({
  username: z.string().trim().toLowerCase().min(3, "Enter your username").max(60),
  password: z.string().min(1, "Password is required"),
});

export type OtpRequestInput = z.infer<typeof otpRequestSchema>;
export type OtpVerifyInput = z.infer<typeof otpVerifySchema>;
export type StaffLoginInput = z.infer<typeof staffLoginSchema>;

export const staffOtpRequestSchema = z.object({
  username: z.string().trim().toLowerCase().min(3, "Enter your username").max(60),
});

export const staffOtpVerifySchema = z.object({
  username: z.string().trim().toLowerCase().min(3).max(60),
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
});
