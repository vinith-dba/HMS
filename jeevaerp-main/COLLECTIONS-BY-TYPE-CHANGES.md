# Collections by payment type — at every counter, for staff & admin

Payment type (Cash / UPI / Card / Net banking / Other) is now **tallied at each
counter** and shown to the staff who work that counter, plus a hospital-wide view
for admin. Split payments count correctly — each leg lands under its own type.

## Where it shows

- **Pharmacy → dashboard**: a "Collections by payment type" card = what the
  pharmacy till took today, split by type.
- **Labs → dashboard**: the same card for the lab till.
- **Admin → overview**: the same card, hospital-wide (all counters), next to the
  existing "Revenue by source".
- **Reception → Day close**: already had this split (it's where the pattern came
  from) — unchanged.

Each card lists every type used, its amount and transaction count, a **Total
collected**, and — if any refunds went out today — a "less refunds / net" line.
A counter's refund is matched to that counter through the invoice it came from, so
a refund handed back at the pharmacy reduces the pharmacy's cash, not reception's.

## On "stored for all"

Nothing to migrate: `Payment.mode` is a required field, so **every** payment —
including each leg of a split cash+UPI bill — already carries its type. This change
is about *calculating and showing* that split per counter, not about storing it.

## How the maths works

One reusable server helper, `collectionByMode({ dateISO?, sources? })`, groups the
day's payments (and nets refunds) by type. Pass `sources` to scope it to a counter
(`PHARMACY`, `LAB`, …) or omit it for all counters. It's wired into the existing
dashboard stat calls, so there are no extra round-trips:
- `pharmacyStats()` → pharmacy till (source `PHARMACY`)
- `labStats()` → lab till (source `LAB`)
- `adminOverview()` → all counters

"Counter" here means the till, not the individual cashier — the tally is by
collection point for the day, which is what you reconcile a drawer against. (If you
later want a per-user breakdown, `Payment.receivedById` is there to group on.)

## Files

New
- `src/components/portal/ui/collections-card.tsx` — the shared card.

Changed
- `src/server/services/reports.service.ts` — `collectionByMode()` helper.
- `src/server/services/pharmacy.service.ts` — `pharmacyStats` returns `collections`.
- `src/server/services/labs.service.ts` — `labStats` returns `collections`.
- `src/server/services/admin.service.ts` — `adminOverview` returns `collectionsByMode`.
- `src/app/pharmacy/page.tsx`, `src/app/labs/page.tsx`, `src/app/admin/page.tsx` —
  render the card.

## To apply

Unzip at the project root (overlays existing files) and run `npm run dev`. No
`npm install`, no Prisma migration.
