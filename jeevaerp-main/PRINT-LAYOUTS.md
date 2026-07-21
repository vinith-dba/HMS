# Printed stationery — OPD sheet + GST bill (matching the referral layout)

Built from the referral sheet you photographed at the counter. Same skeleton:
letterhead (doctor left · hospital block right) → patient strip → vitals strip →
allergy line → evaluation / diagnosis rules → ℞ table with 1-0-0 dosage and Telugu
timing hints (భోజనం ముందు / తర్వాత) → advice / tests / next visit → signature →
solid footer band (appointments phone · address · timings).

**Deliberately NOT copied:** Apex's name, logo, the doctor's credentials, and the
patient's details in the photo. Those belong to a real clinic and a real person.
The *structure* is standard Indian OPD stationery; the identity is Jeeva's, fed
from your Hospital settings and the Doctor table.

## Where the buttons are
- **Book success card** → "Print OPD sheet" (and "Print bill" when billed together)
- **Patient file → Visits** → Print per visit
- **Patient file → Bills** (new section — you were fetching invoices but never
  showing them) → Print per bill

Print pages open in a new tab at `/print/opd/{appointmentId}` and
`/print/invoice/{invoiceId}` — subdomain-relative like everything else. The
toolbar's Print button opens the browser dialog: paper OR Save-as-PDF.

## How the ℞ table fills
- Printed **at booking** → the table is 8 ruled blank rows: the doctor writes by
  hand on it, exactly like the Apex sheet is used. Vitals boxes are blank for the
  triage pen. This is the sheet reception should print with every OP registration.
- Printed **after reception has typed the medicines** (the upload flow) → the rows
  fill in. Dosage text like `1-0-0 after food 1 month` is auto-split: the `1-0-0`
  pattern goes to the Dosage column, the rest to Timing & duration. A small note
  says it was transcribed at the desk and the scanned original is on record.

## The bill
Same letterhead family so both papers look like one hospital. GST-correct:
- Title auto-switches: **Tax Invoice** when any line carries GST, **Bill of
  Supply** when everything is exempt (that's the legally right label).
- CGST/SGST split rows appear only when tax applies; exempt lines print "Exempt".
- **Amount in words** in Indian numbering (lakh/crore) — tested through the
  crore boundary.
- GSTIN prints from Hospital settings — **it's still the placeholder
  `36AACCA1234F1Z5`; replace before any real bill goes out.**

## Re-inking
The whole stationery reads two CSS variables in
`src/components/print/stationery.tsx`:
`--pr-primary` (teal) and `--pr-accent` (saffron). If the client wants the classic
red/blue like the Apex paper, change those two lines — both documents follow.

No schema change — no migration. Telugu text renders via Noto Sans Telugu /
Nirmala UI fallbacks (present on Windows).
