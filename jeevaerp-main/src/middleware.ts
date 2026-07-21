import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { ACCESS_COOKIE } from "@/lib/auth/session";
import {
  isPortalSubdomain,
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
  const host = req.headers.get("host") ?? "";
  const hostname = host.split(":")[0];
  const sub = hostname.split(".")[0];
  const { pathname, search } = req.nextUrl;

  // API is same-origin — never rewrite or gate it here.
  if (pathname.startsWith("/api")) return NextResponse.next();

  // Subdomain routing only when COOKIE_DOMAIN is explicitly configured, or in local *.localhost dev.
  // Standard *.vercel.app deployments will run in PATH MODE (/admin, /doctor, etc.)
  const isVercelDomain = hostname.endsWith(".vercel.app");
  const cookieDomain = process.env.COOKIE_DOMAIN?.replace(/^\./, "");
  
  const subdomainMode =
    !isVercelDomain && (Boolean(cookieDomain) || hostname.endsWith(".localhost"));

  const onPortalSubdomain = subdomainMode && isPortalSubdomain(sub);

  if (onPortalSubdomain) {
    const portal = sub as PortalSubdomain;

    if (pathname === `/${portal}` || pathname.startsWith(`/${portal}/`)) {
      const url = req.nextUrl.clone();
      url.pathname = pathname.slice(portal.length + 1) || "/";
      url.search = search;
      return NextResponse.redirect(url, 308);
    }

    const isLoginPage = pathname === "/login";

    if (!isLoginPage) {
      const role = await roleFromRequest(req);
      const allowed = role !== null && SUBDOMAIN_ALLOWED_ROLES[portal].includes(role);
      if (!allowed) {
        const url = req.nextUrl.clone();
        url.pathname = `/${portal}/login`;
        url.search = "";
        const h = new Headers(req.headers);
        h.set("x-portal-path", url.pathname);
        return NextResponse.rewrite(url, { request: { headers: h } });
      }
    }

    const url = req.nextUrl.clone();
    url.pathname = `/${portal}${pathname}`;
    const h2 = new Headers(req.headers);
    h2.set("x-portal-path", url.pathname);
    return NextResponse.rewrite(url, { request: { headers: h2 } });
  }

  // Path mode routing for single host / *.vercel.app
  const pathPortal = PORTAL_SUBDOMAINS.find(
    (p) => pathname === `/${p}` || pathname.startsWith(`/${p}/`)
  ) as PortalSubdomain | undefined;

  if (pathPortal) {
    const isLoginPage = pathname === `/${pathPortal}/login`;
    if (!isLoginPage) {
      const role = await roleFromRequest(req);
      const allowed = role !== null && SUBDOMAIN_ALLOWED_ROLES[pathPortal].includes(role);
      if (!allowed) {
        const url = req.nextUrl.clone();
        url.pathname = `/${pathPortal}/login`;
        url.search = "";
        const h = new Headers(req.headers);
        h.set("x-portal-path", url.pathname);
        return NextResponse.rewrite(url, { request: { headers: h } });
      }
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
