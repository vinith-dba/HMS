# Labs Portal — production build

## ⚠️ Migrate first (schema changed)

```powershell
npx prisma generate
npx prisma migrate dev --name labs-billing
npx prisma db seed
npm run dev
```
If drift: `npx prisma migrate reset` (wipes dev data, rebuilds, reseeds).

Schema changes: `LabTest.appointmentId` is now **optional** (walk-in tests need no
doctor visit) + direct `patientId` link; new **HospitalConfig** table (GSTIN,
legal name, address, state code 36) used on invoice headers.

Login: `labs.localhost:3000/login` → `labs.sana` → OTP prints to console.

---

## ⚠️ Read this about GST — it matters legally

**Most healthcare in India is GST-EXEMPT, not taxed.** Under Notification
12/2017 (Central Tax – Rate), healthcare services by a clinical establishment —
diagnosis, treatment, consultation, lab tests — are **exempt (0%)**.

Also: **GST is national, not state-specific.** There is no separate "Telangana
GST rate." What IS Telangana-specific is the **state code (36)**, which appears
on the invoice, and the fact that intra-state supply splits tax into
**CGST + SGST** (each half the total rate) — which this system does correctly.

So the system ships with:
- **Lab tests: `gstRatePct = 0` (exempt)** — the correct, defensible default.
- **Rates fully configurable per test** in `LabTestCatalog.gstRatePct`.
- Invoices show "Exempt" per line when the rate is 0, plus a footnote citing the
  exemption notification.

**Your client's CA must confirm the final rates.** If any test IS taxable, set
its `gstRatePct` in the catalog and the invoice math updates automatically —
CGST and SGST each get half. Pharmacy medicines ARE taxable (5%/12%) and will
use this same billing engine later.

---

## What's in the portal

**Dashboard** (`/`) — pending tests, completed today, revenue today, unbilled count, live pending queue.

**Test queue** (`/queue`) — filter Pending/Completed/All. Per test: **upload a
report** (PDF/image → auto-marks completed) or **mark done** without a file.
Reports open in a new tab.

**Order tests** (`/order`) — pick a patient (search or recent), select from the
**20-test catalog** (CBP, HbA1c, Lipid, LFT, KFT, Thyroid, Vitamin D, Dengue,
X-Ray, ECG, 2D Echo…), see a running total. **Walk-in tests need no appointment.**
Prices are snapshotted at order time, so later catalog changes don't rewrite history.

**Billing** (`/billing`) — find patient by Jeeva ID → select unbilled tests →
optional discount → optional payment (Cash/UPI/Card/Netbanking + reference) →
**generates a real GST invoice**: hospital header with GSTIN + state code,
billed-to block, itemised table with SAC codes and per-line GST, CGST/SGST split,
totals, paid/balance. **Print / Save PDF** button.

**Patient history** (`/patients`) — by Jeeva ID: patient card, **last visit**
(doctor, department, date, OP number), every lab test with report links, and all
lab invoices with status.

---

## Billing engine (reusable)

`src/server/services/billing.service.ts` is a **shared engine** — not lab-only:
- `createInvoice()` — any source (LAB / CONSULTATION / PHARMACY), per-line GST,
  proportional discount, CGST=SGST=rate/2, optional immediate payment
- `recordPayment()` — part payments; status auto-derives (PENDING → PARTIALLY_PAID → PAID)
- `getInvoice()` — full invoice + hospital GST header for printing

**Walk-in OP consultation billing** is live at `POST /api/v1/billing/consultation`
(reception/labs/admin) — bills a consultation through the same engine.

Money is `Decimal(10,2)` end-to-end, rounded at each step — no float drift.

---

## API surface

```
GET  /api/v1/labs/catalog              active test catalog
GET  /api/v1/labs/tests?status=PENDING work queue
POST /api/v1/labs/tests/order          order tests (walk-in capable)
POST /api/v1/labs/tests/report         upload report (multipart) → completes test
POST /api/v1/labs/tests/complete       mark done without a file
POST /api/v1/labs/bill                 generate GST invoice for selected tests
GET  /api/v1/labs/stats                dashboard counters
GET  /api/v1/labs/patients/[displayId] last visit + tests + invoices
POST /api/v1/billing/consultation      walk-in OP consultation bill
POST /api/v1/billing/payment           record a payment
GET  /api/v1/billing/invoice/[id]      fetch invoice for printing
```
All role-guarded (LAB_TECH / RECEPTIONIST / ADMIN as appropriate), all audited.
