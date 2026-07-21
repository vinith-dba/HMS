# Stronger registration + real-time 10-minute booking

> **Run a migration after applying** — this adds patient columns and changes the
> slot-gap default:  `npx prisma migrate dev --name patient_emergency_and_10min`
> (or `npx prisma db push`). Then the clean restart.

## Registration
- **Age ⇄ DOB stay in sync.** Type an **age** → date of birth is set to **1 Jan of
  that birth year**. Pick a **DOB** → age is computed from it. Enter either one.
- **New fields (stronger record):** emergency contact **name / relationship /
  phone**, **known allergies**, and **Govt ID (Aadhaar / ABHA)** — added to the
  form, the validator, the create service and the Patient model.

## Booking slots
- **Real-time.** For **today**, any slot whose start time has already passed is
  dropped from the grid — you can only book times still ahead of the clock (e.g.
  at 11:30, the 9:00–11:20 slots disappear). Future dates show the full day.
- **10-minute gaps** instead of 15. Use the **"Regenerate 10-min"** link on the
  booking screen (next to the open-slot count) once to rebuild the future grid at
  10-minute cadence — it resets active schedules to 10 min and clears only the
  *free* future slots (booked/blocked ones are untouched). New schedules default
  to 10 min going forward.

## Files
Booking: `appointments.service.ts` (real-time filter), `slots.service.ts`
(`regenerateFutureSlots`), `api/v1/reception/slots/regenerate/route.ts` (new),
`reception/book/page.tsx` (button), `prisma/schema.prisma` (default 10).
Registration: `prisma/schema.prisma` (patient fields), `validators/reception.ts`,
`reception.service.ts`, `reception/register/page.tsx`.

## Apply
    npx prisma migrate dev --name patient_emergency_and_10min   # or: npx prisma db push
    rm -rf .next
    npm run dev

Then open the booking screen and click **Regenerate 10-min** once.
