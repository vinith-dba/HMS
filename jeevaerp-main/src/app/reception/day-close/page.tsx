"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/portal/ui/icons";
import { Spinner } from "@/components/portal/ui/form-atoms";
import { PortalScroll } from "@/components/portal/portal-scroll";
import { api, ApiClientError } from "@/lib/api-client";

/**
 * DAY CLOSE — the shift handover.
 *
 * At the end of a shift a receptionist counts the cash drawer and hands it over.
 * Until now Jeeva couldn't tell them what the number *should* be, so "reconciling"
 * meant trusting the drawer — which isn't reconciliation, it's hope.
 *
 * The rule everyone gets wrong, stated on the page itself:
 * a refund paid by UPI does NOT come out of the cash box. Cash in hand is
 * cash taken minus cash given back — in cash — and nothing else.
 */

interface ModeTotal { mode: string; collected: number; refunded: number; net: number; count: number; }
interface Close {
  date: string;
  modes: ModeTotal[];
  totals: { collected: number; refunded: number; net: number };
  cashInHand: number;
  bills: number;
  refundCount: number;
  byCounter: { name: string; count: number; amount: number }[];
  refunds: { receiptNo: string; patient: string; amount: number; mode: string; reason: string; by: string; at: string }[];
  outstanding: { receiptNo: string; patient: string; total: number; paid: number; due: number }[];
}

const money = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, local

