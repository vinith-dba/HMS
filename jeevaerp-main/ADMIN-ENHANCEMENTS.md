# Admin portal enhancements (this batch)

Self-contained — includes the PortalScroll fix, so applying just this zip makes
every page below render correctly.

## 1. Overview redesigned  (admin.localhost/)
- Cleaner KPI tiles with soft icon badges: Appointments today, Revenue today
  (MTD/YTD beneath it), Outstanding, Bed occupancy, Pharmacy alerts, Registered
  patients (+ doctor/staff counts).
- Collected-today strip (Cash / UPI / Card / Total, total highlighted).
- Revenue trend (Daily/Monthly toggle) + Revenue-by-department donut.
- **Revenue by doctor** — ranked bars of consultation + inpatient billing per
  doctor, with visit counts.
- Today's appointments + Recent bills.

## 2. Appointments  (admin.localhost/appointments)
- **Search** by patient, UHID, doctor, or referral name.
- **Referrals by person** — ranked chips showing how many visits each referrer
  sent in; tap to filter to that referrer (this is your "referred count by a
  person").
- **Bill + payment type inline** — every visit shows its bill amount, paid /
  part-paid status, and payment-type chips (Cash / UPI / Card / split), read from
  the invoice raised against that appointment.

## 3. Wards & beds  (admin.localhost/wards)
- Beds are now **SVG bed tiles** coloured by state (free = cyan, occupied = blue,
  maintenance = grey).
- Occupied tiles show the **admitted patient** — name, IP number and UHID — right
  on the bed.

## 4. Reception — counter tally  (reception.localhost/day-close)
- New **By counter** section: how many payments each person (counter) took today
  and how much, next to the existing cash/UPI/card breakdown.

## Backend
- `adminOverview` → `revenueByDoctor`.
- `adminAppointmentHistory` → `bill` (total, status, payment modes) per visit.
- `dayClose` → `byCounter` (per-receptionist payment count + amount).

## Payment type on invoices
Consultation bills now carry payment type into the appointments view, and the
reception billing list already shows a per-bill payment chip. If you want the same
chip on the **lab invoices** list too, say so and I'll add it.

## Files
- `src/app/admin/page.tsx`
- `src/app/admin/appointments/page.tsx`
- `src/app/admin/wards/page.tsx`
- `src/app/reception/day-close/page.tsx`
- `src/server/services/admin.service.ts`
- `src/server/services/appointments.service.ts`
- `src/server/services/reports.service.ts`
- `src/components/portal/portal-scroll.tsx`  (blank-body fix — required)
- `src/components/portal/ui/collections-card.tsx`  (shared type)

## Apply
Unzip at the project root, then clean-restart:

    # stop the dev server (Ctrl + C), then:
    rm -rf .next
    npm run dev

No `npm install`, no Prisma migration.
