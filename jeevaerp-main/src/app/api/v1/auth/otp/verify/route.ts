import { NextResponse } from "next/server";
import { handler, parseBody } from "@/lib/api";
import { otpVerifySchema } from "@/server/validators/auth";
import { verifyOtpAndLogin } from "@/server/services/auth.service";
import { setSessionCookies } from "@/lib/auth/session";
import { destinationFor } from "@/lib/auth/portals";
import { resolveOrigin } from "@/lib/auth/origin";

export const dynamic = "force-dynamic";

export const POST = handler(async (req) => {
  const { patientId, code } = await parseBody(req, otpVerifySchema);
  const { tokens, user } = await verifyOtpAndLogin(patientId, code);

  const redirectTo = destinationFor(user.role, resolveOrigin(req));

  const res = NextResponse.json({ user, redirectTo });
  setSessionCookies(res, tokens);
  return res;
});
