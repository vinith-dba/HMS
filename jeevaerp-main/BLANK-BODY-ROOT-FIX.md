# The real fix for the blank pages (data was never the problem)

Your data and backend were fine the whole time. The blank body on **Day close**,
**Admin overview** and **HR & staff** all had one shared cause — the reveal
animation, not the data.

## What was happening

Every portal page wraps its content in `PortalScroll`. Content marked `data-rise`
starts at `opacity: 0` and is faded in when `PortalScroll` reveals it. But
`PortalScroll` scanned for those elements **once, on mount** — and at that instant
the page is still showing its loading spinner, so the real content isn't in the DOM
yet. When the data arrived and the body rendered, those elements had never been
picked up, so they stayed invisible.

That's why you always saw the **header** (it's present at mount) but a **blank
body** (it appears a moment later, after the fetch). The header proved the page and
backend were working; the body was simply stuck at `opacity: 0`.

## The fix

`src/components/portal/portal-scroll.tsx` now also watches for elements that mount
*after* the initial scan (via a `MutationObserver`) and reveals them immediately.
So content that renders once data loads can never get stuck hidden again — with the
fade-in still intact.

This one change fixes **all three** pages at once (Day close, Admin overview, HR),
plus any other data-driven page that had the same latent issue. No backend change,
no data change, no migration.

## Apply

Unzip at the project root, then clean-restart:

    # stop the dev server (Ctrl + C), then:
    rm -rf .next
    npm run dev

After this, open Admin → Overview and Admin → HR & staff: you should now see the
KPIs, charts, collections and staff directory populate (with real numbers, or ₹0 /
empty states if the database is empty — which is correct, not an error).

If a red "1 error" badge is still shown after this, it's a separate dev-console
warning rather than the blank-body cause — click it once and send me the message
and I'll clear that too.

## File

- `src/components/portal/portal-scroll.tsx`
