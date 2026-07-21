# Send the OPD sheet itself as the prescription (no scan needed)

Reception no longer has to photograph the doctor's paper to get a prescription
to the pharmacy. The OPD **stationery sheet** — built from the vitals and
medicines already typed in — is now rendered to a real PDF and sent straight
through, to the pharmacy queue **and** to the patient's record. The old
scan-upload flow is untouched; it's just optional now.

## What changed for the user

On **Reception → Prescriptions** (`reception.localhost/prescriptions`):
- The file dropzone is now **optional**. Type the medicines, pick the visit, and
  press **"Send OPD sheet to pharmacy"** (or "Save to record" to file it without
  sending yet). Vitals you've typed are saved first so they land on the sheet.
- The success banner shows a **"Patient's copy"** link (the generated PDF) plus
  the existing **"Print OPD sheet"** button.
- If you *do* attach a scan of the original, the old **"Upload & send scan"**
  buttons still appear and work exactly as before. Inpatient (ward-chit) uploads
  are unchanged.

On **Pharmacy → Prescription queue**: a sent sheet now renders **inline as a PDF**
(previously the viewer only handled image scans, so a PDF would have shown a
broken image). Photo scans still render as images.

The sheet is a proper A4 OPD prescription in the same brand as the printed
stationery — letterhead, patient block, vitals, the ℞ table (with the typed
medicines, quantities and dosage), advice/next-visit lines, signature and footer.

## How "to the patient" works

The prescription is linked to the patient by UHID, so it's on their own record
(their copy) automatically — the same as an uploaded scan. Reception can also
hand/download it from the "Patient's copy" link. There's no SMS/email channel in
the app, so nothing is silently "messaged"; the copy is made available to give or
download. If you later add a patient messaging channel, this PDF is the artifact
to attach.

## To apply

Unzip at your project root (overlays existing files). **Run `npm install`** once —
this adds one dependency, `pdf-lib` (pure JS, no native/engine downloads). Then
`npm run dev`. No Prisma migration and no `prisma generate` are needed — the
`PrescriptionUpload` model already stores everything (the PDF is just another
file on the record, `mimeType: application/pdf`).

## Files

New
- `src/server/print/opd-pdf.ts` — renders the OPD sheet to a PDF with `pdf-lib`.
- `src/app/api/v1/reception/prescriptions/opd/route.ts` — `POST` to generate + send.

Changed
- `src/server/services/prescriptions.service.ts` — `sendOpdSheetToPharmacy()`.
- `src/server/services/pharmacy.service.ts` — queue now returns `mimeType`.
- `src/server/validators/reception.ts` — `sendOpdSheetSchema`.
- `src/app/reception/prescriptions/page.tsx` — optional scan + "Send OPD sheet"
  flow + patient-copy link.
- `src/app/pharmacy/queue/page.tsx` — render PDF sheets inline (keeps the billing
  split-payment changes from the previous set; this is the full current file).
- `src/components/portal/ui/icons.tsx` — registered the `printer` icon (it was
  already referenced by the "Print OPD sheet" button but never defined — that was
  a pre-existing type error and a blank icon; now fixed).
- `package.json` — adds `pdf-lib`.

## Notes / worth a check

- This path is for **OPD** visits (it needs an appointment). Admitted patients
  keep the scan-upload path, since an inpatient Rx is charged to the room and has
  no OPD sheet — same rule the page already followed.
- Once a sheet is sent, the live `/print/opd/{appointmentId}` page also shows the
  same medicines (it reads them from the filed prescription), so paper and PDF
  match.
- Sending with zero medicines is allowed and produces a vitals-only sheet marked
  "No medicines listed." Add the medicines first for a normal Rx.
