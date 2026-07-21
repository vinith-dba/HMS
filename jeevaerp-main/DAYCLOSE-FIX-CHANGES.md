# Fix: Day close 500, + headline Cash/UPI collected

## The crash (fixed)

`GET /api/v1/reception/day-close` was throwing a Prisma 500:

    Unknown field `fullName` for select statement on model `User`

`dayClose` selected `refundedBy: { select: { fullName: true } }`, but the **User**
model's name field is `name` — only **Patient** has `fullName`. So the query never
built and the whole Day-close page failed to load. Changed the select (and the
matching type + usage) to `name`.

The same `fullName`-on-a-User mistake existed in one more place —
`ipd.service.ts`, the admission-charge `addedBy` select — which would 500 the
admission detail view the moment a charge had a recorded author. Fixed that too.

Both were pre-existing; nothing in the recent billing/collections work touched
them — the Day-close page just hadn't been exercised until now.

## Cash collected / UPI collected

The Day-close page already broke collections down by type in its "Taken today"
table (Cash / UPI / Card, each with collected / refunded / net) — it was simply
hidden behind the 500. To make it obvious, added a headline KPI strip at the top:
**Cash collected · UPI collected · Card collected · Total collected**. Same numbers
as the table below, just up front.

(These are the same per-type figures now shown on the pharmacy, lab and admin
dashboards from the previous change, and the payment-type chip on the billing list.)

## Files

- `src/server/services/reports.service.ts` — `dayClose` refund select `fullName` → `name`.
- `src/server/services/ipd.service.ts` — admission-charge `addedBy` select `fullName` → `name`.
- `src/app/reception/day-close/page.tsx` — headline Cash/UPI/Card/Total collected strip.

## To apply

Unzip at the project root (overlays existing files) and `npm run dev`. No
`npm install`, no Prisma migration.
