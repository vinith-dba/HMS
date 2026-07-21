# Testing Jeeva

```bash
npm test          # 23 tests, ~800ms, no database. Run this constantly.
npm run test:watch # reruns on save
npm run test:races # needs a THROWAWAY Postgres — see below
```

---

## The answer to "test now or test at the end?"

**As you go. Not at the end.** Three reasons, all specific to this codebase:

**1. Testing at the end doesn't find the bugs — it finds that you can't reach them.**
Your GST math lived *inside* a Prisma `$transaction`. To check whether a bill added
up, you'd have needed a live Postgres. That's why you had zero tests: not laziness,
**friction**. I pulled the math into `src/server/billing/calc.ts` — a pure function
with no database, no clock, no network. It's now 13 tests in 7 milliseconds.

The same thing had happened in the pharmacy scratchpad: the course arithmetic was
buried in a `.tsx` file, so importing it into a test dragged in React. Moved to
`src/lib/pharmacy/course-math.ts`.

**Both of these are design problems that testing exposed.** You only find them by
trying to write the test. Wait until the end and you'll find dozens at once, and
fixing them means touching everything.

**2. You have shipped ~8 feature passes over shared services.** Every pass touched
`billing.service`, `appointments.service`, `ipd.service`. A regression introduced in
pass 3 would surface in pass 8 with nothing to localise it. That's not a testing
problem any more — it's an archaeology problem.

**3. A hospital go-live is a terrible place to discover a rounding bug.**

**The discipline, from here on: every new feature ships with the test for its rule.**
Not 100% coverage. Not a test for every button. One test for the thing that would
actually hurt someone if it broke.

---

## Three kinds of test, in order of how much they'll save you

### 1. Money and rules (`tests/billing-math.test.ts`) — 13 tests, no DB
The GST math. This is the highest-value test in the repo and it costs nothing to run.

```ts
it("taxes each line at its OWN rate, not a blended one", () => {
  const t = computeInvoiceTotals([
    { description: "Consultation", unitPrice: 500, gstRatePct: 0 },   // exempt
    { description: "Azithromycin", qty: 5, unitPrice: 250, gstRatePct: 5 },
    { description: "Cough Syrup", unitPrice: 100, gstRatePct: 12 },
  ]);
  expect(t.cgst).toBe(37.25);
  expect(t.total).toBe(2224.5);
});

it("REFUSES a discount bigger than the bill", () => {
  // Without this, typing "2000" instead of "200" makes a NEGATIVE bill and the
  // hospital owes the patient money.
  expect(() => computeInvoiceTotals([{ description: "X", unitPrice: 500 }], 2000))
    .toThrow(InvoiceMathError);
});
```

**One of these tests failed when I first ran it — and the test was wrong, not the
code.** I'd asserted `Number.isInteger(total * 100)`, but `1118.88 * 100` is
`111887.99999999999` in JavaScript. The float bug crept into the test written to
catch float bugs. That is exactly how much you cannot trust money arithmetic by eye.

### 2. Clinical rules (`tests/pharmacy-scratchpad.test.ts`) — 10 tests, no DB
The antibiotic guard. If a future refactor quietly drops it, **the app still works,
bills still print, and the harm is invisible for years.** Nothing but a test catches
that.

```ts
it("stays SILENT when only non-critical medicines are trimmed", () => {
  const good = [
    line("Azithromycin", 1, 5, 250, /* courseCritical */ true),  // left at full course
    { ...line("Ibuprofen", 2, 5, 60), qty: 6 },                   // 10 -> 6, fine
  ];
  expect(shortedCourseCritical(good)).toHaveLength(0);
});

it("the pad's total EQUALS the invoice's total", () => {
  // If these drift, the pharmacist quotes ₹1449 and the bill prints something
  // else. The patient finds out at the counter.
});
```

Note that test imports the **real** `shortedCourseCritical`. A test that
re-implements the logic it's testing proves nothing.

### 3. Races (`tests/races.test.ts`) — needs Postgres
**The bugs you cannot find by clicking, because clicking is one-at-a-time and two
receptionists are not.**

```bash
createdb jeeva_test
DATABASE_URL="postgresql://localhost/jeeva_test" npx prisma migrate deploy
DATABASE_URL="postgresql://localhost/jeeva_test" npm run test:races
```

Each test fires simultaneous requests at one scarce resource and asserts **exactly
one wins**:

```ts
it("TWO receptionists admitting to the SAME bed: only one patient ends up in it", async () => {
  const claim = () => prisma.bed.updateMany({
    where: { id: bed.id, status: "AVAILABLE" },   // <- the guard
    data:  { status: "OCCUPIED" },
  });
  const results = await Promise.all([claim(), claim(), claim()]);
  expect(results.filter(r => r.count === 1).length).toBe(1);   // three tried, one won
});
```

Also covers: two people booking one slot, two pharmacists selling the last strip
(stock must never go negative), and — importantly — that **a cancelled appointment's
slot really does go back on sale.** If that regresses, every cancellation silently
burns a slot forever and you find out months later when a doctor's calendar is
mysteriously full.

⚠️ Point `DATABASE_URL` at a **throwaway** database. These tests write rows.

---

## What to write for the NEXT feature

When you build refunds (you need to), the test is written before you're done:

```ts
it("a refund cannot exceed what was actually collected", () => {
  expect(() => computeRefund({ paid: 500, refund: 800 })).toThrow();
});
it("a refund leaves an audit trail naming who authorised it", async () => { … });
```

That's the whole discipline. One test per rule that would hurt someone.

## What NOT to test
Don't chase coverage. Don't test that a button renders, that Tailwind applied a
class, or that Prisma can `findMany`. Test **your** rules — the ones a stranger
reading the code could break without noticing.
