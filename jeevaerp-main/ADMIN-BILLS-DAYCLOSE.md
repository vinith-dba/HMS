# Admin: All bills + Day close

Two new admin pages, both showing payment type. Self-contained (includes the
day-close service dependency and the PortalScroll render fix).

## All bills  (admin.localhost/bills)  — NEW
Every invoice across all counters — consultation, lab, pharmacy and inpatient —
in one list. Each bill shows its source, patient, date, amount / amount paid,
status, and **payment-type chips** (Cash / UPI / Card / split, or "unpaid").
- Filter by **source** (All / Consultation / Lab / Pharmacy / Inpatient / Other).
- Filter by **payment type** (Any / Cash / UPI / Card / Split / Unpaid).
- Search by receipt no, patient or UHID.
- Live summary: bill count, total billed, total collected for the current filter.

## Day close  (admin.localhost/day-close)  — NEW
A hospital-wide, read-only close for any date (date picker at top):
- Cash / UPI / Card / Net headline.
- **By payment type** — collected, refunds and net per tender, with counts.
- **By counter** — how many payments each person took and how much.
- Refunds given, and bills raised today that are still due.

(This is the admin, whole-hospital view; the reception Day-close remains the
drawer-reconciliation tool for the front desk.)

## Backend
- New route `GET /api/v1/admin/bills` — ADMIN-only, lists up to 200 invoices with
  payment modes (optional `?source=`), via the existing `listInvoices`.
- Day close reuses the existing `/reception/day-close` endpoint (it already allows
  ADMIN) and the `dayClose` report's `byCounter` tally.

## Files
- `src/app/api/v1/admin/bills/route.ts`  (new)
- `src/app/admin/bills/page.tsx`  (new)
- `src/app/admin/day-close/page.tsx`  (new)
- `src/lib/portal/nav.ts`  (adds "All bills" + "Day close" to the admin sidebar)
- `src/server/services/reports.service.ts`  (dayClose `byCounter` — dependency)
- `src/components/portal/portal-scroll.tsx`  (render fix — required)

## Apply
Unzip at the project root, then clean-restart:

    rm -rf .next
    npm run dev

No `npm install`, no migration.
