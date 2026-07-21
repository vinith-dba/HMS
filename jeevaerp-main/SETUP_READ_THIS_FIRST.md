# ⚠️ READ THIS — how the Postgres tables get created

You keep seeing "table does not exist" or empty Postgres. Here's why and the fix.

## There is no "API that creates tables"

Tables are created by **Prisma migrations**, not by an API route. Every time the
schema changes, ONE command builds/updates the tables:

```
npx prisma migrate dev
```

If you skip it, the code expects columns the database doesn't have → errors.

## Do this now (in order), from the project folder

```powershell
# 1. Make sure .env has a WORKING DATABASE_URL (see below)
# 2. Generate the client, build ALL tables, load demo data:
npx prisma generate
npx prisma migrate dev --name production-schema
npx prisma db seed

# 3. Run
npm run dev
```

The schema changed a lot this pass (rich Patient, staff usernames, per-visit
referral, price snapshot). If `migrate dev` complains about drift, just reset —
this WIPES dev data and rebuilds everything cleanly:

```powershell
npx prisma migrate reset
```

Say "yes" when it asks. When it finishes you'll have every table + seed data.

## Verify the tables exist

```powershell
npx prisma studio
```

Opens a browser DB viewer. You should see Patient, User, Appointment, DoctorSlot,
Otp, and ~15 more tables. If they're there, you're done.

## DATABASE_URL reminder

```
DATABASE_URL="postgresql://postgres:YOUR_PG_PASSWORD@localhost:5432/jeeva_erp?schema=public"
```
`YOUR_PG_PASSWORD` = the PostgreSQL superuser password from install (NOT Windows).
Special chars must be encoded (@→%40, #→%23). Test with `npx prisma db pull`.

---

# How to log in after seeding

## Staff — username + OTP (or password)
Usernames are **role.name**. OTP codes print to the **server console** in dev
(no email provider needed). Password fallback: `Password123!`

| Portal (dev URL) | Username |
|---|---|
| `reception.localhost:3000/login` | `reception.ravi` |
| `admin.localhost:3000/login` | `admin.priya` |
| `labs.localhost:3000/login` | `labs.sana` |
| `pharmacy.localhost:3000/login` | `pharmacy.kiran` |
| `doctor.localhost:3000/login` | `doctor.rao` |

Staff OTP works ONLY if the username exists in the DB (seeded above). Enter the
username → a 6-digit code appears in your terminal → type it in.

## Patient — Jeeva ID + OTP
`localhost:3000/portal/login` → ID `JMH2026OP00001` → code prints to console.

---

# What's new this pass

- **Production Patient schema** — 40+ fields (name split, demographics, full
  contact, personal, referral, flags, merge, audit). No misleading referral FK:
  referral is a **snapshot string** in two places (registration + per-visit).
- **Full registration** — every field, in clean sections, saved to Postgres.
- **Booking by search OR recent patient** → doctor → slot, with a **per-visit
  referral** field and a **fee snapshot** (price frozen at booking time).
- **Referral is admin-only** — reception/doctor never see it in responses. It
  shows in the **admin appointment history** table (`admin.localhost:3000/appointments`):
  OP, patient, doctor, price, date, time, status, and referred-by.
- **Staff OTP login** by username (role.name), code to registered email.
- **Polymorphic OTP** — one OTP table serves patients and staff.
