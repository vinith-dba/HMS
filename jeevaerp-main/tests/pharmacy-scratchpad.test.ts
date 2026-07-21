import { describe, it, expect } from "vitest";
import {
  perDayFromDosage, billTotal, shortedCourseCritical,
  applyDays, fitToBudget, resetToPrescribed, type PadLine,
} from "@/lib/pharmacy/course-math";

const line = (
  name: string, perDay: number, days: number, mrp: number,
  courseCritical = false, inStock = 999
): PadLine => ({
  medicineId: name, name, unit: "tablet",
  qty: perDay * days, mrp, gst: 5, inStock,
  prescribedQty: perDay * days, perDay, courseCritical,
  locked: courseCritical,            // antibiotics start protected
});

describe("dosage parsing", () => {
  it("reads 1-0-1 and friends", () => {
    expect(perDayFromDosage("1-0-1")).toBe(2);
    expect(perDayFromDosage("1-1-1")).toBe(3);
    expect(perDayFromDosage("1/2-0-1/2")).toBe(1);
  });
  it("ignores trailing Telugu/English timing notes", () => {
    expect(perDayFromDosage("1-0-0 భోజనం తర్వాత")).toBe(1);
  });
  it("returns 0 rather than GUESSING", () => {
    // A wrong guess silently changes how much medicine a patient gets.
    expect(perDayFromDosage("twice daily")).toBe(0);
    expect(perDayFromDosage(null)).toBe(0);
  });
});

describe("THE LOCK — the fix for advice the old pad couldn't act on", () => {
  const rx = [
    line("Azithromycin 500", 1, 5, 250, true),   // antibiotic -> starts LOCKED
    line("Ibuprofen 400", 2, 5, 60),
    line("Pantoprazole 40", 1, 5, 90),
  ];

  it("the days stepper SKIPS locked lines", () => {
    const cut = applyDays(rx, 3);
    const abx = cut.find((l) => l.name === "Azithromycin 500")!;
    const ibu = cut.find((l) => l.name === "Ibuprofen 400")!;
    expect(abx.qty).toBe(5);   // untouched — full course
    expect(ibu.qty).toBe(6);   // 2/day × 3 days
  });

  it("budget-fit pays for the antibiotic FIRST and never trims it", () => {
    // This is the exact scenario the old pad advised and could not perform.
    // The antibiotic alone is 5 × ₹250 = ₹1250. At ₹2000 there is room to keep it
    // whole and shorten everything else — which is the whole point of the lock.
    const fit = fitToBudget(rx, 2000, 0);
    const abx = fit.lines.find((l) => l.name === "Azithromycin 500")!;
    expect(fit.impossible).toBe(false);
    expect(abx.qty).toBe(abx.prescribedQty);           // whole course survives
    expect(shortedCourseCritical(fit.lines)).toHaveLength(0);
    expect(fit.total).toBeLessThanOrEqual(2000);
    expect(fit.days).toBe(3);                          // others cut 5d -> 3d
  });

  it("an UNLOCKED antibiotic can be trimmed — but the guard then fires", () => {
    const unlocked = rx.map((l) => ({ ...l, locked: false }));
    const cut = applyDays(unlocked, 2);
    expect(shortedCourseCritical(cut).map((l) => l.name)).toEqual(["Azithromycin 500"]);
  });

  it("says IMPOSSIBLE and reports the FLOOR rather than shorting a locked course", () => {
    // ₹300 can't even cover the locked antibiotic (5 × ₹250 + GST).
    const fit = fitToBudget(rx, 300, 0);
    expect(fit.impossible).toBe(true);
    // it did NOT silently cut the antibiotic to force the number
    expect(fit.lines.find((l) => l.name === "Azithromycin 500")!.qty).toBe(5);
    // and it tells the pharmacist the real minimum, so they can say it out loud
    expect(fit.floor).toBeGreaterThan(300);
    expect(fit.floor).toBeLessThan(fit.total);
  });

  it("the floor is reachable — the pre-check and the search agree", () => {
    // Regression: the floor was once computed with qty:1 per line, but a 1-0-1
    // drug cannot go below 2/day. The check said "affordable", the search then
    // found no fit, and the pad claimed a budget worked when it did not.
    const fit = fitToBudget(rx, 1600, 0);
    if (!fit.impossible) expect(fit.total).toBeLessThanOrEqual(1600);
    expect(fit.floor).toBeCloseTo(billTotal(applyDays(rx, 1), 0), 2);
  });
});

describe("stock is a hard ceiling", () => {
  it("never dispenses more than is on the shelf", () => {
    const short = [line("Ibuprofen 400", 2, 5, 60, false, 4)];   // only 4 left
    const cut = applyDays(short, 5);                              // wants 10
    expect(cut[0].qty).toBe(4);
  });
});

describe("reset", () => {
  it("puts everything back to what the doctor wrote", () => {
    const trimmed = applyDays([line("Ibuprofen 400", 2, 5, 60)], 2);
    expect(trimmed[0].qty).toBe(4);
    expect(resetToPrescribed(trimmed)[0].qty).toBe(10);
  });
});

describe("the pad's total must EQUAL the invoice's total", () => {
  it("or the pharmacist quotes one number and the bill prints another", async () => {
    const lines = applyDays([line("Ibuprofen 400", 2, 5, 60), line("Pantoprazole 40", 1, 5, 90)], 3);
    const pad = billTotal(lines, 0);
    const { computeInvoiceTotals } = await import("@/server/billing/calc");
    const invoice = computeInvoiceTotals(
      lines.map((l) => ({ description: l.name, qty: l.qty, unitPrice: l.mrp, gstRatePct: l.gst })), 0
    ).total;
    expect(pad).toBeCloseTo(invoice, 2);
  });
});
