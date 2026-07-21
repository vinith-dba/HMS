# This pass: OTP fix · prescription upload · patient profile

## ⚠️ Migrate first (new table added)

A new `PrescriptionUpload` table was added. Run before anything else:

```powershell
npx prisma migrate dev --name prescription-uploads
npm run dev
```

If it complains about drift: `npx prisma migrate reset` (wipes dev data, rebuilds, reseeds).

## 1. Admin OTP fix

The cause was the **OTP rate limit** (was 3 requests / 15 min). Repeated testing
locked out whichever account you tried most. Two changes:
- **Dev limit raised to 20** requests / 15 min (still 3 in production).
- If admin STILL doesn't work after migrating, admin isn't in your DB — run
  `npx prisma db seed` and check `admin.priya` exists in `npx prisma studio`.

Admin login: `admin.localhost:3000/login` → username `admin.priya` → code prints to console.

## 2. Prescription scan upload (reception → patient profile)

New page: `reception.localhost:3000/prescriptions` (also in the sidebar as "Upload Rx").

Flow: find patient (search or recent) → drag/drop a PDF or image (max 10 MB) →
optionally attach it to a specific visit + add a title → upload. The file is
stored and linked to the patient by their Jeeva ID, so it appears in their
profile immediately.

### Storage — works now, cloud when ready
- **Right now (no setup):** files save to `/public/uploads/prescriptions/` on
  disk and are served locally. Fully working for testing today.
- **Cloud (Cloudinary):** add these to `.env` and it switches automatically,
  zero code change:
  ```
  CLOUDINARY_CLOUD_NAME=your_cloud_name
  CLOUDINARY_API_KEY=your_key
  CLOUDINARY_API_SECRET=your_secret
  ```
  Get them free at cloudinary.com → Dashboard. Once present, uploads go to
  Cloudinary and URLs become permanent cloud links.

## 3. Patient profile — complete data + downloads

`localhost:3000/portal/login` → ID `JMH2026OP00001` → OTP from console → lands on
the full profile at `/portal/profile`, now showing:
- **All registered data** — personal details, full contact block, other info.
- **Prescriptions** — every uploaded scan, with a Download button.
- **Appointments** — their visit history with doctor, date, status, price.

Referral is NOT shown to patients (admin-only, by design).

## End-to-end test
1. Reception books an appointment for `JMH2026OP00001`.
2. Reception uploads a scanned PDF at `/prescriptions`, attached to that visit.
3. Log in as the patient → the prescription and the appointment are both there.

## Note on the "digital prescription form"
You picked "both — upload scan now, digital form later." The **scan upload is
done**. The doctor-fills-a-form version (rendering like your sample: vitals,
diagnosis, medicines table, advised tests) is the doctor portal's sprint —
scaffolding is ready (Prescription + PrescriptionItem tables exist).
