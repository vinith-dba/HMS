import { env } from "./env";

/**
 * Sends a staff login OTP by email. In development the code is logged to the
 * server console (no provider needed). In production this throws until a real
 * email provider is wired, so codes are never silently dropped.
 */
export async function sendOtpEmail(to: string, code: string): Promise<void> {
  if (env().NODE_ENV === "production") {
    throw new Error("Email provider not configured. Wire an email service before production.");
  }
  // eslint-disable-next-line no-console
  console.log(`\n[email:dev] Staff OTP for ${to}: ${code}\n`);
}

/** Masks an email for enumeration-safe display: r***@gmail.com */
export function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!user || !domain) return "•••";
  const head = user.slice(0, 1);
  return `${head}${"*".repeat(Math.max(2, user.length - 1))}@${domain}`;
}
