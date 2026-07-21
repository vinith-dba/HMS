/**
 * INVOICE MATH — deliberately pure.
 *
 * This used to live inside `createInvoice`'s Prisma `$transaction`. That meant you
 * could not check whether a bill added up without standing up a Postgres database,
 * which is a very good way to end up with a hospital billing system that has no
 * tests at all.
 *
 * Nothing in here touches the database, the clock, or the network. Given the same
 * lines it returns the same numbers, every time, in about a microsecond — so it can
 * be tested to death.
 *
 * The arithmetic is unchanged from the original. Do not "tidy" it: the rounding
 * order is load-bearing (see roundingIsPerLine below).
 */

export interface CalcLine {
  description: string;
  qty?: number;
  unitPrice: number;
  /** 0 for exempt (consultation, diagnostics, most room rent). */
  gstRatePct?: number;
}

/** Whatever extra fields the caller's line carried (batchId, labTestId, hsnSac…)
 *  travel through untouched — the calc only ADDS qty/gstRatePct/amount. */
export type CalcItem<L extends CalcLine = CalcLine> = L & {
  qty: number;
  gstRatePct: number;
  /** qty × unitPrice, before any discount. */
  amount: number;
};

export interface InvoiceTotals<L extends CalcLine = CalcLine> {
  items: CalcItem<L>[];
  subtotal: number;
  discount: number;
  /** subtotal − discount. The base GST is charged on. */
  taxable: number;
  cgst: number;
  sgst: number;
  total: number;
}

/** Money is rounded to paise at every step — never carried as a float tail. */
export const r2 = (n: number) => Math.round(n * 100) / 100;

export class InvoiceMathError extends Error {}

/**
 * Discount is spread across lines *proportionally, before tax* — not slapped on
 * the end. This matters: a bill with an exempt consultation and a taxable medicine
 * must not have the whole discount silently eaten by the taxable line, because that
 * would change the GST owed to the government.
 *
 * CGST and SGST are each half the line tax (intra-state, Telangana 36). Inter-state
 * IGST is NOT handled — Jeeva bills locally. If that ever changes, this is the one
 * function to touch.
 */
export function computeInvoiceTotals<L extends CalcLine>(
  lines: L[],
  discountAmount = 0
): InvoiceTotals<L> {
  if (!lines.length) throw new InvoiceMathError("Add at least one item to the bill");

  let subtotal = 0;
  const items: CalcItem<L>[] = lines.map((l) => {
    const qty = l.qty && l.qty > 0 ? l.qty : 1;
    const amount = r2(qty * l.unitPrice);
    subtotal = r2(subtotal + amount);
    return { ...l, qty, gstRatePct: l.gstRatePct ?? 0, amount };
  });

  const discount = r2(discountAmount ?? 0);
  if (discount > subtotal) throw new InvoiceMathError("Discount can't exceed the bill amount");

  const discountRatio = subtotal > 0 ? discount / subtotal : 0;

  let taxable = 0;
  let cgst = 0;
  let sgst = 0;
  for (const it of items) {
    const lineAfterDiscount = r2(it.amount * (1 - discountRatio));
    taxable = r2(taxable + lineAfterDiscount);
    const lineTax = r2((lineAfterDiscount * it.gstRatePct) / 100);
    cgst = r2(cgst + lineTax / 2);
    sgst = r2(sgst + lineTax / 2);
  }

  const total = r2(taxable + cgst + sgst);
  return { items, subtotal, discount, taxable, cgst, sgst, total };
}

/* ════════════════════════════════════════════════════════════════════════════
   REFUNDS
   ════════════════════════════════════════════════════════════════════════════

   `amountPaid` was computed as `payments.reduce(...)` in FIVE separate places.
   Introducing refunds without a single shared definition of "what does this
   patient actually owe" would mean five chances to get it wrong — and a silently
   wrong balance in a hospital is money that quietly disappears.

   So there is exactly one function. Everything uses it. It is tested.
   ══════════════════════════════════════════════════════════════════════════ */

export class RefundError extends Error {}

export interface MoneyLine { amount: number }

