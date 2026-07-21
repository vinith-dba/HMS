import type { NextRequest } from "next/server";
import { env } from "@/lib/env";

/**
 * Works out the base (rootDomain / protocol / port) for building cross-subdomain
 * redirect URLs from the incoming request + configured cookie domain.
 *
 *  prod  : host "reception.jeevamultispecialityhospital.com"
 *          -> rootDomain "jeevamultispecialityhospital.com"
 *  dev   : host "reception.localhost:3000"
 *          -> rootDomain "localhost", port "3000"
 *  single: no dotted root resolvable -> rootDomain undefined (path-prefix fallback)
 */
export function resolveOrigin(req: NextRequest): {
  rootDomain?: string;
  protocol: string;
  port?: string;
} {
  const host = req.headers.get("host") ?? "";
  const [hostname, port] = host.split(":");
  const protocol = req.headers.get("x-forwarded-proto") ?? (env().NODE_ENV === "production" ? "https" : "http");

  // Prefer the explicitly configured cookie domain (".root.com" -> "root.com").
  const configured = env().COOKIE_DOMAIN?.replace(/^\./, "");
  if (configured) return { rootDomain: configured, protocol, port: port || undefined };

  // localhost / *.localhost — modern browsers resolve admin.localhost for free.
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    return { rootDomain: "localhost", protocol, port: port || undefined };
  }

  // Any other host — a bare IP, *.vercel.app, or a custom domain that hasn't
  // set COOKIE_DOMAIN — cannot be assumed to serve wildcard portal subdomains
  // (e.g. reception.app.vercel.app has no TLS cert). Fall back to path-prefix
  // routing (/admin, /reception, …), which works on any single host.
  // To use real subdomains in production, set COOKIE_DOMAIN=.yourdomain.com.
  return { protocol, port: port || undefined };
}
