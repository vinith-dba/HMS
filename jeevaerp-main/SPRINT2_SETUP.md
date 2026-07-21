# Sprint 2 (backend) — Reception register + search

## What's new
- Real APIs that save & read patients from Postgres (no more demo data on these screens)
- UHID format is now **JMH2026OP00123**
- Register + Patients-search pages are wired to the live API
- Audit logging on registration (who registered whom, with IP/UA)
- Slot-generation utility ready for the next pass (booking)

## The schema changed — you must migrate

Two schema edits landed: `Patient.age`, `Patient.bloodGroup`, and the new UHID
format. Run:

```powershell
npx prisma generate
npx prisma migrate dev --name reception-patient-fields
```

Since the demo patient's ID changed (JMH2026OP00001), reset if you want clean
seeded data:

```powershell
npx prisma migrate reset       # wipes + re-migrates + re-seeds (dev only!)
```

Then:

```powershell
npm run dev
```

## Endpoints (all require RECEPTIONIST or ADMIN session)

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/reception/patients` | Register a patient → issues real UHID, saves row |
| GET  | `/api/v1/reception/patients?q=` | Search by name / UHID / phone (newest first) |
| GET  | `/api/v1/reception/patients/[displayId]` | Pull one patient by UHID |

## Try it (the CORRECT URLs — no doubled `/reception`)

1. Sign in: `reception.localhost:3000/login` → `reception@jeeva.local` / `Password123!`
2. Register: `reception.localhost:3000/register` — fill the form, submit.
   The OP slip shows a **real** issued ID (e.g. JMH2026OP00002), saved to DB.
3. Search: `reception.localhost:3000/patients` — type a name/ID; results come
   live from Postgres. Your just-registered patient appears at the top.
4. Confirm persistence: the new patient can now log in at
   `localhost:3000/portal/login` with their issued UHID.

## Note on the URL confusion
The subdomain `reception.` already maps to the reception portal. So it's
`reception.localhost:3000/register`, NOT `/reception/register`. Never repeat
the word `reception` in the path.

## Slot generation (for next pass)
`src/server/services/slots.service.ts` → `generateSlots(days)` turns the
seeded doctor schedules into concrete bookable slots. Idempotent (safe to
re-run). Booking APIs wire to this next.
