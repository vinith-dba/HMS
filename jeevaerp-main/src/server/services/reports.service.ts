import { prisma } from "@/lib/prisma";
import { r2 } from "@/server/billing/calc";

/**
 * DAY CLOSE — what should physically be in the drawer right now.
 *
 * At the end of a shift a receptionist counts the cash and hands it over. Until
 * now Jeeva could not tell them what the number *should* be, so the only way to
 * reconcile was to trust the drawer — which is not reconciliation, it's hope.
 *
 * The rule this encodes, and it's the one people get wrong:
 *
 *   CASH IN HAND = cash payments taken − cash refunds given.
 *
 * A refund is not a "negative sale" to be netted off somewhere later. It is money
 * that physically left the drawer, and it must reduce the expected count on the
 * same day it happened, in the same mode it was given back in. UPI refunds do not
 * come out of the cash box; cash refunds do.
 */

export interface ModeTotal {
  mode: string;
  collected: number;
  refunded: number;
  /** collected − refunded. For CASH, this is what should be in the drawer. */
  net: number;
  count: number;
}

export interface DayClose {
  date: string;
  /** Every mode, even the ones with no activity — a missing row reads as a bug. */
  modes: ModeTotal[];
  totals: { collected: number; refunded: number; net: number };
  /** The number the receptionist physically counts. */
  cashInHand: number;
  bills: number;
  refundCount: number;
  /** Per-counter (receptionist) tally — how many payments each took and how much. */
  byCounter: { name: string; count: number; amount: number }[];
  /** Refunds are listed individually — money leaving a hospital gets named. */
  refunds: {
    receiptNo: string; patient: string; amount: number;
    mode: string; reason: string; by: string; at: string;
  }[];
  /** Bills raised today that are still not fully paid. */
  outstanding: { receiptNo: string; patient: string; total: number; paid: number; due: number }[];
}

const MODES = ["CASH", "UPI", "CARD", "NETBANKING", "OTHER"] as const;

/** Local-day window. A hospital's day ends at midnight, not at UTC midnight. */
function dayWindow(dateISO?: string) {
  const base = dateISO ? new Date(`${dateISO}T00:00:00`) : new Date();
  const from = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 0, 0, 0, 0);
  const to = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 23, 59, 59, 999);
  return { from, to };
}

export async function dayClose(dateISO?: string): Promise<DayClose> {
  const { from, to } = dayWindow(dateISO);

  const [payments, refunds, invoices] = await Promise.all([
    prisma.payment.findMany({
      where: { createdAt: { gte: from, lte: to } },
      select: { mode: true, amount: true, invoiceId: true, receivedBy: { select: { name: true } } },
    }),
    prisma.refund.findMany({
      where: { createdAt: { gte: from, lte: to } },
      orderBy: { createdAt: "desc" },
      select: {
        mode: true, amount: true, reason: true, createdAt: true,
        refundedBy: { select: { name: true } },
        invoice: { select: { receiptNo: true, patient: { select: { fullName: true } } } },
      },
    }),
    prisma.invoice.findMany({
      where: { createdAt: { gte: from, lte: to } },
      select: {
        receiptNo: true, totalAmount: true, status: true,
        patient: { select: { fullName: true } },
        payments: { select: { amount: true } },
        refunds: { select: { amount: true } },
      },
    }),
  ]);

  type P = { mode: string; amount: { toString(): string }; receivedBy: { name: string } | null };
  type R = {
    mode: string; amount: { toString(): string }; reason: string; createdAt: Date;
    refundedBy: { name: string } | null;
    invoice: { receiptNo: string; patient: { fullName: string } | null } | null;
  };

  const modes: ModeTotal[] = MODES.map((m) => {
    const collected = r2((payments as P[])
      .filter((p) => p.mode === m)
      .reduce((s, p) => r2(s + Number(p.amount.toString())), 0));
    const refunded = r2((refunds as R[])
      .filter((x) => x.mode === m)
      .reduce((s, x) => r2(s + Number(x.amount.toString())), 0));
    return {
      mode: m,
      collected,
      refunded,
      net: r2(collected - refunded),
      count: (payments as P[]).filter((p) => p.mode === m).length,
    };
  });

  // per-counter (receptionist) tally
  const counterMap = new Map<string, { name: string; count: number; amount: number }>();
  for (const p of payments as P[]) {
    const name = p.receivedBy?.name ?? "\u2014";
    const cur = counterMap.get(name) ?? { name, count: 0, amount: 0 };
    cur.count += 1; cur.amount = r2(cur.amount + Number(p.amount.toString()));
    counterMap.set(name, cur);
  }
  const byCounter = [...counterMap.values()].sort((a, b) => b.amount - a.amount);

  const collected = r2(modes.reduce((s, m) => r2(s + m.collected), 0));
  const refunded = r2(modes.reduce((s, m) => r2(s + m.refunded), 0));

  return {
    date: from.toISOString().slice(0, 10),
    modes,
    totals: { collected, refunded, net: r2(collected - refunded) },
    // The drawer only ever sees cash. A ₹5,000 UPI refund does not empty it.
    cashInHand: modes.find((m) => m.mode === "CASH")?.net ?? 0,
    bills: invoices.length,
    refundCount: refunds.length,
    byCounter,
    refunds: (refunds as R[]).map((x) => ({
      receiptNo: x.invoice?.receiptNo ?? "—",
      patient: x.invoice?.patient?.fullName ?? "—",
      amount: Number(x.amount.toString()),
      mode: x.mode,
      reason: x.reason,
      by: x.refundedBy?.name ?? "—",
      at: x.createdAt.toISOString(),
    })),
    outstanding: (invoices as {
      receiptNo: string; totalAmount: { toString(): string }; status: string;
      patient: { fullName: string } | null;
      payments: { amount: { toString(): string } }[];
      refunds: { amount: { toString(): string } }[];
    }[])
      .filter((i) => i.status !== "CANCELLED")
      .map((i) => {
        const total = Number(i.totalAmount.toString());
        const paid = r2(
          i.payments.reduce((s, p) => r2(s + Number(p.amount.toString())), 0) -
          i.refunds.reduce((s, p) => r2(s + Number(p.amount.toString())), 0)
        );
        return {
          receiptNo: i.receiptNo,
          patient: i.patient?.fullName ?? "—",
          total, paid,
          due: r2(Math.max(0, total - paid)),
        };
      })
      .filter((i) => i.due > 0)
      .sort((a, b) => b.due - a.due),
  };
}

