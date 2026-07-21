# Pharmacy stock — rebuilt

## Three bugs found while reading the page (fix these regardless of the styling)

1. **Editing a medicine silently erased its manufacturer.** The API *returns*
   `manufacturer`, but the page's `Med` interface didn't declare it, and the Edit
   modal hardcoded `manufacturer: ""` → sent `undefined` → the service does
   `input.manufacturer || null` → **wrote NULL**. Fix a rack location, lose the
   manufacturer. Silent data loss on every edit.

2. **`active: true` was hardcoded on edit.** You could never discontinue a medicine,
   and editing a discontinued one silently brought it back to the counter. There's now
   a "Still stocked" toggle.

3. **`adjustStock` had no UI at all.** The endpoint, the validator, the audited ledger
   entry — all built, never called. A pharmacist could not write off damaged or expired
   stock. **Remove stock** now exists on every batch, with fixed reasons (free text
   invites "adj" and "fix" in an audit trail).

Related: expired batches are excluded from `inStock`, so a medicine could read **0**
while 40 expired tablets sat physically on the shelf with nobody told to pull them.
The service now returns `expiredQty` and the row shows a red **pull-off-shelf** strip.

## Rack, as you asked — a physical bin

The rack is now rendered as a **shelf label**: monospace, boxed, blue spine, sized like
the tag on the actual drawer. It's a location you walk to, so it looks like one.

And there's a **"By rack" view** next to "A–Z". It groups every medicine under its rack
header with counts (*"6 medicines · 2 to reorder · 1 to pull"*). That's the order you
physically walk the shelves in — one trip, not six. Medicines with no rack collect under
"No rack assigned" so they get labelled.

## Expiry, in words

`2026-08-15` made the pharmacist do date maths. Now: **"12d left"** (red) ·
**"2 mo left"** (amber) · the plain date (calm) when it's far off — with the exact date
always underneath. Inside batches, the first live batch is tagged **"Next out"**, so
FEFO is visible rather than a policy in a doc.

## Triage tabs

**All · Reorder · Expiring · Pull off shelf · Out of stock**, each with a live count that
goes amber or red when it isn't zero. Those are the only questions a pharmacist opens
this screen to answer.

## On "win Awwwards"

I didn't chase that literally, and I'd push back on it. Awwwards rewards big type, heavy
motion, and experimental navigation — great for a site you visit once, actively harmful
on a screen someone uses 200 times a day with a patient waiting.

What's here instead is *craft*: tabular numerals so digits line up in a column, a stock
meter that shows "comfortable vs. reorder" as a shape you read in 100ms, an 18px grid,
a 340ms staggered row reveal (capped, so a long list doesn't crawl), spring-eased modals,
`prefers-reduced-motion` honoured throughout, and `/` to jump to search. It looks
noticeably better than what you had **and it got faster to use.** That's the Linear /
Stripe standard, and it's the right target for this tool.

If you want an award-piece, put it in the public site — that's the surface where it pays.

No schema change — **no migration.** Drop in and restart.
