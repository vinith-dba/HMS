# Doctor cards (landing + directory) + doctor info in booking

> **Run a migration** for the booking part (adds doctor profile columns):
> `npx prisma migrate dev --name doctor_profile_fields`  (or `npx prisma db push`).

## Landing + "Our doctors" — styled cards (no migration)
The static roster now carries **qualification (degree), years of experience, and
age**, and the cards were rebuilt to be image-forward and minimal:
- A **photo header** per doctor with a graceful **initials fallback** if the image
  file is missing — so it always looks intentional (drop real photos into
  `public/images/doctor-1.jpg … doctor-8.jpg` and they appear automatically).
- Name, **specialisation**, **degree**, an **experience** badge, department + age
  chips, OPD hours and fee — one clean card, one clear "Book appointment" action.
- Applied to the landing's Doctors section and the `/doctors` directory (with its
  department filter + search).

## Booking flow — doctor information on selection
When a doctor is picked on the reception booking screen, the info card now shows
**photo/avatar, name, specialisation, degree, years of experience, age,
languages, fee, and a short bio** — instead of just name + fee. Fields that aren't
filled in simply don't render, so it stays tidy.

The DB `Doctor` model gained `qualification`, `experienceYears`, `age`,
`languages`, `photoUrl`, `bio` (all optional). Existing doctors show the core
details immediately; set the new fields (seed or a doctor edit) to light up the
rest.

## Files
- `prisma/schema.prisma` — Doctor profile fields.
- `src/server/services/appointments.service.ts` — `listDoctors` returns them.
- `src/lib/data.ts` — enriched static roster.
- `src/components/marketing/doctor-avatar.tsx` — image + initials-fallback (new).
- `src/components/marketing/specialized-doctors.tsx` — landing cards.
- `src/components/marketing/doctors-directory.tsx` — `/doctors` cards.
- `src/app/reception/book/page.tsx` — enriched doctor info card.

## Apply
    npx prisma migrate dev --name doctor_profile_fields   # or: npx prisma db push
    rm -rf .next
    npm run dev