/** Invoice sources map to counters: PHARMACY = pharmacy till, LAB = lab till, etc. */
export type CounterSource = "CONSULTATION" | "LAB" | "PHARMACY" | "IPD" | "OTHER";

/**
 * Collections for a day, broken down by payment type (CASH / UPI / CARD / …).
 *
 * This is the "what did this counter take, and in what form" number — the same
 * split reception sees at day-close, but reusable per till. Pass `sources` to
 * scope it to one counter (e.g. the pharmacist only reconciles PHARMACY money);
 * omit it for a hospital-wide view (admin). Refunds are netted per mode and are
 * matched to the counter through the invoice they came from, so a refund handed
 * back at the pharmacy reduces the pharmacy's cash, not reception's.
 */
export async function collectionByMode(opts?: {
  dateISO?: string;
  sources?: readonly CounterSource[];
}): Promise<{
  date: string;
  modes: ModeTotal[];
  totals: { collected: number; refunded: number; net: number; count: number };
}> {
  const { from, to } = dayWindow(opts?.dateISO);
  const sourceWhere =
    opts?.sources && opts.sources.length ? { invoice: { source: { in: [...opts.sources] } } } : {};

  const [payments, refunds] = await Promise.all([
    prisma.payment.findMany({
      where: { createdAt: { gte: from, lte: to }, ...sourceWhere },
      select: { mode: true, amount: true },
    }),
    prisma.refund.findMany({
      where: { createdAt: { gte: from, lte: to }, ...sourceWhere },
      select: { mode: true, amount: true },
    }),
  ]);

  type MA = { mode: string; amount: { toString(): string } };
  const modes: ModeTotal[] = MODES.map((m) => {
    const collected = r2((payments as MA[])
      .filter((p) => p.mode === m)
      .reduce((s, p) => r2(s + Number(p.amount.toString())), 0));
    const refunded = r2((refunds as MA[])
      .filter((x) => x.mode === m)
      .reduce((s, x) => r2(s + Number(x.amount.toString())), 0));
    return {
      mode: m,
      collected,
      refunded,
      net: r2(collected - refunded),
      count: (payments as MA[]).filter((p) => p.mode === m).length,
    };
  });

  const collected = r2(modes.reduce((s, m) => r2(s + m.collected), 0));
  const refunded = r2(modes.reduce((s, m) => r2(s + m.refunded), 0));
  return {
    date: from.toISOString().slice(0, 10),
    modes,
    totals: { collected, refunded, net: r2(collected - refunded), count: modes.reduce((s, m) => s + m.count, 0) },
  };
}
