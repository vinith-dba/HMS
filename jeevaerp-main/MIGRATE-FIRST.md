# Reception → production

```bash
npx prisma generate
npx prisma migrate dev     # 3 new tables + BACKFILLS every existing admission
npm run dev
```

The migration **backfills**: every admission you already have gets the `BedStay` it has
implicitly had all along, reconstructed from the snapshot on the row. Without that,
discharge would bill them **zero days**.

---

## Five gaps closed. All were go-live blockers.

### 1 · REFUNDS — the top blocker, now real

`REFUNDED` sat in your enum and nothing wrote it. A hospital refunds someone in week one.

**The dangerous part was not the feature — it was the arithmetic.** `amountPaid` was
computed as `payments.reduce(...)` in **five separate places**. Adding refunds without one
shared definition of "what does this patient actually owe" means five chances to get it
wrong, and a silently wrong balance in a hospital is money that quietly disappears.

So there is now exactly **one** definition, in `src/server/billing/calc.ts`, and everything
uses it:

```ts
netPaid(payments, refunds)      // THE definition of "paid"
refundable(payments, refunds)   // the ceiling
assertRefundable(...)           // throws unless this exact refund is legal
```

**The invariant: you cannot refund money you never collected.** Not from a voided bill, not
from a typo. **15 tests** cover it — including the ₹5,000-instead-of-₹500 typo that would
empty a till, and the second refund that would exceed the first.

A refund is **not** a negative payment. It has a reason (required), an authoriser, and it
must never be mistaken for income in a report.

### 2 · BED TRANSFERS — General → ICU without splitting the bill

The only way to move a patient was discharge-and-readmit, which **splits one stay into two
bills** and hands a family two invoices for one illness.

New `BedStay` model: **one row per bed occupied.** Transfer closes the current leg and opens
a new one at the new ward's rate. Discharge then bills **each leg on its own** — 3 days
General, 4 days ICU — which is what actually happened and what they should pay. **The days
already spent keep their old rate**; a mid-stay price revision can never reach back.

The bed claim is atomic, so two clerks can't move two patients into one bed.

### 3 · IPD ADVANCE — the deposit

Every hospital takes one. Without it a family runs up lakhs and walks out. It's applied to
the discharge bill automatically, so the family is asked only for the balance.

And if the advance turns out **larger** than the final bill, the sheet says so in amber:
that difference is **refunded, not kept.**

### 4 · DAY CLOSE — the shift handover

At the end of a shift a receptionist counts the drawer and hands it over. Jeeva couldn't
tell them what the number *should* be, so "reconciling" meant trusting the drawer — which
isn't reconciliation, it's hope.

Now: takings by mode, every refund **named with who authorised it**, everything still owed
from today — and a box to type what you actually counted. It tells you **"It balances"** or
**"the drawer is short by ₹340."**

The rule everyone gets wrong, enforced in the code: **a UPI refund does not come out of the
cash box.** Cash in hand = cash taken − cash *refunded in cash*, and nothing else.

### 5 · PATIENT MERGE — a clinical hazard, not an admin one

Eleven services already refused to show a merged patient. **Nothing could merge them.** The
entire read-side was built and the write-side didn't exist.

Same person registered twice (a walk-in, then an emergency admission by a different clerk)
means **their history is split across two UHIDs** — so a doctor checking allergies sees half
of it.

The patients page now surfaces **possible duplicates** (same phone, different Jeeva IDs),
shows each record's visit and bill count, and folds one into the other: every visit, bill,
lab test, prescription and admission moves across. It **refuses while either is admitted** —
moving someone's identity out from under a live admission is how a ward treats the wrong
file. Nothing is deleted; the old record stays in the audit trail forever with your name on
it.

---

## One correction to my own audit

I told you "edit patient: service exists, no UI." **That was wrong** — the UI was already
there (`setEditing` + `api.patch` on the patient page). My grep was bad, not your code.

## Test it
1. Take a payment → **Refund** → try ₹99,999. It refuses and tells you the ceiling.
2. Admit someone → **Take advance** ₹10,000 → the sheet shows *Still to pay*.
3. **Transfer bed** to ICU → the running bill now shows **two legs**, each at its own rate.
4. Discharge → the invoice has both bed lines, and the advance is already applied.
5. **Day close** → count the drawer. Refund something by UPI; the cash figure doesn't move.
6. Register the same phone twice → **Patients** → the duplicate is flagged.

**39 tests green · typecheck clean · build clean · 84 routes.**
