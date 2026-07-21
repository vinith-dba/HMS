"use client";

/**
 * Shared bill fields — one discount control and one payment control, used by
 * every place that raises a bill (reception, pharmacy, labs, IPD discharge).
 *
 * Two things the counter kept asking for live here so they behave identically
 * on every receipt:
 *   · DiscountInput  — enter a discount as a PERCENTAGE (default) or a flat ₹.
 *   · PaymentSection — take the money as one tender, or SPLIT it (part cash,
 *                      part UPI) across the one bill.
 *
 * Neither talks to the server. DiscountInput hands back the resolved rupee
 * amount (the server bills GST on rupees, exactly as before); PaymentSection
 * hands back a list of tenders. The percentage a bill was given prints itself
 * on the invoice, back-computed from that rupee amount against the subtotal.
 */

import { useEffect, useRef, useState } from "react";

export type Accent = "teal" | "blue";
export type PayMode = "CASH" | "UPI" | "CARD" | "NETBANKING";
export interface Tender { mode: PayMode; amount: number; reference?: string }

/** Paise-precision rounding, matching the server's r2 so screen == receipt. */
const r2 = (n: number) => Math.round(n * 100) / 100;
const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi);
const digits = (s: string) => s.replace(/[^\d.]/g, "");
const inr = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Literal class strings (not interpolated) so Tailwind keeps them at build time.
const CHIP_ON: Record<Accent, string> = {
  teal: "border-[var(--p-teal)] bg-[var(--p-teal)] text-white",
  blue: "border-[var(--p-blue)] bg-[var(--p-blue)] text-white",
};
const CHIP_OFF = "border-[var(--p-border)] text-[var(--p-muted)] hover:border-[var(--p-ink)]";
const RING: Record<Accent, string> = {
  teal: "focus:border-[var(--p-teal)]",
  blue: "focus:border-[var(--p-blue)]",
};
const ACCENT_TEXT: Record<Accent, string> = {
  teal: "text-[var(--p-teal)]",
  blue: "text-[var(--p-blue)]",
};

const label = "mb-2 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-[var(--p-muted)]";
const fldBase = "w-full rounded-lg border border-[var(--p-border)] bg-white px-3 py-2 text-sm text-[var(--p-ink)] outline-none";

// ── Discount ────────────────────────────────────────────────────────────────

/**
 * Discount as a percentage of the subtotal (default) or a flat rupee amount.
 * Emits the resolved rupee `amount` — the parent uses that for its live total
 * and sends it to the server unchanged.
 */
export function DiscountInput({
  subtotal,
  accent = "teal",
  initialAmount,
  onChange,
}: {
  subtotal: number;
  accent?: Accent;
  /** A discount already on the bill (rupees) — starts the field in ₹ mode. */
  initialAmount?: number;
  onChange: (d: { amount: number; pct: number; isPct: boolean }) => void;
}) {
  const [isPct, setIsPct] = useState(!initialAmount);
  const [raw, setRaw] = useState(initialAmount ? String(initialAmount) : "");

  const n = Number(raw || 0);
  const pct = isPct ? clamp(n, 0, 100) : subtotal > 0 ? clamp((Math.min(n, subtotal) / subtotal) * 100, 0, 100) : 0;
  const amount = isPct ? r2((subtotal * clamp(n, 0, 100)) / 100) : Math.min(r2(n), r2(subtotal));

  const cb = useRef(onChange);
  cb.current = onChange;
  useEffect(() => {
    cb.current({ amount, pct, isPct });
  }, [amount, pct, isPct]);

  const overCap = isPct && n > 100;
  const seg = (active: boolean) =>
    `px-2.5 py-1 text-[12px] font-semibold transition-colors ${active ? CHIP_ON[accent] : "text-[var(--p-muted)]"}`;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className={label + " mb-0"}>Discount</span>
        <div className="inline-flex overflow-hidden rounded-md p-1 border border-[var(--p-border)]">
          <button type="button" onClick={() => setIsPct(true)} className={seg(isPct)}>%</button>
          <button type="button" onClick={() => setIsPct(false)} className={seg(!isPct)}>₹</button>
        </div>
      </div>
      <div className="relative">
        <input
          className={`${fldBase} ${RING[accent]} ${isPct ? "pr-8" : "pl-7"}`}
          value={raw}
          onChange={(e) => setRaw(digits(e.target.value))}
          inputMode="decimal"
          placeholder={isPct ? "0" : "0.00"}
          aria-label={isPct ? "Discount percent" : "Discount amount in rupees"}
        />
        <span className="pointer-events-none absolute inset-y-0 flex items-center text-[13px] text-[var(--p-muted)]"
          style={isPct ? { right: "0.75rem" } : { left: "0.75rem" }}>
          {isPct ? "%" : "₹"}
        </span>
      </div>
      <p className="mt-1.5 text-[11px] text-[var(--p-muted)]">
        {amount > 0 ? (
          <>
            <span className={ACCENT_TEXT[accent]}>− {inr(amount)}</span>{" "}
            {isPct ? `off ${inr(subtotal)}` : `= ${pct.toFixed(1)}% off`}
          </>
        ) : overCap ? (
          "Max 100%"
        ) : (
          "No discount"
        )}
      </p>
    </div>
  );
}

