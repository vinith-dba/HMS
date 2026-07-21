# Admin portal + reception patient edit/billing

## ✅ No migration needed — pure code
```powershell
npm install
npm run dev
```

---

## Reception: patient detail page (new)

`reception.localhost:3000/patients` → click any patient → full detail page at
`/patients/JMH2026OP00001`.

- **Complete details** — every registered field in a bordered grid
- **Edit details** — one click makes the whole record editable; `fullName`
  recomputes from the name parts so search keeps working
- **Generate bill** — bill a walk-in consultation right from the patient page
  (description, amount, GST %, payment mode). Uses the shared billing engine.
- **Side panels** — their visits (with status + fee) and uploaded prescriptions

Also fixed: the patients list was still reading the old `name` field (stale from
the rich-schema migration) — it now uses `fullName` and links to the detail page.

---

## Admin portal (complete)

Login: `admin.localhost:3000/login` → `admin.priya` → OTP prints to console.

### Overview (`/`)
Appointments today, new patients, revenue today, **outstanding balances**
(billed but unpaid), a **7-day bar chart** (revenue + appointment volume),
**revenue by source** (consultation / lab / pharmacy), and hospital totals.

### Appointments (`/appointments`)
Full booking history **with referral attribution** — admin-only, as designed.

### Staff (`/staff`)
- List all staff with role, username, status, last login
- **Add staff** — role picker auto-builds the `role.name` username
  (pick RECEPTIONIST + type "ravi" → `reception.ravi`). Sets email (OTP channel)
  and password.
- **Enable / disable** — accounts are never deleted, only deactivated.
  You can't deactivate your own account.

### Lab catalog & GST (`/catalog`)  ← **this is where GST rates are set**
Every lab test with price, GST rate, and active status. Add or edit any test.
**0% shows as "Exempt"** — the correct default for diagnostics. When your CA
confirms a test is taxable, set its rate here and every future invoice picks it
up automatically (CGST + SGST, each half).

### Hospital settings (`/settings`)
Legal name, address, city, **state code (Telangana = 36)**, PIN, **GSTIN**,
phone, email. These print on every GST invoice — replace the placeholder GSTIN
with the hospital's real registration number before going live.

### Audit log (`/audit`)
Every significant action: who did it, what they touched, when. Registrations,
bookings, invoice creation/edit/cancellation, staff changes, report uploads.

---

## New APIs
```
GET  /api/v1/admin/overview        analytics bundle
GET  /api/v1/admin/staff           list staff
POST /api/v1/admin/staff           create staff (role.name username)
POST /api/v1/admin/staff/active    enable / disable
GET  /api/v1/admin/catalog         all lab tests
POST /api/v1/admin/catalog         create / update (GST rate lives here)
GET  /api/v1/admin/config          hospital config
PUT  /api/v1/admin/config          update GSTIN / address / state code
GET  /api/v1/admin/audit           audit log
```
All ADMIN-only and audited.