export default function DayClosePage() {
  const [date, setDate] = useState(today());
  const [data, setData] = useState<Close | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [counted, setCounted] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await api.get<Close>(`/reception/day-close?date=${date}`)); }
    catch (e) { setError(e instanceof ApiClientError ? e.message : "Couldn't load the day."); }
    finally { setLoading(false); }
  }, [date]);
  useEffect(() => { load(); }, [load]);

  // The whole point: does the drawer match the books?
  const diff = counted.trim() === "" || !data ? null : Number(counted) - (data.cashInHand ?? 0);

  return (
    <PortalScroll>
      <div data-rise className="surface dotgrid mb-5 flex flex-wrap items-center justify-between gap-4 px-6 py-5">
        <div>
          <h1 className="font-serif-p text-[22px] font-semibold text-[var(--p-ink)]">Day close</h1>
          <p className="mt-1 text-[13px] text-[var(--p-muted)]">
            What should be in the drawer, and whether it is.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-[var(--p-border)] bg-white px-3 py-2 text-[13px] text-[var(--p-ink)] outline-none focus:border-[var(--p-teal)]" />
          <button onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--p-border)] px-3.5 py-2 text-[13px] font-medium text-[var(--p-text)] hover:border-[var(--p-teal)]">
            <Icon name="file" size={14} /> Print
          </button>
        </div>
      </div>

      {error ? (
        <div data-rise className="surface flex flex-col items-center gap-3 px-6 py-16 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--p-rose-soft)] text-[var(--p-rose)]"><Icon name="alert" size={20} /></span>
          <p className="text-[15px] font-semibold text-[var(--p-ink)]">Couldn&apos;t load the day</p>
          <p className="max-w-md text-[13px] text-[var(--p-rose)]">{error}</p>
          <button onClick={() => load()} className="mt-1 rounded-lg bg-[var(--p-teal)] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[var(--p-teal-deep)]">Try again</button>
        </div>
      ) : loading || !data ? (
        <div className="surface flex items-center justify-center gap-2 py-20 text-[13px] text-[var(--p-muted)]"><Spinner /> Loading…</div>
      ) : (
        <>
          {/* headline: cash collected, UPI collected, card, and the total */}
          <div data-rise className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="surface px-5 py-4">
              <div className="text-[12px] font-semibold uppercase tracking-wide text-[var(--p-muted)]">Cash collected</div>
              <div className="mt-1 font-mono text-[22px] font-bold text-[var(--p-ink)]">₹{money((data.modes ?? []).find((m) => m.mode === "CASH")?.collected ?? 0)}</div>
            </div>
            <div className="surface px-5 py-4">
              <div className="text-[12px] font-semibold uppercase tracking-wide text-[var(--p-muted)]">UPI collected</div>
              <div className="mt-1 font-mono text-[22px] font-bold text-[var(--p-ink)]">₹{money((data.modes ?? []).find((m) => m.mode === "UPI")?.collected ?? 0)}</div>
            </div>
            <div className="surface px-5 py-4">
              <div className="text-[12px] font-semibold uppercase tracking-wide text-[var(--p-muted)]">Card collected</div>
              <div className="mt-1 font-mono text-[22px] font-bold text-[var(--p-ink)]">₹{money((data.modes ?? []).find((m) => m.mode === "CARD")?.collected ?? 0)}</div>
            </div>
            <div className="surface px-5 py-4">
              <div className="text-[12px] font-semibold uppercase tracking-wide text-[var(--p-muted)]">Total collected</div>
              <div className="mt-1 font-mono text-[22px] font-bold text-[var(--p-teal)]">₹{money(data.totals?.collected ?? 0)}</div>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <div className="space-y-5">
            {/* ── by mode ── */}
            <section data-rise className="surface overflow-hidden">
              <div className="border-b border-[var(--p-border)] px-5 py-3.5">
                <h2 className="text-[14px] font-semibold text-[var(--p-ink)]">Taken today</h2>
                <p className="mt-0.5 text-[12px] text-[var(--p-muted)]">
                  {data.bills} bill{data.bills === 1 ? "" : "s"} raised
                  {data.refundCount > 0 && ` · ${data.refundCount} refund${data.refundCount === 1 ? "" : "s"} given`}
                </p>
              </div>

              <div className="divide-y divide-[var(--p-border)]">
                {(data.modes ?? []).map((m) => (
                  <div key={m.mode} className={`flex items-center gap-4 px-5 py-3 ${m.collected === 0 && m.refunded === 0 ? "opacity-45" : ""}`}>
                    <span className={`w-[110px] text-[13px] font-semibold ${m.mode === "CASH" ? "text-[var(--p-ink)]" : "text-[var(--p-text)]"}`}>
                      {m.mode}
                      {m.mode === "CASH" && <span className="ml-1.5 text-[10px] font-normal text-[var(--p-muted)]">(the drawer)</span>}
                    </span>
                    <span className="flex-1 text-right font-mono text-[13px] text-[var(--p-ink)]">₹{money(m.collected)}</span>
                    <span className={`w-[110px] text-right font-mono text-[13px] ${m.refunded > 0 ? "text-[var(--p-rose)]" : "text-[var(--p-muted)]"}`}>
                      {m.refunded > 0 ? `−₹${money(m.refunded)}` : "—"}
                    </span>
                    <span className="w-[110px] text-right font-mono text-[14px] font-bold text-[var(--p-ink)]">₹{money(m.net)}</span>
                  </div>
                ))}
                <div className="flex items-center gap-4 bg-[var(--p-bg)] px-5 py-3">
                  <span className="w-[110px] text-[12px] font-bold uppercase tracking-wide text-[var(--p-muted)]">Total</span>
                  <span className="flex-1 text-right font-mono text-[14px] font-semibold text-[var(--p-ink)]">₹{money(data.totals?.collected ?? 0)}</span>
                  <span className="w-[110px] text-right font-mono text-[14px] font-semibold text-[var(--p-rose)]">
                    {(data.totals?.refunded ?? 0) > 0 ? `−₹${money(data.totals?.refunded ?? 0)}` : "—"}
                  </span>
                  <span className="w-[110px] text-right font-mono text-[16px] font-bold text-[var(--p-teal)]">₹{money(data.totals?.net ?? 0)}</span>
                </div>
              </div>
            </section>

            {/* ── by counter: who took the money ── */}
            {(data.byCounter ?? []).length > 0 && (
              <section data-rise className="surface overflow-hidden">
                <div className="border-b border-[var(--p-border)] px-5 py-3.5">
                  <h2 className="text-[14px] font-semibold text-[var(--p-ink)]">By counter</h2>
                  <p className="mt-0.5 text-[12px] text-[var(--p-muted)]">How many payments each person took today, and how much.</p>
                </div>
                <div className="divide-y divide-[var(--p-border)]">
                  {(data.byCounter ?? []).map((c) => (
                    <div key={c.name} className="flex items-center gap-4 px-5 py-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--p-teal-soft)] text-[11px] font-bold text-[var(--p-teal-deep)]">
                        {c.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                      </span>
                      <span className="flex-1 text-[13px] font-medium text-[var(--p-ink)]">{c.name}</span>
                      <span className="text-[12px] text-[var(--p-muted)]">{c.count} txn{c.count === 1 ? "" : "s"}</span>
                      <span className="w-[110px] text-right font-mono text-[14px] font-bold text-[var(--p-ink)]">₹{money(c.amount)}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── refunds, named ── */}
            {(data.refunds ?? []).length > 0 && (
              <section data-rise className="surface overflow-hidden">
                <div className="border-b border-[var(--p-border)] px-5 py-3.5">
                  <h2 className="text-[14px] font-semibold text-[var(--p-ink)]">Money that went back</h2>
                  <p className="mt-0.5 text-[12px] text-[var(--p-muted)]">
                    Every refund is named, with who authorised it. Cash leaving a hospital does not go unrecorded.
                  </p>
                </div>
                <div className="divide-y divide-[var(--p-border)]">
                  {(data.refunds ?? []).map((r, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-3 px-5 py-3">
                      <div className="min-w-[170px] flex-1">
                        <div className="font-mono text-[13px] font-semibold text-[var(--p-ink)]">{r.receiptNo}</div>
                        <div className="text-[12px] text-[var(--p-muted)]">{r.patient}</div>
                      </div>
                      <div className="min-w-[160px] flex-1 text-[12px] text-[var(--p-text)]">{r.reason}</div>
                      <span className="rounded bg-[var(--p-bg)] px-2 py-1 text-[11px] font-semibold text-[var(--p-muted)]">{r.mode}</span>
                      <span className="w-[90px] text-right font-mono text-[14px] font-bold text-[var(--p-rose)]">−₹{money(r.amount)}</span>
                      <span className="w-[110px] text-right text-[11px] text-[var(--p-muted)]">{r.by}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── still owed ── */}
            {(data.outstanding ?? []).length > 0 && (
              <section data-rise className="surface overflow-hidden">
                <div className="border-b border-[var(--p-border)] px-5 py-3.5">
                  <h2 className="text-[14px] font-semibold text-[var(--p-ink)]">Still owed from today</h2>
                  <p className="mt-0.5 text-[12px] text-[var(--p-muted)]">Chase these before the shift ends, not next week.</p>
                </div>
                <div className="divide-y divide-[var(--p-border)]">
                  {(data.outstanding ?? []).map((o) => (
                    <div key={o.receiptNo} className="flex items-center gap-4 px-5 py-3">
                      <div className="min-w-[170px] flex-1">
                        <div className="font-mono text-[13px] font-semibold text-[var(--p-ink)]">{o.receiptNo}</div>
                        <div className="text-[12px] text-[var(--p-muted)]">{o.patient}</div>
                      </div>
                      <span className="text-right font-mono text-[12px] text-[var(--p-muted)]">₹{money(o.paid)} / ₹{money(o.total)}</span>
                      <span className="w-[100px] text-right font-mono text-[14px] font-bold text-[var(--p-rose)]">₹{money(o.due)}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* ── THE COUNT ── */}
          <div>
            <section data-rise className="surface overflow-hidden lg:sticky lg:top-4">
              <div className="border-b border-[var(--p-border)] bg-[var(--p-teal-soft)] px-5 py-4">
                <p className="text-[12px] font-bold uppercase tracking-wide text-[var(--p-teal-deep)]">Cash in hand</p>
                <p className="mt-1 font-mono text-[32px] font-bold leading-none text-[var(--p-ink)]">
                  ₹{money(data.cashInHand ?? 0)}
                </p>
                <p className="mt-2 text-[11px] leading-relaxed text-[var(--p-text)]">
                  Cash taken <b>minus cash refunded</b>. A UPI refund never comes out of this drawer —
                  only cash does.
                </p>
              </div>

              <div className="space-y-3 p-5">
                <label className="block text-[12px] font-semibold text-[var(--p-text)]">
                  Now count the drawer
                </label>
                <input value={counted} inputMode="decimal"
                  onChange={(e) => setCounted(e.target.value.replace(/[^\d.]/g, ""))}
                  placeholder="What's actually there"
                  className="w-full rounded-lg border border-[var(--p-border)] bg-white px-3 py-2.5 text-center font-mono text-[18px] font-semibold text-[var(--p-ink)] outline-none focus:border-[var(--p-teal)]" />

                {diff !== null && (
                  <div className={`rounded-lg px-4 py-3 text-center ${
                    Math.abs(diff) < 0.01
                      ? "bg-[var(--p-cyan-soft)] text-[var(--p-cyan-deep)]"
                      : "bg-[var(--p-rose-soft)] text-[var(--p-rose)]"
                  }`}>
                    {Math.abs(diff) < 0.01 ? (
                      <p className="flex items-center justify-center gap-2 text-[14px] font-bold">
                        <Icon name="check" size={16} /> It balances.
                      </p>
                    ) : (
                      <>
                        <p className="font-mono text-[20px] font-bold">
                          {diff > 0 ? "+" : "−"}₹{money(Math.abs(diff))}
                        </p>
                        <p className="mt-1 text-[12px] font-semibold">
                          {diff > 0 ? "More in the drawer than the books say" : "The drawer is short"}
                        </p>
                        <p className="mt-1.5 text-[11px] leading-relaxed opacity-90">
                          Don&apos;t hand over until you know why. Check for a payment taken but not
                          entered, or change given from the wrong drawer.
                        </p>
                      </>
                    )}
                  </div>
                )}

                <p className="text-[11px] leading-relaxed text-[var(--p-muted)]">
                  This is a reconciliation aid, not a lock — nothing is written when you count.
                  Print it and staple it to the handover.
                </p>
              </div>
            </section>
          </div>
        </div>
        </>
      )}
    </PortalScroll>
  );
}
