# Sign-in redesign + in-portal greeting

## Sign-in is now its own full screen (no sidebar/layout)
Previously each portal's layout wrapped everything — including `/login` — in the
portal shell, so the sign-in card showed the sidebar and topbar behind it.
`PortalShell` now detects the login route and renders **only** the sign-in screen.

## A big, informative sign-in screen
New `AuthScreen` — a full-screen, two-panel design:
- **Left (brand/info) panel:** Jeeva mark, a headline, and what the system does
  ("OPD, IPD, pharmacy & labs — one connected system", "Live billing, collections,
  beds and stock", "Secure sign-in with a one-time code or password", "Role-based
  access for every desk"), on a deep teal→blue gradient.
- **Right:** the sign-in card (OTP or password), centred and uncluttered.
- On mobile it collapses to just the card with a compact Jeeva header.

All five staff portals use it (Admin, Front Desk, Laboratory, Pharmacy, Consulting
Room), each themed to its portal.

## Greeted by name inside the portal
- New `GET /api/v1/auth/me` returns the signed-in user (name, role, username).
- The shell now shows the **real name** (topbar + sidebar), not a placeholder.
- On each portal's home page the topbar greets them by first name —
  "Good morning / afternoon / evening, <name>".

## Files
- `src/app/api/v1/auth/me/route.ts`  (new)
- `src/components/portal/auth-screen.tsx`  (new)
- `src/components/portal/shell/portal-shell.tsx`  (bare login + greeting + real name)
- `src/app/admin/login/page.tsx`, `reception/login`, `labs/login`,
  `pharmacy/login`, `doctor/login`  (use AuthScreen)

## Apply
Unzip at the project root, then clean-restart:

    rm -rf .next
    npm run dev

No migration. (The patient portal sign-in under /portal/login is a separate flow
and is left unchanged — tell me if you want it redesigned to match.)
