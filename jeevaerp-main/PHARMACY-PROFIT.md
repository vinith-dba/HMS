# Pharmacy profit — rate, MRP & margin

Your stock model already stores both prices per batch: **MRP** (what the patient
is billed) and **purchase price / rate** (what you paid the distributor). The
Receive-stock form already captures both. This adds the profit maths and shows it.

## Pharmacy dashboard  (pharmacy.localhost/)
New profit strip under the KPIs:
- **Profit today** — realized gross profit = Σ (MRP − rate) × qty on today's
  dispensed lines (only lines whose batch has a recorded rate).
- **Margin today** — that profit as a % of the costed sales.
- **Stock value (MRP)** — current in-date stock valued at MRP, with cost beneath.
- **Potential profit** — MRP value minus cost value = margin sitting in inventory.

## Stock page  (pharmacy.localhost/stock)
Each batch row now shows **MRP · rate · +margin (₹ and %)** — so you can see the
markup on every batch at a glance. Batches without a recorded rate just show MRP.

## Backend
- `pharmacyStats` now returns `profitToday`, `marginPct`, `stockValueCost`,
  `stockValueMrp`, `potentialProfit`.
- `medicineBatches` now returns each batch's `rate`, `margin`, `marginPct`.

Profit only counts lines whose batch has a purchase rate recorded — so enter the
purchase price when receiving stock and the numbers get complete. Nothing is
overstated: unknown-cost lines contribute ₹0 profit rather than full price.

## Files
- `src/server/services/pharmacy.service.ts`
- `src/app/pharmacy/page.tsx`
- `src/app/pharmacy/stock/page.tsx`

## Apply
Unzip at the project root, then clean-restart:

    rm -rf .next
    npm run dev

No `npm install`, no migration (the price fields already exist in the schema).
