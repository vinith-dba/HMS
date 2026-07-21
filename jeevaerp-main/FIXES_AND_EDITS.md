# Fixes + edit features

## ✅ No migration needed — pure code. Just:
```powershell
npm install     # lenis removed from deps
npm run dev
```

---

## 1. "Users not loading" — FIXED (real bug, my fault)

The labs **Order tests** page loads patients from `/reception/patients` and
`/reception/patients/recent`. Both routes were guarded as
`requireRole("RECEPTIONIST", "ADMIN")` — so when you logged in as `labs.sana`
(LAB_TECH) they returned **403** and the list came back empty. Worse, the
`.catch(() => {})` swallowed the error so you saw nothing.

Fixed:
- **GET** (search / recent) now allows `RECEPTIONIST, LAB_TECH, PHARMACIST, ADMIN`
- **POST** (register a patient) correctly stays **reception/admin only**
- Load failures now **show an error banner** instead of failing silently

## 2. "Tests not scrolling" + Lenis — FIXED

Lenis was hijacking the scroll event, which broke the `overflow-y-auto` catalog
list. **Lenis is now completely removed** (portal, public site, and package.json).
Smooth scrolling is native CSS (`scroll-behavior: smooth`), which is faster,
accessible, respects reduced-motion, and doesn't fight inner scroll containers.
The catalog list also got `overscroll-contain` so its scroll doesn't leak.

---

## 3. Billing edits — built the audit-safe way

**A tax invoice is a legal document.** If a paid ₹5,000 bill could be silently
edited to ₹500, the audit trail is worthless and your client carries real tax
liability. So:

| Invoice state | What you can do |
|---|---|
| **PENDING** (unpaid) | **Edit freely** — change lines, qty, price, discount |
| **PAID / PARTIALLY_PAID** | **Locked.** Cancel + reissue a corrected invoice |
| **CANCELLED** | Kept in the ledger forever, never deleted |

New page: **`labs.localhost:3000/invoices`**
- Lists all lab invoices with status
- **Edit** (unpaid only) — modal to change line items, qty, price, discount
- **Cancel** (any) — requires a reason; invoice is marked CANCELLED and kept.
  **Lab tests on it are released** so you can re-bill them on a corrected invoice.
- Every edit and cancellation is written to the audit log.

## 4. Profile editing

**Patient self-edit** (`/portal/profile`) — an **Edit** button on the Contact
panel lets the patient update their own phone, alternate phone, email, address,
city, state and PIN. Deliberately narrow: they cannot change their name, DOB,
blood group or UHID (clinical/identity fields belong to the hospital).

**Reception edits a patient** — `PATCH /api/v1/reception/patients/[displayId]`
updates any registered field (name parts recompute `fullName` so search stays
correct). Referral snapshots are deliberately **not** editable — rewriting them
would be exactly the history-drift we designed against.

## 5. File replace / delete

**Prescriptions** (reception `/prescriptions`): pick a patient → an **Existing
prescriptions** list appears with **View / Replace / Delete** per file.

**Lab reports** (labs `/queue`): completed tests now show **Replace** (upload a
new file) and **Remove** (deletes the report and reopens the test as PENDING).

---

## New API surface
```
GET    /api/v1/billing/invoices?source=LAB       list invoices
PATCH  /api/v1/billing/invoice/[id]              edit (unpaid only)
POST   /api/v1/billing/invoice/[id]/cancel       cancel (reason required)
PATCH  /api/v1/reception/patients/[displayId]    reception edits a patient
GET    /api/v1/reception/patients/[displayId]/prescriptions
PATCH  /api/v1/reception/prescriptions/[id]      replace file / title
DELETE /api/v1/reception/prescriptions/[id]      delete upload
PATCH  /api/v1/portal/profile/contact            patient self-edit
POST   /api/v1/labs/tests/report/remove          remove report, reopen test
```
