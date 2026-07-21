/**
 * Course arithmetic for the dispense scratchpad — pure, no React, no DOM.
 *
 * Everything the pad can DO to an order lives here, so it can be tested without
 * standing up a browser. The pad is only the hands.
 */

export interface PadLine {
  medicineId: string;
  name: string;
  qty: number;
  mrp: number;
  gst: number;
  inStock: number;
  unit: string;
  /** 0 when there's no prescription behind it (walk-in counter). */
  prescribedQty: number;
  /** Units per day, derived from the dosage pattern. 0 = not day-scalable. */
  perDay: number;
  /** Antibiotic / TB / antimalarial — a partial course is actively harmful. */
  courseCritical: boolean;
  /**
   * LOCKED = "this line does not get trimmed."
   *
   * The old pad warned you not to short an antibiotic and then gave you no way
   * to protect it — the days control moved every line together, so the only way
   * to hit a budget was to short everything, antibiotic included. The advice was
   * un-actionable, which is worse than no advice.
   *
   * Now a locked line is skipped by the days stepper AND by budget-fit, so
   * "keep the antibiotic whole, trim the painkiller" is one button.
   * Course-critical lines start locked. You have to deliberately unlock one.
   */
  locked: boolean;
}

/** "1-0-1" -> 2/day · "1-1-1" -> 3 · "1/2-0-1/2" -> 1 · unparseable -> 0 */
export function perDayFromDosage(dosage: string | null | undefined): number {
  if (!dosage) return 0;
  const m = dosage.match(/(\d+(?:\/\d+)?)\s*[-–]\s*(\d+(?:\/\d+)?)\s*[-–]\s*(\d+(?:\/\d+)?)/);
  if (!m) return 0;
  const val = (s: string) => {
    if (s.includes("/")) { const [a, b] = s.split("/").map(Number); return b ? a / b : 0; }
    return Number(s);
  };
  const t = val(m[1]) + val(m[2]) + val(m[3]);
  return t > 0 ? t : 0;
}

/**
 * Exactly the invoice's arithmetic. If this drifts from `computeInvoiceTotals`,
 * the pad quotes one number and the bill prints another — and the patient finds
 * out at the counter. A test pins the two together.
 */
export function billTotal(lines: PadLine[], discount: number): number {
  const subtotal = lines.reduce((s, l) => s + l.qty * l.mrp, 0);
  const disc = Math.min(discount, subtotal);
  const gst = lines.reduce((s, l) => {
    const after = l.qty * l.mrp * (subtotal > 0 ? 1 - disc / subtotal : 1);
    return s + (after * l.gst) / 100;
  }, 0);
  return subtotal - disc + gst;
}

/** Every course-critical medicine being given in less than the prescribed amount. */
export function shortedCourseCritical(lines: PadLine[]): PadLine[] {
  return lines.filter((l) => l.courseCritical && l.prescribedQty > 0 && l.qty < l.prescribedQty);
}

/** Any line at all being short-supplied. */
export function shorted(lines: PadLine[]): PadLine[] {
  return lines.filter((l) => l.prescribedQty > 0 && l.qty < l.prescribedQty);
}

/** A line the shelf can't fully honour, whatever the patient wants. */
export function stockCapped(lines: PadLine[]): PadLine[] {
  return lines.filter((l) => l.prescribedQty > 0 && l.inStock < l.prescribedQty);
}

/** The course length the doctor wrote, in days (0 if nothing is day-scalable). */
export function prescribedDays(lines: PadLine[]): number {
  const d = lines
    .filter((l) => l.perDay > 0 && l.prescribedQty > 0)
    .map((l) => Math.round(l.prescribedQty / l.perDay))
    .filter((n) => n > 0);
  return d.length ? Math.max(...d) : 0;
}

/** The course length actually being handed over. */
export function givingDays(lines: PadLine[]): number {
  const d = lines.filter((l) => l.perDay > 0).map((l) => Math.round(l.qty / l.perDay)).filter((n) => n > 0);
  return d.length ? Math.max(...d) : 0;
}

