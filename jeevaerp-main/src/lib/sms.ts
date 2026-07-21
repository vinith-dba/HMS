import { ApiError } from "@/lib/api";
import { env } from "@/lib/env";

/**
 * SMS provider seam. Wire MSG91 / Twilio / Fast2SMS here before go-live —
 * a single function to replace, nothing else changes.
 */
export async function sendOtpSms(phone: string, code: string): Promise<void> {
  if (env().NODE_ENV === "production") {
    // Fail loud, never silently swallow a login path.
    throw new ApiError(503, "SMS provider is not configured");
  }
  // Development: the code appears in the server terminal only — never in an API response.
  console.log(`[sms:dev] OTP for ${phone}: ${code}`);
}
