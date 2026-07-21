# Updated Admin dashboard

The admin overview now surfaces the payment-type / collections work end to end.

## What's on it now

Top KPI row (unchanged): **Appointments today · New patients · Revenue today
(all sources) · Outstanding**.

**New — "Collected today" headline strip:** Cash collected · UPI collected · Card
collected · Total collected, across every counter (consultation, lab, pharmacy,
IPD), at a glance. This is money actually taken (payments), which is distinct from
"Revenue today" above (that's billed accrual).

Main grid (unchanged): the 7-day revenue/appointments chart on the left; on the
right, **Revenue by source**, the detailed **Collections by payment type** card
(per-type amounts, transaction counts and refunds netted), and **Hospital totals**.

So cash-vs-UPI now reads the same way across the app: this admin headline, the
pharmacy/lab dashboard cards, the reception Day-close, and the per-bill chip on the
billing list.

## This bundle is self-contained

The dashboard needs three supporting files, all included so it works regardless of
which earlier zips you've applied:

- `src/app/admin/page.tsx` — the dashboard (the update).
- `src/server/services/admin.service.ts` — `adminOverview` returns `collectionsByMode`.
- `src/server/services/reports.service.ts` — the `collectionByMode` helper (also
  carries the Day-close `fullName` → `name` fix).
- `src/components/portal/ui/collections-card.tsx` — the by-type card.

## To apply

Unzip at the project root (overlays existing files). If your dev server is running,
do a clean restart so the changes take (overwriting files under a running server
can leave a stale build):

    # stop the dev server (Ctrl + C), then:
    rm -rf .next
    npm run dev

No `npm install`, no Prisma migration. Numbers only appear once payments are
actually recorded for the day shown — an all-zero strip means no collections yet,
not an error.
