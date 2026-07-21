import { createHash, randomInt, timingSafeEqual } from "crypto";

export const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RATE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
// Higher cap in dev so repeated testing doesn't lock you out; strict in prod.
export const OTP_RATE_MAX = process.env.NODE_ENV === "production" ? 3 : 20;

/** Cryptographically random, always 6 digits (leading zeros kept). */
export function generateOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashOtp(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

/** Constant-time comparison — no early-exit timing signal. */
export function verifyOtp(code: string, storedHash: string): boolean {
  const a = Buffer.from(hashOtp(code), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** "98480 12345" -> "•••••• 2345" */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return `•••••• ${digits.slice(-4)}`;
}
