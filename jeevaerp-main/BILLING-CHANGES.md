# Jeeva — percentage discount + split payment (cash + UPI)

Two things, live on **every** bill (reception consultation, book-and-bill, lab bill,
lab order, pharmacy counter sale, pharmacy queue, IPD discharge, and the invoice
editor):

1. **Discount as a percentage.** Every discount box now has a `%` / `₹` toggle,
   defaulting to `%`. Type `10`, get 10% off the subtotal. The rupee amount is
   shown live and is what gets stored — so GST stays exactly correct — and the
   printed bill reads **`Discount (10%)`**.
2. **Split payment.** Every "collect payment" block has a **⇆ Split cash + UPI**
   toggle. Type the cash portion; UPI fills in as the remainder (with a `½`
   quick-split and an optional UPI reference). The bill is settled as two payment
   rows and the printed receipt lists both, e.g. `Payment: CASH ₹500 · UPI ₹319.60`.

## No database migration

Split payment needed **no schema change** — `Payment` was already a one-to-many on
`Invoice`, and every "how much is paid" figure already sums across all rows. The
percentage is stored as the same rupee `discountAmount` as before (the tax engine
is untouched) and the `%` is shown back on the receipt, computed against the bill's
fixed subtotal.

## How to apply

Unzip at your project root (overlays existing files). One file is new:
`src/components/portal/ui/bill-fields.tsx`. Then just `npm run dev` — no
`prisma migrate`, no `prisma generate` needed for these changes.

## Files changed

Backend
- `src/server/billing/calc.ts` — added a pure, tested `assertPaymentsWithinTotal` guard.
- `src/server/services/billing.service.ts` — `createInvoice` accepts `payments[]`;
  `recordPayment` is now split-capable (`recordPayments`), single-tender wrapper kept.
- `src/server/services/{labs,pharmacy,ipd,appointments}.service.ts` — thread `payments[]` through.
- `src/server/validators/{labs,pharmacy,ipd,reception}.ts` — accept `payments[]`.
- `src/app/api/v1/billing/consultation/route.ts`, `.../billing/payment/route.ts`,
  `.../ipd/admissions/[id]/discharge/route.ts` — pass/normalise `payments`.

Frontend
- `src/components/portal/ui/bill-fields.tsx` — **new** `DiscountInput` + `PaymentSection`.
- Bill-creation UIs: `src/app/reception/{patients/[displayId],book,labs}/page.tsx`,
  `src/app/reception/ipd/inpatients/page.tsx`, `src/app/pharmacy/{dispense,queue}/page.tsx`,
  `src/app/labs/billing/page.tsx`.
- Invoice editor: `src/app/labs/invoices/page.tsx`.
- Printed bill: `src/app/reception/print/invoice/[invoiceId]/page.tsx` (shows `Discount (X%)`).

## Worth a manual check

- On a pharmacy bill with a GST line, the split total is the GST-inclusive grand
  total. As before, client-side GST is a display estimate; if it lands a paise off
  the server's per-line rounding the bill simply shows a ₹0.01 balance — unchanged
  from the old single-payment behaviour.
- IPD discharge discount applies to the bed-charges subtotal shown on screen (labs
  and pharmacy were already billed during the stay), which is what that invoice bills.
