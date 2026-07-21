# Pharmacy profit in the admin overview

Adds a **Pharmacy profit** section to the admin overview (admin.localhost/), so
owners see the pharmacy margin without opening the pharmacy portal.

Four figures:
- **Profit today** — realized gross profit = Σ (MRP − rate) × qty on today's
  dispensed pharmacy lines (only lines whose batch has a recorded rate), with the
  margin % beneath it.
- **Stock value (MRP)** — current in-date stock valued at MRP, with cost beneath.
- **Potential profit** — MRP value minus cost = margin sitting in inventory.
- **Margin today** — realized sell-through margin %.

## How it's wired
The profit maths was extracted into a reusable `pharmacyProfitSummary()` in the
pharmacy service and is now called from both the pharmacy dashboard and
`adminOverview` — one source of truth, no duplicated formula.

## Files
- `src/server/services/pharmacy.service.ts` — new `pharmacyProfitSummary()`.
- `src/server/services/admin.service.ts` — `adminOverview` returns `pharmacyProfit`.
- `src/app/admin/page.tsx` — Pharmacy profit section.
- `src/server/services/reports.service.ts` — dependency (collectionByMode).
- `src/components/portal/ui/collections-card.tsx` — shared type.
- `src/components/portal/portal-scroll.tsx` — render fix (required).

## Apply
Unzip at the project root, then clean-restart:

    rm -rf .next
    npm run dev

No migration. Profit only counts dispensed lines whose batch has a purchase rate
recorded, so enter the rate when receiving stock for complete numbers.
