# Admin overview — production-grade rebuild (with hikes & lows)

A denser, cleaner dashboard that shows movement, not just totals.

## Hikes & lows (trend deltas)
- **Revenue today** — value, ▲/▼ % vs yesterday, and a 14-day sparkline.
- **Appointments today** — value, ▲/▼ % vs yesterday, 14-day sparkline.
- **Revenue this week** — rolling 7 days, ▲/▼ % vs the previous 7 days, sparkline.
- **Revenue MTD** — ▲/▼ % vs the same day-range of last month.

Delta pills are colour-aware: green when a rise is good (revenue, visits), and the
sign flips correctly for metrics where up is bad.

## The rest
- **Collected today** hero card with Cash / UPI / Card split.
- Compact secondary strip: Revenue MTD (with delta), Revenue YTD, Outstanding,
  Bed occupancy (% full), Pharmacy alerts, Patients.
- **Revenue trend** — a large area chart (14 days) / bar chart (6 months) with
  gridlines, y-axis in ₹k/L/Cr, and a running period total in the header.
- **Revenue by department** donut (with centre total) + **Revenue by doctor** bars.
- Today's appointments + Recent bills.

## Backend
`adminOverview` now also returns a **14-day daily series** (`last14Days`, powering
the sparklines and week-over-week) and **last-month-to-date revenue**
(`revenueLastMonthToDate`, for the MTD delta). Existing fields are unchanged.

## Files
- `src/app/admin/page.tsx` — the rebuilt dashboard.
- `src/server/services/admin.service.ts` — 14-day series + last-month-to-date.
- `src/server/services/reports.service.ts` — `collectionByMode` (dependency).
- `src/components/portal/ui/collections-card.tsx` — shared type.
- `src/components/portal/portal-scroll.tsx` — render fix (required).

## Apply
Unzip at the project root, then clean-restart:

    rm -rf .next
    npm run dev

No `npm install`, no migration. Deltas read "no prior data" until there are two
days of history to compare.
