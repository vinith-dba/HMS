/**
 * ONE classifier for how a given request host should route portals — shared by
 * the middleware (which enforces it) and resolveOrigin (which builds post-login
 * redirect URLs), so the two can never disagree. Pure string work → edge-safe.
 *
 * Two routing shapes:
 *   • subdomain — admin.example.com → /admin        (real domains, localhost)
 *   • path      — example.com/admin                 (*.vercel.app, bare IPs)
 *
 * Subdomain routing needs wildcard subdomains that actually resolve + carry a
 * TLS cert. That's true for a real custom domain and for *.localhost, but NOT
 * for a bare *.vercel.app (admin.<proj>.vercel.app has no cert). An explicit
 * COOKIE_DOMAIN always forces subdomain mode.
 */
const PORTAL_PREFIXES = ["admin", "reception", "doctor", "labs", "pharmacy"];

export interface HostRouting {
  /** true → admin.host routing; false → /admin path routing. */
  subdomainMode: boolean;
  /** Registrable root for building subdomain URLs (undefined in path mode). */
  rootDomain?: string;
  /** First hostname label (the candidate portal subdomain). */
  sub: string;
  /** Port, when present on the host header. */
  port?: string;
}

export function classifyHost(host: string, cookieDomain?: string): HostRouting {
  const [hostname, port] = (host || "").split(":");
  const labels = hostname.split(".");
  const sub = labels[0] ?? "";

  // Explicit config wins — ".root.com" → "root.com".
  const configured = cookieDomain?.replace(/^\./, "");
  if (configured) return { subdomainMode: true, rootDomain: configured, sub, port };

  // Local dev: modern browsers resolve admin.localhost with no hosts edit.
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    return { subdomainMode: true, rootDomain: "localhost", sub, port };
  }

  // *.vercel.app (no wildcard cert), bare IP, or single-label → path routing.
  const isIp = /^\d+$/.test(labels[labels.length - 1]);
  if (hostname.endsWith(".vercel.app") || labels.length < 2 || isIp) {
    return { subdomainMode: false, sub, port };
  }

  // Real custom domain → subdomain routing. Strip a leading portal/www label
  // to get the registrable root (admin.jeeva.com & www.jeeva.com → jeeva.com).
  const hasSubPrefix = labels.length > 2 && (PORTAL_PREFIXES.includes(sub) || sub === "www");
  const rootDomain = hasSubPrefix ? labels.slice(1).join(".") : hostname;
  return { subdomainMode: true, rootDomain, sub, port };
}
