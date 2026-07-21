import { NextResponse } from "next/server";
import { handler, parseBody } from "@/lib/api";
import { staffOtpVerifySchema } from "@/server/validators/auth";
import { verifyStaffOtp, recordStaffLogin } from "@/server/services/auth.service";
import { auditContext } from "@/server/services/audit.service";
import { setSessionCookies } from "@/lib/auth/session";
import { destinationFor } from "@/lib/auth/portals";
import { resolveOrigin } from "@/lib/auth/origin";

export const dynamic = "force-dynamic";

export const POST = handler(async (req) => {
  const { username, code } = await parseBody(req, staffOtpVerifySchema);
  const { tokens, user } = await verifyStaffOtp(username, code);
  await recordStaffLogin(user.id, "OTP", auditContext(req));
  const redirectTo = destinationFor(user.role, resolveOrigin(req));
  const res = NextResponse.json({ user, redirectTo });
  setSessionCookies(res, tokens);
  return res;
});
