# Landing restyle — "cool porcelain, quiet precision"

A complete visual redesign of the public site. No migration, no new packages.

## The direction
- **Canvas:** cool porcelain near-white (#f5f7f8) — calm, clean, never warm cream.
- **One accent:** deep pine (#0b544c). Red exists only on the emergency band.
- **Type:** Bricolage Grotesque display set tight (-0.04em, 0.96 line-height),
  Instrument Sans body, and IBM Plex Mono for every piece of *data* — hours,
  prices, phone numbers, counts. Data looks like data.
- **Structure:** hairline rules instead of boxes; numbered markers appear ONLY on
  "Your first visit" (a real sequence). Generous whitespace, 1200px grid,
  responsive down to mobile, keyboard-focus rings, reduced-motion respected.
- **Signature:** the *vitals line* — a single calm ECG pulse drawn as the section
  divider (hero + visit). The one memorable flourish; everything else is quiet.

## Section by section (simple English, full information)
- **Navbar** — minimal glass bar: pine cross mark, five links, mono 24×7 phone
  chip, "Book a visit". Mobile menu included.
- **Hero** — "Good care, close to home." + plain-English sub, two CTAs (Book /
  Call), mono info chips (OPD hours · Mon–Sat · departments · Emergency 24×7),
  and a facility card: your building photo with a live "today" data strip (OPD ·
  doctors · emergency). If the photo file is missing it falls back to a composed
  pine panel — never a broken image.
- **Ticker** — slow mono marquee of the eight departments.
- **Numbers** — 4 counted-up stats on hairline rules.
- **What we treat** — the departments as a quiet list-grid with plain blurbs and
  mono "common" lines.
- **Doctors** — the image-forward cards from the previous update (they inherit
  the new palette automatically).
- **How we work** — one record / history on screen / everything in the building.
- **Your first visit** — steps 01–04, register → consult → tests → pharmacy.
- **Rooms & prices** — published rates per room type with GST, floor, beds and
  what's included, plus the line "locked at admission — this page and your bill
  can't disagree."
- **Visit us** — address with a Maps button, big mono hours, phone and email.
- **Questions** — native accordion FAQ ("+" rotates to "×").
- **Emergency band** — the only loud element: "Don't book. Come straight in, or
  call." with the number as a button.
- **Patient portal CTA** and a clean 4-column **footer**.

## What it doesn't touch
All export names and the page composition are unchanged, so nothing else breaks.
The theme is scoped to `.site` — staff portals are unaffected. Doctor cards and
the /doctors page restyle automatically via the shared tokens.

## Photos (optional)
Drop images at `public/images/hero-building.jpg` and
`public/images/doctor-1.jpg … doctor-8.jpg`. Everything has a designed fallback,
so the page looks intentional with zero photos too.

## Files
- `src/app/(public)/site-theme.css` — the new design system.
- `src/components/marketing/vitals.tsx` — the signature divider (new).
- `src/components/marketing/{navbar,hero,ticker,trust,why-choose,care-model,journey,wards,visit,faq,emergency,portal-cta,footer}.tsx` — rewritten.
- `src/components/marketing/{specialized-doctors,doctors-directory,doctor-avatar}.tsx` + `src/lib/data.ts` — included so the bundle stands alone.

## Apply
    rm -rf .next
    npm run dev

Copy figures (stats, prices, phone, address) live in `src/lib/data.ts` — adjust
them there and every section updates.
