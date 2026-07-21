# Admin overview (rich) + HR management

Rebuilds the admin overview to match the reference HMS demo's admin console
content, and adds a dedicated HR console. All wired to real data — nothing mocked.

## Admin overview  (admin.localhost/)

Six KPIs across the top: **Appointments today** (with completed count) ·
**Revenue today** · **Revenue MTD** · **Revenue YTD** · **Bed occupancy**
(occupied / total, free beds) · **Pharmacy stock alerts** (batches at/below
reorder level).

Then the **Collected today** strip (Cash · UPI · Card · Total — money actually
taken across every counter), followed by:

- **Revenue trend** — a chart with a **Daily / Monthly** toggle (last 7 days as a
  line, last 6 months as bars). Inline SVG, no chart library added.
- **Revenue by department** — a donut of billed value by source
  (Consultation / Lab / Pharmacy / Inpatient / Other) with a % legend.
- **Today's appointments** — time, patient, doctor · department, status.
- **Recent bills** — receipt no, date, discount %, amount, status.

The data comes from an expanded `adminOverview` service (bed occupancy from
beds + admissions, pharmacy alerts from batch quantities vs reorder level,
today's appointments, recent bills, MTD/YTD and a 6-month revenue series).

## HR & staff  (admin.localhost/hr)  — NEW

A proper HR console, replacing the old plain "Staff" link in the sidebar:

- **Headcount** — active staff total + a live count per role (Admin, Reception,
  Lab, Pharmacy, Doctor).
- **Directory** — filter by role, search by name / username / phone; each row
  shows avatar initials, role tag, username · phone · email, last sign-in, and an
  active/inactive toggle.
- **Add staff** — role picker, `role.handle` username builder, name, phone, email,
  temporary password. Uses the existing, validated staff endpoints.

It uses the same `GET/POST /admin/staff` and `POST /admin/staff/active` APIs the
old staff page used — no new backend, no migration. The old `/staff` page still
works by URL; the sidebar now points to the richer `/hr`.

## Files

- `src/app/admin/page.tsx` — rebuilt rich overview.
- `src/app/admin/hr/page.tsx` — NEW HR console.
- `src/server/services/admin.service.ts` — expanded `adminOverview`.
- `src/server/services/reports.service.ts` — `collectionByMode` helper (dependency;
  also carries the Day-close `fullName` → `name` fix).
- `src/components/portal/ui/collections-card.tsx` — shared `CollectionMode` type.
- `src/lib/portal/nav.ts` — sidebar "Staff" → "HR & staff" (`/hr`).

## Apply

Unzip at the project root, then clean-restart (important — overwriting files under
a running dev server can leave a blank page / "1 error"):

    # stop the dev server (Ctrl + C), then:
    rm -rf .next
    npm run dev

No `npm install`, no Prisma migration. With an empty database the KPIs read ₹0 and
the lists show friendly empty states — that's "no data yet", not an error.