/** Everything actually collected, ignoring anything given back. */
export function grossPaid(payments: MoneyLine[]): number {
  return r2(payments.reduce((s, p) => r2(s + p.amount), 0));
}

/** Everything given back. */
export function totalRefunded(refunds: MoneyLine[]): number {
  return r2(refunds.reduce((s, x) => r2(s + x.amount), 0));
}

/**
 * What the hospital is actually holding for this invoice.
 * THE definition of "paid". Nothing else may redefine it.
 */
export function netPaid(payments: MoneyLine[], refunds: MoneyLine[] = []): number {
  return r2(grossPaid(payments) - totalRefunded(refunds));
}

/** Still owed. Never negative — an overpayment is a refund, not a negative debt. */
export function balanceDue(total: number, payments: MoneyLine[], refunds: MoneyLine[] = []): number {
  return Math.max(0, r2(total - netPaid(payments, refunds)));
}

/**
 * The most that can legally be handed back.
 *
 * THE INVARIANT: you cannot refund money you never collected. Not from a
 * cancelled bill, not from a mistyped amount, not ever. Without this a typo in
 * the refund box empties the till.
 */
export function refundable(payments: MoneyLine[], refunds: MoneyLine[] = []): number {
  return Math.max(0, netPaid(payments, refunds));
}

/* ════════════════════════════════════════════════════════════════════════════
   SPLIT PAYMENTS
   ════════════════════════════════════════════════════════════════════════════

   One bill can be settled across several tenders at the counter — the classic
   case being "₹500 cash and the rest on UPI". The database already allows many
   Payment rows per invoice and every "how much has this bill been paid" number
   already sums across them (grossPaid / netPaid), so a split needs no new
   storage — only this one shared, tested guard, so that no counter can collect
   MORE than the bill in the same breath it is raised.
   ══════════════════════════════════════════════════════════════════════════ */

/** Everything tendered in a single split. Just grossPaid under a clearer name. */
export function sumPayments(payments: MoneyLine[]): number {
  return grossPaid(payments);
}

/**
 * Throws unless a split is legal to collect against a bill of `total`:
 *  · every leg is a positive amount (no ₹0 "cash" line padding the receipt), and
 *  · the legs together do not exceed the bill (a penny of float slack allowed).
 * Under-paying is fine — that just leaves a balance due.
 */
export function assertPaymentsWithinTotal(total: number, payments: MoneyLine[]): void {
  for (const p of payments) {
    if (!(p.amount > 0)) throw new InvoiceMathError("Each payment must be more than ₹0");
  }
  if (r2(sumPayments(payments)) > r2(total) + 0.01) {
    throw new InvoiceMathError("Payments can't exceed the bill total");
  }
}

/** Throws unless this exact refund is legal. Called before any money moves. */
export function assertRefundable(
  amount: number,
  reason: string,
  payments: MoneyLine[],
  refunds: MoneyLine[] = []
): void {
  if (!(amount > 0)) throw new RefundError("A refund must be more than ₹0");
  if (!reason || reason.trim().length < 3) {
    // Nobody hands cash across a hospital counter without saying why.
    throw new RefundError("Say why the money is going back");
  }
  const max = refundable(payments, refunds);
  if (max === 0) throw new RefundError("Nothing was ever collected on this bill");
  if (r2(amount) > max) {
    throw new RefundError(`Only ₹${max.toFixed(2)} was collected — you can't refund more than that`);
  }
}

/** PAID / PARTIALLY_PAID / PENDING / REFUNDED — derived, never guessed. */
export function invoiceStatusFrom(
  total: number,
  payments: MoneyLine[],
  refunds: MoneyLine[] = [],
  cancelled = false
): "PENDING" | "PARTIALLY_PAID" | "PAID" | "CANCELLED" | "REFUNDED" {
  if (cancelled) return "CANCELLED";
  const gross = grossPaid(payments);
  const back = totalRefunded(refunds);
  // Everything that came in has gone back out.
  if (back > 0 && r2(back) >= gross && gross > 0) return "REFUNDED";
  const net = r2(gross - back);
  if (net <= 0) return "PENDING";
  if (net >= total) return "PAID";
  return "PARTIALLY_PAID";
}
