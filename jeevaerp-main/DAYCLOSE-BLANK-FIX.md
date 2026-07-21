# Day close: blank page + "1 error" — fix

You're seeing the header but a blank body and a red "1 error" badge (Next.js). A
blank body is NOT what an empty dataset looks like (that would show ₹0.00 cards) —
it means the page hit an error it couldn't render past. Two causes, both handled
here.

## 1. Apply these files, then FULLY restart with a clean cache

Overwriting files while `npm run dev` is running very often leaves a stale build
that shows exactly this (blank + "1 error"). A hot-reload isn't enough — do a full
restart and clear the Next cache:

    # stop the dev server first (Ctrl + C in its terminal), then:
    rm -rf .next
    npm run dev

(Windows PowerShell: `Remove-Item -Recurse -Force .next` then `npm run dev`.)

## 2. The page is now crash-proof

`day-close/page.tsx` was hardened so it can never blank out:
- If the API errors, it shows a clear **"Couldn't load the day"** card with the
  real message and a **Try again** button — instead of a blank body.
- Every field is guarded, so a malformed/partial response can't throw during render.
- A successful retry clears a previous error.

The two server fixes from before are included again so this bundle is
self-contained: the `fullName` → `name` corrections in `reports.service.ts`
(day-close refund author) and `ipd.service.ts` (admission-charge author).

## If it's STILL blank after the restart

Then it's a specific build/runtime error the overlay is naming. Click the red
**"1 error"** badge (bottom-left) — it opens the exact message + file/line — and
send me that text (or paste what's printed in the `npm run dev` terminal). That
tells me precisely what to fix. A screenshot of the opened overlay is perfect.

## Files

- `src/app/reception/day-close/page.tsx` — hardened error/empty handling.
- `src/server/services/reports.service.ts` — refund author `fullName` → `name`.
- `src/server/services/ipd.service.ts` — charge author `fullName` → `name`.