// ── Payment ───────────────────────────────────────────────────────────────────

const MODES: PayMode[] = ["CASH", "UPI", "CARD", "NETBANKING"];

/**
 * Collect `total` as a single tender, or split it across cash + UPI.
 * In split mode the cash amount is the one you type; UPI is always the
 * remainder, so the two can never fail to add up to the bill. Emits the list
 * of tenders and whether it's currently a complete settlement of `total`.
 */
export function PaymentSection({
  total,
  accent = "teal",
  onChange,
}: {
  total: number;
  accent?: Accent;
  onChange: (r: { payments: Tender[]; valid: boolean }) => void;
}) {
  const [split, setSplit] = useState(false);
  const [mode, setMode] = useState<PayMode>("CASH");
  const [reference, setReference] = useState("");
  const [cashRaw, setCashRaw] = useState("");
  const [upiRef, setUpiRef] = useState("");

  const t = r2(Math.max(0, total));
  const cash = split ? clamp(r2(Number(cashRaw || 0)), 0, t) : 0;
  const upi = split ? r2(t - cash) : 0;

  const payments: Tender[] = split
    ? [
        { mode: "CASH" as PayMode, amount: cash },
        { mode: "UPI" as PayMode, amount: upi, reference: upiRef.trim() || undefined },
      ].filter((p) => p.amount > 0)
    : [{ mode, amount: t, reference: mode !== "CASH" ? reference.trim() || undefined : undefined }].filter(
        (p) => p.amount > 0
      );

  const sum = payments.reduce((s, p) => r2(s + p.amount), 0);
  const valid = t <= 0 ? true : payments.length > 0 && Math.abs(sum - t) < 0.01;

  const cb = useRef(onChange);
  cb.current = onChange;
  useEffect(() => {
    cb.current({ payments, valid });
    // primitive deps only — payments is derived from exactly these
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, split, mode, reference, cashRaw, upiRef]);

  const chip = (active: boolean) =>
    `rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition-colors ${active ? CHIP_ON[accent] : CHIP_OFF}`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {!split &&
          MODES.map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)} className={chip(mode === m)}>
              {m}
            </button>
          ))}
        <button
          type="button"
          onClick={() => setSplit((v) => !v)}
          className={`${chip(split)} ml-auto`}
          aria-pressed={split}
        >
          {split ? "✕ Single" : "⇆ Split cash + UPI"}
        </button>
      </div>

      {!split && mode !== "CASH" && (
        <input
          className={`${fldBase} ${RING[accent]}`}
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="Txn reference (optional)"
        />
      )}

      {split && (
        <div className="rounded-lg border border-[var(--p-border)] p-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className={label}>Cash</span>
              <div className="relative">
                <input
                  className={`${fldBase} ${RING[accent]} pl-7`}
                  value={cashRaw}
                  onChange={(e) => setCashRaw(digits(e.target.value))}
                  inputMode="decimal"
                  placeholder="0.00"
                  aria-label="Cash amount"
                />
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[13px] text-[var(--p-muted)]">₹</span>
              </div>
            </div>
            <div>
              <span className={label}>UPI · remainder</span>
              <div className={`${fldBase} flex items-center bg-[var(--p-bg)] font-mono text-[var(--p-ink)]`}>{inr(upi)}</div>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <input
              className={`${fldBase} ${RING[accent]}`}
              value={upiRef}
              onChange={(e) => setUpiRef(e.target.value)}
              placeholder="UPI reference (optional)"
            />
            <button
              type="button"
              onClick={() => setCashRaw(r2(t / 2).toFixed(2))}
              className="shrink-0 rounded-lg border border-[var(--p-border)] px-3 py-2 text-[11px] font-semibold text-[var(--p-muted)] hover:border-[var(--p-ink)]"
            >
              ½
            </button>
          </div>
          <p className="mt-2 text-[11px] text-[var(--p-muted)]">
            Cash {inr(cash)} + UPI {inr(upi)} = <span className={ACCENT_TEXT[accent]}>{inr(t)}</span>
          </p>
        </div>
      )}
    </div>
  );
}
