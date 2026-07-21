# Sign-in now renders on top of the layout (real fix)

## Why it was still wrapped
Staff portals live on subdomains, and the middleware **rewrites** unauthorized
visitors (and the login route) to `/{portal}/login`. With a rewrite, the client
`usePathname()` doesn't reliably report that path — so the shell's client-side
check missed exactly when you land on login through the auth gate (the usual way).

## The fix — decided server-side
- The **middleware** now forwards the resolved route to the page as an
  `x-portal-path` header on every rewrite.
- Each portal **layout** reads that header (server-side, reliable) and renders the
  **login screen bare** — above the layout, no sidebar or topbar — while every
  other route gets the portal shell.

This works no matter how login is reached: typing `/login`, or being bounced there
because you're signed out or on the wrong portal.

## Also included (the sign-in experience)
- `AuthScreen` — the full-screen, two-panel informative sign-in.
- `GET /auth/me` + shell greeting: real name in the topbar/sidebar and a
  "Good morning, <name>" greeting on each portal's home.

## Files
- `src/middleware.ts` — sets `x-portal-path` on rewrites.
- `src/app/{admin,reception,labs,pharmacy,doctor}/layout.tsx` — bare login vs shell.
- `src/components/portal/shell/portal-shell.tsx` — greeting + real name.
- `src/components/portal/auth-screen.tsx` — full-screen sign-in.
- `src/app/api/v1/auth/me/route.ts` — current user.
- `src/app/{admin,reception,labs,pharmacy,doctor}/login/page.tsx` — use AuthScreen.

## Apply
Unzip at the project root, then clean-restart (middleware changes require a full
restart):

    rm -rf .next
    npm run dev
