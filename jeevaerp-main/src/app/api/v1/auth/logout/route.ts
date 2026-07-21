import { NextResponse } from "next/server";
import { handler } from "@/lib/api";
import { revokeRefresh, recordStaffLogoutByRefresh } from "@/server/services/auth.service";
import { readRefreshToken, clearSessionCookies } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const POST = handler(async (req) => {
  const refresh = readRefreshToken(req);
  await recordStaffLogoutByRefresh(refresh);
  await revokeRefresh(refresh);
  const res = NextResponse.json({ ok: true });
  clearSessionCookies(res);
  return res;
});
