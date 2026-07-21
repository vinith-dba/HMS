import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { ACCESS_COOKIE } from "@/lib/auth/session";
import {
  SUBDOMAIN_ALLOWED_ROLES,
  type PortalSubdomain,
} from "@/lib/auth/portals";
import type { Role } from "@/lib/auth/types";

const PORTAL_SUBDOMAINS = ["admin", "reception", "doctor", "labs", "pharmacy"];

async function roleFromRequest(req: NextRequest): Promise<Role | null> {
  const token = req.cookies.get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    if (payload.typ !== "access" || typeof payload.role !== "string") return null;
    return payload.role as Role;
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Skip static assets, Next.js internal files, and API endpoints
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // 2. Identify portal routes (/admin, /doctor, /reception, /pharmacy, /labs)
  const pathPortal = PORTAL_SUBDOMAINS.find(
    (p) => pathname === `/${p}` || pathname.startsWith(`/${p}/`)
  ) as PortalSubdomain | undefined;

  if (pathPortal) {
    const isLoginPage = pathname === `/${pathPortal}/login`;
    
    // Always allow access to login pages
    if (isLoginPage) {
      const h = new Headers(req.headers);
      h.set("x-portal-path", pathname);
      return NextResponse.next({ request: { headers: h } });
    }

    // Gate protected portal pages by checking user session role
    const role = await roleFromRequest(req);
    const allowed = role !== null && SUBDOMAIN_ALLOWED_ROLES[pathPortal].includes(role);

    if (!allowed) {
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = `/${pathPortal}/login`;
      return NextResponse.redirect(loginUrl);
    }

    const h = new Headers(req.headers);
    h.set("x-portal-path", pathname);
    return NextResponse.next({ request: { headers: h } });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|favicon.ico|.*\\..*).*)"],
};
