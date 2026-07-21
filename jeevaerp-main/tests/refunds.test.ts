import { describe, it, expect } from "vitest";
import {
  netPaid, balanceDue, refundable, assertRefundable,
  invoiceStatusFrom, RefundError,
} from "@/server/billing/calc";

const p = (...amts: number[]) => amts.map((amount) => ({ amount }));

/**
 * Money leaving a hospital. Every one of these is a way a real till gets emptied.
 */

describe("THE INVARIANT — you cannot refund what you never collected", () => {
  it("refuses a refund on a bill nobody paid", () => {
    expect(() => assertRefundable(500, "changed mind", [], [])).toThrow(RefundError);
  });

  it("refuses to refund MORE than was collected", () => {
    // The typo that empties a till: ₹5000 instead of ₹500.
    expect(() => assertRefundable(5000, "cancelled visit", p(500))).toThrow(/only ₹500/i);
  });

  it("refuses a SECOND refund that would exceed the first", () => {
    // ₹500 collected, ₹400 already returned. Only ₹100 is left to give.
    expect(() => assertRefundable(200, "again", p(500), p(400))).toThrow(RefundError);
    expect(() => assertRefundable(100, "the rest", p(500), p(400))).not.toThrow();
  });

  it("refuses a refund with no reason", () => {
    expect(() => assertRefundable(500, "", p(500))).toThrow(/why/i);
    expect(() => assertRefundable(500, "  ", p(500))).toThrow(/why/i);
  });

  it("refuses ₹0 and negative refunds", () => {
    expect(() => assertRefundable(0, "nothing", p(500))).toThrow(RefundError);
    // a negative refund is a payment in disguise — it would ADD to the till
    expect(() => assertRefundable(-500, "sneaky", p(500))).toThrow(RefundError);
  });

  it("allows the exact full amount", () => {
    expect(() => assertRefundable(500, "visit cancelled", p(500))).not.toThrow();
  });
});

describe("what the hospital is actually holding", () => {
  it("nets refunds against payments", () => {
    expect(netPaid(p(1000), p(300))).toBe(700);
  });

  it("a fully refunded bill leaves the hospital holding nothing", () => {
    expect(netPaid(p(500, 500), p(1000))).toBe(0);
    expect(refundable(p(500, 500), p(1000))).toBe(0);
  });

  it("balance due never goes NEGATIVE", () => {
    // Overpaid ₹200. That's a refund owed — NOT a negative debt that would
    // quietly subtract from the day's takings.
    expect(balanceDue(500, p(700))).toBe(0);
  });

  it("a partial refund reopens the balance", () => {
    // Paid in full, then ₹300 handed back: the patient owes ₹300 again.
    expect(balanceDue(1000, p(1000), p(300))).toBe(300);
  });
});

describe("status is DERIVED, never guessed", () => {
  it("PAID -> refund everything -> REFUNDED", () => {
    expect(invoiceStatusFrom(1000, p(1000), [])).toBe("PAID");
    expect(invoiceStatusFrom(1000, p(1000), p(1000))).toBe("REFUNDED");
  });

  it("a PARTIAL refund is PARTIALLY_PAID, not REFUNDED", () => {
    // The bug this prevents: marking a bill REFUNDED when ₹700 is still held.
    expect(invoiceStatusFrom(1000, p(1000), p(300))).toBe("PARTIALLY_PAID");
  });

  it("cancelled beats everything", () => {
    expect(invoiceStatusFrom(1000, p(1000), [], true)).toBe("CANCELLED");
  });

  it("an unpaid bill is PENDING, not REFUNDED", () => {
    expect(invoiceStatusFrom(1000, [], [])).toBe("PENDING");
  });
});

describe("rounding", () => {
  it("no floating-point tail survives a refund", () => {
    expect(netPaid(p(0.1, 0.2), p(0.1))).toBe(0.2);
  });
});
