import { NextResponse } from "next/server";
import { handler, parseBody } from "@/lib/api";
import { staffLoginSchema } from "@/server/validators/auth";
import { staffLogin, recordStaffLogin } from "@/server/services/auth.service";
import { auditContext } from "@/server/services/audit.service";
import { setSessionCookies } from "@/lib/auth/session";
import { destinationFor } from "@/lib/auth/portals";
import { resolveOrigin } from "@/lib/auth/origin";

export const dynamic = "force-dynamic";

export const POST = handler(async (req) => {
  const { username, password } = await parseBody(req, staffLoginSchema);
  const { tokens, user } = await staffLogin(username, password);
  await recordStaffLogin(user.id, "PASSWORD", auditContext(req));

  const redirectTo = destinationFor(user.role, resolveOrigin(req));

  const res = NextResponse.json({ user, redirectTo });
  setSessionCookies(res, tokens);
  return res;
});
