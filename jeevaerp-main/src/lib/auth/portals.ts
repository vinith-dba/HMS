import type { Role } from "@/lib/auth/types";

/**
 * The ONE place that maps a role to where it lives. Used by:
 *   - login responses (tell the client where to go)
 *   - middleware (enforce which roles may load which subdomain)
 *   - portal layouts (server-side guard)
 * Change routing here and it changes everywhere, consistently.
 */

/** Subdomain slug per role. `null` = the main/public domain (patients). */
export const ROLE_SUBDOMAIN: Record<Role, string | null> = {
  ADMIN: "admin",
  RECEPTIONIST: "reception",
  DOCTOR: "doctor",
  LAB_TECH: "labs",
  PHARMACIST: "pharmacy",
  PATIENT: null,
};

/** Landing path within that portal, immediately after login. */
export const ROLE_HOME_PATH: Record<Role, string> = {
  ADMIN: "/",
  RECEPTIONIST: "/",
  DOCTOR: "/",
  LAB_TECH: "/",
  PHARMACIST: "/",
  PATIENT: "/portal/profile",
};

const PORTAL_SUBDOMAINS = ["admin", "reception", "doctor", "labs", "pharmacy"] as const;
export type PortalSubdomain = (typeof PORTAL_SUBDOMAINS)[number];

/** Which roles are permitted on a given portal subdomain. */
export const SUBDOMAIN_ALLOWED_ROLES: Record<PortalSubdomain, Role[]> = {
  admin: ["ADMIN"],
  reception: ["RECEPTIONIST", "ADMIN"], // admin can oversee the front desk
  doctor: ["DOCTOR", "ADMIN"],
  labs: ["LAB_TECH", "ADMIN"],
  pharmacy: ["PHARMACIST", "ADMIN"],
};

export function isPortalSubdomain(sub: string): sub is PortalSubdomain {
  return (PORTAL_SUBDOMAINS as readonly string[]).includes(sub);
}

/**
 * Absolute post-login destination for a role.
 *
 * In production every portal is a real subdomain (admin.jeeva…com).
 * In local dev we use `admin.localhost:PORT` — which modern browsers resolve
 * with no hosts-file editing. When no root domain is configured we fall back
 * to a path prefix (/admin) so the app still works on a single host.
 */
export function destinationFor(
  role: Role,
  opts: { rootDomain?: string; protocol?: string; port?: string } = {}
): string {
  const sub = ROLE_SUBDOMAIN[role];
  const path = ROLE_HOME_PATH[role];

  // Patients (and anything with no subdomain) stay on the current host.
  if (!sub) return path;

  const { rootDomain, protocol = "https", port } = opts;

  // No root domain known -> single-host fallback via path prefix.
  if (!rootDomain) return `/${sub}${path === "/" ? "" : path}`;

  const portSuffix = port ? `:${port}` : "";
  return `${protocol}://${sub}.${rootDomain}${portSuffix}${path}`;
}
