# Billing list — show each bill's payment type (Cash / UPI / both)

On **Reception → Billing** (`reception.localhost/billing`), every bill now shows a
chip with how it was paid: **Cash**, **UPI**, **Card**, or **Cash + UPI** when it
was a split. Unpaid bills show no chip (their status pill already says so).

This page lists bills from **every portal** — OP consult, Lab, Pharmacy, Inpatient
— so the payment type is now visible across all of them in one place. Split
payments read as "Cash + UPI" (shown in a distinct colour so a split stands out);
single-tender bills read as just "Cash" / "UPI" / "Card".

## How it works

`listInvoices` now returns `paymentModes: string[]` per invoice — the distinct
tender types that actually took money on that bill, in a stable order
(`[]` unpaid, `["CASH"]`, or `["CASH","UPI"]` for a split). The billing row renders
that as a friendly label. Nothing else about the page changed.

Payment type was already stored on every payment row, so there's no migration.

## Files

- `src/server/services/billing.service.ts` — `listInvoices` returns `paymentModes`.
- `src/app/reception/billing/page.tsx` — renders the payment-type chip per row.

## To apply

Unzip at the project root (overlays existing files) and `npm run dev`. No
`npm install`, no Prisma migration.
