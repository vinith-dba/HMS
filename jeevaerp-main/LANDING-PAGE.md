# Landing page — rebuilt

## The actual problem

`public/images/` is **empty**. The old design hung its entire hero, gallery and
doctor cards on photos that don't exist — so the page was rendering grey
placeholder boxes with filenames printed in them. It wasn't under-designed. It
was designed around assets you don't have.

So the new page is built to be **complete with zero photography**. Type, layout,
colour and motion carry it. When the client sends real photos, they slot in and
make it better — but the page never *depends* on them again.

## Design direction — "clinical warmth"

Every hospital site in India is cold blue (`#2e6be6`) on sterile white. Hospitals
are frightening enough already.

| | |
|---|---|
| **Canvas** | Warm bone `#faf7f2` — papery, calm, premium. Never clinical white. |
| **Ink** | `#101a17` — a green-cast black. Softer than corporate blue-black. |
| **Primary** | Deep healing teal `#0b5f55`. In India, green/teal reads as healing. |
| **Accent** | Saffron `#c77d33`, used sparingly. Warmth, a nod to Telangana. |
| **Emergency** | `#c2402f` — used *only* for emergency. Never decorative. |

Craft details: fine paper grain over everything (the thing that stops flat colour
looking cheap), a fixed aurora bloom, hairline rules, numbered section indices
(`01 —— Departments`), tabular numerals, scroll reveals, count-up stats.

Full token set lives in `src/app/(public)/site-theme.css` — one file repalettes
the whole public site.

## What changed, section by section

- **Hero** — no more stock photo with a dark gradient and "Your health, our care."
  Editorial split: a big confident headline on the left, and on the right a **live
  "Today at Jeeva" panel** — OPD open/closed (computed from the actual clock),
  next available doctor, departments open today, and the emergency number. A
  hospital site should answer *"can I be seen today?"*, not show a building.
- **Ticker** — slow marquee of the eight departments. Motion without shouting.
- **Stats** — count-up on scroll, tabular figures.
- **Departments** — asymmetric bento (first card spans two columns), not a row of
  eight identical boxes. Each carries what people actually search for: `ECG · 2D Echo · TMT`.
- **Doctors** — monogram avatars (no photos needed), real OPD hours and fee.
- **How we work** — replaces the old generic blurbs. Three claims you can actually
  stand behind, because the ERP genuinely does them.
- **Journey** — dark band, the four-step visit story.
- **Visit us** — the real address, OPD hours, directions. A stylised locality plate,
  not a fake map screenshot.
- **Emergency band** — deliberately loud, full-width, tap-to-call.
- **Footer** — proper.

## Copy

The old copy ("We deliver world-class healthcare by combining advanced medical
technology…") is filler that nobody reads. Rewritten around one principle: a
person landing here is usually worried, often on a phone, often on behalf of a
parent. They want three answers fast — **can I be seen today, where are you, who
will I see.** Everything else is secondary.

The headline is now **"A hospital that remembers you."** — which is warm, human,
and *true to the product*: the ERP behind it genuinely does hold one ID with the
whole history attached. Good copy finds the truth in the thing you built.

## Notes

- Emergency number is now in the navbar, the hero card, its own band, and the
  footer. It is the one thing a hospital site must never bury.
- The `ఆ` Telugu glyph in the wordmark is a placeholder mark — swap for the real
  logo when the client provides one.
- `prefers-reduced-motion` kills the aurora, the ticker, the pulse and all reveals.
- No migration needed — this pass is UI only.
