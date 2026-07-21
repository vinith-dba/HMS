# Jeeva ERP — new design system

## ✅ Pure UI. No migration.
```powershell
npm install
npm run dev
```
No schema change, so **no `prisma migrate` needed this time.**

---

## The palette

| Token | Value | Used for |
|---|---|---|
| `--p-bg` | `#F5F8FD` | canvas — cool near-white, blue cast (never warm grey) |
| `--p-surface` | `#FFFFFF` | cards |
| `--p-ink` | `#091A34` | headings — near-black with a blue cast |
| `--p-border` | `#E4EAF4` | hairline |
| **`--p-blue`** | **`#0B5CFF`** | **electric blue — primary actions, active nav, focus** |
| **`--p-cyan`** | **`#00BCC7`** | **teal — health signals, KPIs, positive states** |

**Blue = what you click. Teal = what's healthy.** That split is the whole logic
of the palette, and it holds everywhere.

## How the retheme works (why it didn't break 140 files)

The app already referenced `--p-teal` as "the primary accent" across ~140 files.
Instead of renaming everything, the new semantic tokens are the source of truth
and the **legacy names alias onto them**:

```css
--p-teal: var(--p-blue);       /* primary accent is now electric blue */
--p-teal-deep: var(--p-blue-deep);
--p-teal-soft: var(--p-blue-soft);
```

One file changes the palette; it cascades to every portal. Repalette the whole
ERP again by editing ~10 lines.

---

## What changed visually

**Sidebar** — was dark navy, now **frosted glass, light**. Active item gets a
blue tint, blue text, and a 3px accent bar that slides in. Sticky, full height.
A user card sits at the bottom with a blue→teal gradient avatar.

**Topbar** — **sticky glass**. Content blurs underneath as you scroll
(`backdrop-filter: blur(18px) saturate(1.5)`), with a light-catching inner top
edge — the detail that makes glass read as real glass rather than grey.

**Signature: the aurora.** A fixed radial bloom of blue and teal light behind
the canvas. It gives flat white depth without adding noise, and never scrolls
away. This is the one place the design spends its boldness.

**Cards** — hairline border + a whisper of elevation. Interactive cards lift 1px
on hover and pick up a blue edge with a soft glow ring.

**KPI tiles** — teal icon chip, count-up number in tabular figures, and a teal
corner bloom that fades in on hover.

**Buttons** — electric blue with a top sheen and a glow that intensifies on
hover; presses down 1px.

**Pills** — now ring-bordered (`ring-1 ring-inset`) instead of flat fills, so
status reads at a glance without shouting.

**Login screens** (all 5 portals) — glass card floating on the aurora.

## Accessibility kept
- Visible keyboard focus everywhere (`outline: 2px solid var(--p-blue)`)
- `prefers-reduced-motion` disables the aurora shifts, reveals, and hover lifts
- Tabular numerals on every figure so columns of money align
