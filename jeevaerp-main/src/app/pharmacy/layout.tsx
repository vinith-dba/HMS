import { headers } from "next/headers";
import { PortalShell } from "@/components/portal/shell/portal-shell";

/**
 * The sign-in screen renders on top of the layout — no sidebar, no topbar.
 * The middleware forwards the resolved route as `x-portal-path`, so we can tell
 * a login render from an app render server-side (client usePathname is unreliable
 * for rewritten paths). Login → bare children; everything else → the portal shell.
 */
export default async function PharmacyLayout({ children }: { children: React.ReactNode }) {
  const path = (await headers()).get("x-portal-path") ?? "";
  if (path.endsWith("/login")) return <>{children}</>;
  return (
    <PortalShell portalKey="pharmacy" userName="Pharmacy User" title="Pharmacy">
      {children}
    </PortalShell>
  );
}
