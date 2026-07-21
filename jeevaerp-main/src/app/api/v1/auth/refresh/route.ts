import { NextResponse } from "next/server";
import { handler } from "@/lib/api";
import { rotateRefresh } from "@/server/services/auth.service";
import { readRefreshToken, setSessionCookies, clearSessionCookies } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const POST = handler(async (req) => {
  const presented = readRefreshToken(req);
  if (!presented) {
    const res = NextResponse.json({ error: "No session to refresh" }, { status: 401 });
    clearSessionCookies(res);
    return res;
  }

  try {
    const tokens = await rotateRefresh(presented);
    const res = NextResponse.json({ ok: true });
    setSessionCookies(res, tokens);
    return res;
  } catch (err) {
    // On any refresh failure, proactively clear the stale cookies so the
    // client lands cleanly on the login screen.
    const res = NextResponse.json(
      { error: err instanceof Error ? err.message : "Session error" },
      { status: 401 }
    );
    clearSessionCookies(res);
    return res;
  }
});
