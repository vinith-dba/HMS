"use client";

import { useCallback, useEffect, useState } from "react";
import { Spinner } from "@/components/portal/ui/form-atoms";
import { Icon } from "@/components/portal/ui/icons";
import { PortalScroll } from "@/components/portal/portal-scroll";
import { api, ApiClientError } from "@/lib/api-client";

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
const todayISO = () => new Date().toLocaleDateString("en-CA");

export default function AdminDayClosePage() {
  const [date, setDate] = useState(todayISO());
  const [data, setData] = useState<Close | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await api.get<Close>(`/reception/day-close?date=${date}`)); }
    catch (e) { setError(e instanceof ApiClientError ? e.message : "Couldn't load the day."); }
    finally { setLoading(false); }
  }, [date]);
  useEffect(() => { load(); }, [load]);

  const cash = (data?.modes ?? []).find((m) => m.mode === "CASH")?.collected ?? 0;
  const upi = (data?.modes ?? []).find((m) => m.mode === "UPI")?.collected ?? 0;
  const card = (data?.modes ?? []).find((m) => m.mode === "CARD")?.collected ?? 0;

  return (
    <PortalScroll>
      <div data-rise className="surface dotgrid mb-6 flex flex-wrap items-center justify-between gap-4 px-6 py-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--p-teal)]">Admin console</p>
          <h1 className="mt-1 font-serif-p text-[24px] font-semibold text-[var(--p-ink)]">Day close</h1>
          <p className="mt-1 text-[13px] text-[var(--p-muted)]">Hospital-wide collections for a day — by payment type and by counter.</p>
        </div>
        <input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-[var(--p-border)] bg-white px-3 py-2 text-[13px] text-[var(--p-ink)] outline-none focus:border-[var(--p-teal)]" />
      </div>

      {error ? (
        <div data-rise className="surface flex flex-col items-center gap-3 px-6 py-16 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--p-rose-soft)] text-[var(--p-rose)]"><Icon name="alert" size={20} /></span>
          <p className="text-[15px] font-semibold text-[var(--p-ink)]">Couldn&apos;t load the day</p>
          <p className="max-w-md text-[13px] text-[var(--p-rose)]">{error}</p>
          <button onClick={() => load()} className="mt-1 rounded-lg bg-[var(--p-teal)] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[var(--p-teal-deep)]">Try again</button>
        </div>
      ) : loading || !data ? (
        <div className="flex items-center justify-center gap-2 py-20 text-[13px] text-[var(--p-muted)]"><Spinner /> Loading…</div>
      ) : (
        <>
          {/* headline */}
          <div data-rise className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {([["Cash", cash], ["UPI", upi], ["Card", card]] as const).map(([label, v]) => (
              <div key={label} className="surface px-5 py-4">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--p-muted)]">{label} collected</div>
                <div className="mt-1 font-mono text-[20px] font-bold text-[var(--p-ink)]">₹{money(v)}</div>
              </div>
            ))}
            <div className="surface bg-[var(--p-teal-soft)]/40 px-5 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--p-teal-deep)]">Net collected</div>
              <div className="mt-1 font-mono text-[20px] font-bold text-[var(--p-teal-deep)]">₹{money(data.totals?.net ?? 0)}</div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* by mode */}
            <section data-rise className="surface overflow-hidden">
              <div className="border-b border-[var(--p-border)] px-5 py-3.5">
                <h2 className="text-[14px] font-semibold text-[var(--p-ink)]">By payment type</h2>
                <p className="mt-0.5 text-[12px] text-[var(--p-muted)]">{data.bills} bill{data.bills === 1 ? "" : "s"} raised{data.refundCount > 0 ? ` · ${data.refundCount} refund${data.refundCount === 1 ? "" : "s"}` : ""}</p>
              </div>
              <div className="divide-y divide-[var(--p-border)]">
                {(data.modes ?? []).map((m) => (
                  <div key={m.mode} className={`flex items-center gap-4 px-5 py-3 ${m.collected === 0 && m.refunded === 0 ? "opacity-45" : ""}`}>
                    <span className="w-[90px] text-[13px] font-semibold text-[var(--p-ink)]">{m.mode}</span>
                    <span className="w-[46px] text-right font-mono text-[12px] text-[var(--p-muted)]">{m.count}×</span>
                    <span className="flex-1 text-right font-mono text-[13px] text-[var(--p-ink)]">₹{money(m.collected)}</span>
                    <span className={`w-[90px] text-right font-mono text-[13px] ${m.refunded > 0 ? "text-[var(--p-rose)]" : "text-[var(--p-muted)]"}`}>{m.refunded > 0 ? `−₹${money(m.refunded)}` : "—"}</span>
                    <span className="w-[100px] text-right font-mono text-[14px] font-bold text-[var(--p-ink)]">₹{money(m.net)}</span>
                  </div>
                ))}
                <div className="flex items-center gap-4 bg-[var(--p-bg)] px-5 py-3">
                  <span className="flex-1 text-[12px] font-bold uppercase tracking-wide text-[var(--p-muted)]">Total</span>
                  <span className="w-[100px] text-right font-mono text-[15px] font-bold text-[var(--p-teal)]">₹{money(data.totals?.net ?? 0)}</span>
                </div>
              </div>
            </section>

            {/* by counter */}
            <section data-rise className="surface overflow-hidden">
              <div className="border-b border-[var(--p-border)] px-5 py-3.5">
                <h2 className="text-[14px] font-semibold text-[var(--p-ink)]">By counter</h2>
                <p className="mt-0.5 text-[12px] text-[var(--p-muted)]">Payments taken per person.</p>
              </div>
              <div className="divide-y divide-[var(--p-border)]">
                {(data.byCounter ?? []).length === 0 ? (
                  <p className="px-5 py-8 text-center text-[13px] text-[var(--p-muted)]">No payments this day.</p>
                ) : (data.byCounter ?? []).map((c) => (
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
          </div>

          {/* refunds */}
          {(data.refunds ?? []).length > 0 && (
            <section data-rise className="surface mt-6 overflow-hidden">
              <div className="border-b border-[var(--p-border)] px-5 py-3.5"><h2 className="text-[14px] font-semibold text-[var(--p-ink)]">Refunds given</h2></div>
              <div className="divide-y divide-[var(--p-border)]">
                {(data.refunds ?? []).map((r, i) => (
                  <div key={i} className="flex items-center justify-between gap-4 px-5 py-3">
                    <div>
                      <div className="text-[13px] text-[var(--p-ink)]">{r.patient} <span className="font-mono text-[12px] text-[var(--p-muted)]">· {r.receiptNo}</span></div>
                      <div className="text-[12px] text-[var(--p-muted)]">{r.reason} · by {r.by}</div>
                    </div>
                    <span className="font-mono text-[13px] font-semibold text-[var(--p-rose)]">−₹{money(r.amount)} <span className="text-[11px] font-normal text-[var(--p-muted)]">{r.mode}</span></span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* outstanding */}
          {(data.outstanding ?? []).length > 0 && (
            <section data-rise className="surface mt-6 overflow-hidden">
              <div className="border-b border-[var(--p-border)] px-5 py-3.5"><h2 className="text-[14px] font-semibold text-[var(--p-ink)]">Raised today, still due</h2></div>
              <div className="divide-y divide-[var(--p-border)]">
                {(data.outstanding ?? []).map((o) => (
                  <div key={o.receiptNo} className="flex items-center justify-between gap-4 px-5 py-3">
                    <div>
                      <div className="text-[13px] text-[var(--p-ink)]">{o.patient} <span className="font-mono text-[12px] text-[var(--p-muted)]">· {o.receiptNo}</span></div>
                      <div className="font-mono text-[12px] text-[var(--p-muted)]">₹{money(o.paid)} of ₹{money(o.total)} paid</div>
                    </div>
                    <span className="font-mono text-[14px] font-bold text-[#8a5a1a]">₹{money(o.due)} due</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </PortalScroll>
  );
}
