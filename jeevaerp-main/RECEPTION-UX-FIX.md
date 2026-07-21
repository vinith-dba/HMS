# Reception portal — UX flow fix

You said reception staff weren't understanding the portal. I audited every reception
page like a design review before touching styles, and the problem was NOT visual —
it was structural. Five findings, all fixed.

---

## Finding 1 — Half the links were literally broken (bug, not UX)

The dashboard had 7 links like `href="/reception/register"`, and the sidebar nav built
`/${portal}/...` links too. On the reception **subdomain**, middleware prefixes every
path with `/reception` — so those links became `/reception/reception/register` → **404**.

The receptionist wasn't "not understanding". They were clicking things that went nowhere.

**Fixed twice:**
- All in-portal links are now subdomain-relative (`/register`, `/book`, `/ipd`).
- **Middleware now self-heals** the doubled form: typing
  `reception.localhost:3000/reception/register` (your own recurring habit) now
  308-redirects to `/register` instead of 404ing. The URL bar corrects itself, which
  quietly teaches the short form.

## Finding 2 — The desk's #1 sequence was chopped in half

Real sequence at any front desk: **new patient walks in → register → book → collect fee.**
The portal made you register, read the new ID off the screen, walk to Book, and *search
for the person you created 10 seconds ago*.

**Fixed:** the register success screen now leads with
**"Book appointment for {name} →"** — one tap, patient already loaded in the booking
form (with a "carried over" banner so it's obvious). Secondary: "Open patient file",
"Register another".

## Finding 3 — Every page started with "search the patient" (again)

Book, Prescriptions, and Admissions each began from zero. One patient's OPD journey =
searching the same human 3–4 times.

**Fixed:** all three now accept **`?patient=JMH2026OP00001`** and preload the person.
Nobody types that — every button below produces it:

| From | Button | Lands on |
|---|---|---|
| Register success | Book appointment → | `/book` (patient loaded) |
| Book success | Upload Rx (after consult) | `/prescriptions` (patient loaded) |
| Today queue, COMPLETED row | **Upload Rx →** | `/prescriptions` (patient loaded) |
| Patient file | Book / Upload Rx / Admit | each, patient loaded |

## Finding 4 — The patient file was a dead end

You could *look* at a patient but not *do* anything from there.

**Fixed:** the patient file header now carries the action bar —
**Book appointment · Upload Rx · Admit** — next to Generate bill. Find the person once,
launch anything.

## Finding 5 — The Today queue was a poster, not a tool

Rows showed status and nothing else. But a row turning **COMPLETED** is *exactly* the
moment the patient walks back to the desk holding the doctor's paper.

**Fixed:**
- Any row → tap opens the patient's file.
- **COMPLETED rows grow an "Upload Rx →" chip** — patient preloaded, pick consult,
  drop the scan, send to pharmacy. The queue subtitle now says this out loud.
- Quick actions gained **"Admit a patient"** (Admissions was missing entirely) and every
  sub-line now says what the action *does* ("Books and bills in one step") instead of
  restating its name.
- Nav: "Upload Rx" → **"Prescriptions"** (front-desk staff aren't clinicians; Rx is
  doctor shorthand).

---

## The flow as the receptionist now experiences it

```
                     ┌──────────────── TODAY (home) ────────────────┐
                     │  queue row tap → patient file                │
                     │  COMPLETED row → "Upload Rx →" (preloaded)   │
                     └──────────────────────────────────────────────┘
NEW WALK-IN:  Register ──success──▶ "Book for {name} →" ──▶ Book (preloaded)
                                                             │ bill-now ON
RETURNING:    Find patient ─▶ Patient file ─▶ Book / Upload Rx / Admit (all preloaded)
AFTER CONSULT: Today queue COMPLETED chip ─▶ Upload scan + type medicines ─▶ send
ADMISSION:    Patient file "Admit" ─▶ bed board banner ─▶ tap free bed
                                       (patient already in the modal)
```

The rule behind every change: **find the patient once, then everything flows from
them.** Feature-first navigation ("which page do I open?") became patient-first
("who is in front of me?") — which is the only mental model a front desk has.

## What I did NOT do

No visual re-theme. The surfaces, colors, and typography were already consistent; the
confusion was broken links and severed flows. Restyling would have repainted a maze.
If you want a visual pass (density, type scale, button weight) after the staff have
used *this* for a few days, do it then — with their complaints, not our guesses.

## Files changed
`src/middleware.ts` · `src/components/portal/shell/portal-shell.tsx` ·
`src/lib/portal/nav.ts` · reception: `page.tsx`, `register`, `book`, `prescriptions`,
`ipd`, `patients/[displayId]`.

No schema change — **no migration needed.** Drop in and restart.