/**
 * Set the course to N days — but ONLY on unlocked, day-scalable lines.
 * Locked lines (antibiotics by default) keep whatever they were given.
 * Everything is clamped to what's physically on the shelf.
 */
export function applyDays(lines: PadLine[], days: number): PadLine[] {
  if (days < 1) return lines;
  return lines.map((l) => {
    if (l.locked || l.perDay <= 0) return l;
    const want = Math.ceil(l.perDay * days);
    return { ...l, qty: Math.max(1, Math.min(want, l.inStock)) };
  });
}

export interface FitResult {
  /** Unchanged when `impossible` — we don't quietly destroy the pharmacist's work. */
  lines: PadLine[];
  /** Days landed on, when the trim was day-based. */
  days: number | null;
  /** Total of `lines`. */
  total: number;
  /**
   * The cheapest order we can build while respecting every lock — i.e. the
   * shortest course with the antibiotics still whole. When `impossible`, this is
   * the number the pharmacist needs: "even the smallest course is ₹1,533."
   */
  floor: number;
  /** True when even `floor` costs more than the budget. */
  impossible: boolean;
}

/**
 * Work backwards from money: what's the longest course that fits?
 *
 * Locked lines are paid for FIRST and never trimmed — so budget-fit with a locked
 * antibiotic means "the antibiotic is whole; spend what's left on everything else."
 * That is exactly the outcome the antibiotic warning asks for, and it is now one
 * button instead of a paragraph of advice.
 *
 * Falls back to proportional quantity trimming when nothing is day-scalable (the
 * walk-in counter, where there's no course to reason about).
 */
export function fitToBudget(lines: PadLine[], budget: number, discount = 0): FitResult {
  const flexible = lines.filter((l) => !l.locked && l.perDay > 0);
  const total = billTotal(lines, discount);

  // ── THE FLOOR ──
  // The cheapest order we can actually construct without breaking a lock.
  //
  // This MUST be computed the same way the search below trims, or the two
  // disagree: an earlier version used `qty: 1` per unlocked line, but a 1-0-1
  // drug can't go below 2/day via the days control. The pre-check therefore
  // called a budget affordable and the search then failed to find any fit.
  const floorLines = flexible.length > 0
    ? applyDays(lines, 1)                                              // 1-day course
    : lines.map((l) => (l.locked ? l : { ...l, qty: 1 }));             // walk-in: 1 unit
  const floor = billTotal(floorLines, discount);

  if (floor > budget) {
    // Don't silently short a locked course to force the number. Report the floor
    // honestly and let the pharmacist decide: unlock, or ask for more money.
    return { lines, days: null, total, floor, impossible: true };
  }

  // No days to shorten (walk-in counter): scale unlocked quantities proportionally.
  if (flexible.length === 0) {
    for (let pct = 100; pct >= 1; pct--) {
      const trial = lines.map((l) =>
        l.locked ? l : { ...l, qty: Math.max(1, Math.floor((l.qty * pct) / 100)) }
      );
      const t = billTotal(trial, discount);
      if (t <= budget) return { lines: trial, days: null, total: t, floor, impossible: false };
    }
    return { lines, days: null, total, floor, impossible: true };
  }

  const ceiling = Math.max(prescribedDays(lines), givingDays(lines), 1);
  for (let d = ceiling; d >= 1; d--) {
    const trial = applyDays(lines, d);
    const t = billTotal(trial, discount);
    if (t <= budget) return { lines: trial, days: d, total: t, floor, impossible: false };
  }
  return { lines, days: null, total, floor, impossible: true };
}

/** Put everything back to exactly what the doctor wrote (clamped to stock). */
export function resetToPrescribed(lines: PadLine[]): PadLine[] {
  return lines.map((l) => ({
    ...l,
    qty: l.prescribedQty > 0 ? Math.max(1, Math.min(l.prescribedQty, l.inStock)) : l.qty,
  }));
}
