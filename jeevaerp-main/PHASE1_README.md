# Jeeva ERP — Phase 1: Auth + Foundation

Complete, verified authentication across the whole ERP, plus the shared
foundation (schema v2, lib, seed) every later phase builds on.

## Run it

```bash
npm install
cp .env.example .env      # fill DATABASE_URL + both JWT secrets (openssl rand -hex 32)
npx prisma migrate dev --name init
npx prisma db seed
npm run dev
```

Health check: http://localhost:3000/api/v1/health
Patient login UI: http://localhost:3000/portal/login

## Endpoints

| Method | Path | Who | Purpose |
|---|---|---|---|
| GET  | `/api/v1/health` | anyone | Liveness + DB ping |
| POST | `/api/v1/auth/otp/request` | patient | Send OTP to registered mobile |
| POST | `/api/v1/auth/otp/verify` | patient | Verify OTP → session cookies |
| POST | `/api/v1/auth/staff/login` | staff | Email + password → session cookies |
| POST | `/api/v1/auth/refresh` | any session | Rotate tokens (reuse detection) |
| POST | `/api/v1/auth/logout` | any session | Revoke current session |
| GET  | `/api/v1/auth/me` | any session | Current identity |

## Test credentials (from seed)

- Staff: `admin@jeeva.local` / `Password123!`
  (also `reception@`, `lab@`, `pharmacy@`, `rao@jeeva.local` …)
- Patient: ID `JMH-2026-000001` — the 6-digit OTP prints to the **server
  console** in dev (no SMS provider needed until production).

## Security properties (built in, not bolted on)

- **Passwords**: bcrypt cost 12. Failed logins burn one dummy compare so
  "unknown email" and "wrong password" are timing-indistinguishable.
- **OTP**: 6 digits, SHA-256 hashed at rest (raw code never stored),
  5-minute expiry, 5 attempts per code, max 3 requests / 15 min per patient,
  constant-time comparison.
- **Enumeration-safe**: `otp/request` returns an identical masked-phone
  acknowledgement whether or not the ID exists.
- **Sessions**: httpOnly cookies, `secure` in production, `SameSite=Lax`.
  Access cookie is app-wide; refresh cookie is scoped to `/api/v1/auth`.
  Set `COOKIE_DOMAIN=.jeevamultispecialityhospital.com` for one login across
  every portal subdomain. Tokens are never returned in a response body.
- **Refresh rotation + reuse detection**: each refresh revokes the old token
  and issues a new one. Replaying a revoked token nukes every session for
  that subject (stolen-token defence).

## How later phases plug in

- Guard any new route: `const user = await requireRole(req, "RECEPTIONIST");`
- Guard any portal layout (server component): call `requireRole` and redirect
  on throw.
- The browser client (`src/lib/api-client.ts`) auto-retries once through
  `/auth/refresh` on a 401, so pages don't handle token expiry themselves.

## Verification done

- Strict `tsc` against a schema-accurate Prisma shim (21 models, 9 enums
  parsed from `schema.prisma`) — every model/field/enum reference typechecks.
- Production `next build` — all routes compile, CSS + client bundles fine.
- Import graph: all 47 source files' `@/…` imports resolve.
- `prisma validate`/`generate` must be run once on your machine (Prisma's
  engine CDN is blocked in the build sandbox) — it's instant.
