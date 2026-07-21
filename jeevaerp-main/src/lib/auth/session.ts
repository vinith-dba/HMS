import type { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";

export const ACCESS_COOKIE = "jmh_access";
export const REFRESH_COOKIE = "jmh_refresh";

const ACCESS_MAX_AGE = 60 * 60 * 12; // 12h — a work shift; mirrors ACCESS_TOKEN_TTL
const REFRESH_MAX_AGE = 60 * 60 * 24 * 30; // mirrors REFRESH_TOKEN_TTL

function base() {
  return {
    httpOnly: true as const,
    secure: env().NODE_ENV === "production",
    sameSite: "lax" as const,
    // ".jeevamultispecialityhospital.com" in prod -> one login, every portal.
    domain: env().COOKIE_DOMAIN || undefined,
  };
}

export function setSessionCookies(res: NextResponse, tokens: { access: string; refresh: string }) {
  res.cookies.set(ACCESS_COOKIE, tokens.access, { ...base(), path: "/", maxAge: ACCESS_MAX_AGE });
  // Refresh cookie only ever travels to the auth endpoints.
  res.cookies.set(REFRESH_COOKIE, tokens.refresh, { ...base(), path: "/api/v1/auth", maxAge: REFRESH_MAX_AGE });
}

export function clearSessionCookies(res: NextResponse) {
  res.cookies.set(ACCESS_COOKIE, "", { ...base(), path: "/", maxAge: 0 });
  res.cookies.set(REFRESH_COOKIE, "", { ...base(), path: "/api/v1/auth", maxAge: 0 });
}

export function readAccessToken(req: NextRequest): string | null {
  const cookie = req.cookies.get(ACCESS_COOKIE)?.value;
  if (cookie) return cookie;
  const header = req.headers.get("authorization");
  if (header?.startsWith("Bearer ")) return header.slice("Bearer ".length);
  return null;
}

export function readRefreshToken(req: NextRequest): string | null {
  return req.cookies.get(REFRESH_COOKIE)?.value ?? null;
}
