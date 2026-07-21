import { describe, it, expect } from "vitest";
import { computeInvoiceTotals, InvoiceMathError, r2 } from "@/server/billing/calc";

/**
 * These are the tests worth having.
 *
 * Not "does the button render" — does the hospital charge the right amount and
 * hand the right GST to the government. Every one of these takes microseconds and
 * needs no database. There is no excuse not to run them on every save.
 */

describe("invoice totals — the basics", () => {
  it("a GST-exempt consultation is just the fee", () => {
    // Doctor's consultation: exempt in India. No tax line at all.
    const t = computeInvoiceTotals([
      { description: "Consultation — Dr. Rao", unitPrice: 500, gstRatePct: 0 },
    ]);
    expect(t.subtotal).toBe(500);
    expect(t.cgst).toBe(0);
    expect(t.sgst).toBe(0);
    expect(t.total).toBe(500);
  });

  it("medicine at 5% splits into equal CGST + SGST", () => {
    // ₹200 @ 5% = ₹10 tax, split ₹5 CGST + ₹5 SGST (intra-state Telangana).
    const t = computeInvoiceTotals([
      { description: "Paracetamol 650mg", qty: 10, unitPrice: 20, gstRatePct: 5 },
    ]);
    expect(t.subtotal).toBe(200);
    expect(t.cgst).toBe(5);
    expect(t.sgst).toBe(5);
    expect(t.total).toBe(210);
  });

  it("qty defaults to 1 when the caller omits it", () => {
    const t = computeInvoiceTotals([{ description: "X-Ray", unitPrice: 350 }]);
    expect(t.items[0].qty).toBe(1);
    expect(t.total).toBe(350);
  });
});

describe("a real mixed bill — the one that catches bugs", () => {
  // A single patient: consultation (exempt) + lab test (exempt) + two medicines
  // at DIFFERENT tax rates. If GST were applied as one blended rate, this breaks.
  const bill = [
    { description: "Consultation", unitPrice: 500, gstRatePct: 0 },
    { description: "CBP", unitPrice: 300, gstRatePct: 0 },
    { description: "Azithromycin 500mg", qty: 5, unitPrice: 250, gstRatePct: 5 },
    { description: "Cough Syrup", qty: 1, unitPrice: 100, gstRatePct: 12 },
  ];

  it("taxes each line at its OWN rate, not a blended one", () => {
    const t = computeInvoiceTotals(bill);
    expect(t.subtotal).toBe(2150);           // 500 + 300 + 1250 + 100
    // tax = 1250×5% (62.50) + 100×12% (12) = 74.50 -> 37.25 each side
    expect(t.cgst).toBe(37.25);
    expect(t.sgst).toBe(37.25);
    expect(t.total).toBe(2224.5);
  });

  it("the exempt lines contribute ZERO tax", () => {
    const exemptOnly = computeInvoiceTotals(bill.slice(0, 2));
    expect(exemptOnly.cgst + exemptOnly.sgst).toBe(0);
  });
});

describe("discounts — where money quietly goes missing", () => {
  it("spreads the discount proportionally BEFORE tax", () => {
    // ₹1000 exempt + ₹1000 @5%, minus ₹200 discount.
    // The discount must NOT all land on one line — it's 10% off each.
    const t = computeInvoiceTotals([
      { description: "Room (exempt)", unitPrice: 1000, gstRatePct: 0 },
      { description: "Medicines", unitPrice: 1000, gstRatePct: 5 },
    ], 200);

    expect(t.subtotal).toBe(2000);
    expect(t.taxable).toBe(1800);
    // the taxable line is discounted to 900, so tax = 900 × 5% = 45
    expect(t.cgst).toBe(22.5);
    expect(t.sgst).toBe(22.5);
    expect(t.total).toBe(1845);
  });

  it("REFUSES a discount bigger than the bill", () => {
    // Without this, a typo ("2000" instead of "200") produces a NEGATIVE bill
    // and the hospital owes the patient money.
    expect(() => computeInvoiceTotals(
      [{ description: "Consultation", unitPrice: 500 }],
      2000
    )).toThrow(InvoiceMathError);
  });

  it("a 100% discount is legal and taxes nothing", () => {
    const t = computeInvoiceTotals(
      [{ description: "Charity case", unitPrice: 500, gstRatePct: 5 }],
      500
    );
    expect(t.total).toBe(0);
    expect(t.cgst).toBe(0);
  });
});

describe("rounding — the bug you find six months in", () => {
  it("never leaks floating-point tails into the total", () => {
    // 0.1 + 0.2 === 0.30000000000000004 in JS. A bill must never print that.
    const t = computeInvoiceTotals([
      { description: "a", unitPrice: 0.1 },
      { description: "b", unitPrice: 0.2 },
    ]);
    expect(t.total).toBe(0.3);
  });

  it("keeps totals to exactly 2 decimal places on an awkward rate", () => {
    // 333 × 3 = 999 @ 12% = 119.88 -> 59.94 each side
    const t = computeInvoiceTotals([
      { description: "Syrup", qty: 3, unitPrice: 333, gstRatePct: 12 },
    ]);
    expect(t.cgst).toBe(59.94);
    expect(t.sgst).toBe(59.94);
    expect(t.total).toBe(1118.88);
    // NOTE: `Number.isInteger(total * 100)` is the WRONG assertion — 1118.88 * 100
    // is 111887.99999999999 in JS, so it fails on a correct total. The float bug
    // crept into the test written to catch float bugs. The right invariant is:
    // rounding an already-rounded number changes nothing.
    expect(r2(t.total)).toBe(t.total);
  });

  it("CGST always equals SGST — intra-state invariant", () => {
    // If these ever diverge, the GST return is wrong. Property-style check.
    for (const rate of [0, 5, 12, 18, 28]) {
      for (const price of [1, 7.77, 99.99, 1234.56]) {
        const t = computeInvoiceTotals([{ description: "x", qty: 3, unitPrice: price, gstRatePct: rate }]);
        expect(t.cgst).toBe(t.sgst);
      }
    }
  });
});

describe("guards", () => {
  it("refuses an empty bill", () => {
    expect(() => computeInvoiceTotals([])).toThrow(InvoiceMathError);
  });

  it("passes through fields it doesn't own (batchId, labTestId…)", () => {
    // Regression: the first version of this refactor silently DROPPED batchId,
    // which would have unlinked every pharmacy bill from its stock batch.
    const t = computeInvoiceTotals([
      { description: "Amox", unitPrice: 50, gstRatePct: 5, batchId: "batch_123" },
    ]);
    expect(t.items[0].batchId).toBe("batch_123");
  });
});
