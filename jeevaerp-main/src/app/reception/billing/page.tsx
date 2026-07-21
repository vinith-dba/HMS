"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pill, statusTone } from "@/components/portal/ui/primitives";
import { Icon } from "@/components/portal/ui/icons";
import { Spinner, Field } from "@/components/portal/ui/form-atoms";
import { PortalScroll } from "@/components/portal/portal-scroll";
import { api, ApiClientError } from "@/lib/api-client";

interface Inv {
  id: string; receiptNo: string; source: string; status: string;
  totalAmount: string; amountPaid: string; createdAt: string;
  /** Money already handed back. */
  refunded: string;
  /** The ceiling — the desk never has to work it out. */
  refundable: string;
  /** Distinct payment types on this bill: [] unpaid, ["CASH"], ["CASH","UPI"] (split). */
  paymentModes: string[];
  patient: { displayId: string; fullName: string };
}

const SOURCE: Record<string, string> = {
  CONSULTATION: "OP consult", LAB: "Lab", PHARMACY: "Pharmacy", IPD: "Inpatient", OTHER: "Other",
};
const MODES = ["CASH", "UPI", "CARD"] as const;
const MODE_LABEL: Record<string, string> = { CASH: "Cash", UPI: "UPI", CARD: "Card", NETBANKING: "Net banking", OTHER: "Other" };
const payLabel = (modes: string[]) => modes.map((m) => MODE_LABEL[m] ?? m).join(" + ");
const money = (v: string) => Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2 });
const due = (i: Inv) => Math.max(0, Number(i.totalAmount) - Number(i.amountPaid));
const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();

type Tab = "TODAY" | "DUE" | "ALL";

export default function BillingPage() {
  const [invs, setInvs] = useState<Inv[]>([]);
  const [tab, setTab] = useState<Tab>("TODAY");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const [pay, setPay] = useState<Inv | null>(null);
  const [payAmt, setPayAmt] = useState("");
  const [payMode, setPayMode] = useState<(typeof MODES)[number]>("CASH");
  const [payRef, setPayRef] = useState("");
  const [voiding, setVoiding] = useState<Inv | null>(null);
  const [voidReason, setVoidReason] = useState("");

  // ── REFUND ── the only screen in the ERP that takes cash OUT of the hospital.
  const [refunding, setRefunding] = useState<Inv | null>(null);
  const [refAmt, setRefAmt] = useState("");
  const [refMode, setRefMode] = useState<"CASH" | "UPI" | "CARD" | "NETBANKING">("CASH");
  const [refReason, setRefReason] = useState("");
  const [refBusy, setRefBusy] = useState(false);

  async function doRefund() {
    if (!refunding) return;
    setRefBusy(true); setErr(null);
    try {
      await api.post(`/reception/invoices/${refunding.id}/refund`, {
        amount: Number(refAmt),
        mode: refMode,
        reason: refReason.trim(),
      });
      setRefunding(null); setRefAmt(""); setRefReason("");
      await load();
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : "Could not refund.");
    } finally { setRefBusy(false); }
  }
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await api.get<{ invoices: Inv[] }>("/reception/billing"); setInvs(r.invoices); }
    catch (e) { setErr(e instanceof ApiClientError ? e.message : "Couldn't load bills."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    let rows = invs;
    if (tab === "TODAY") rows = rows.filter((i) => isToday(i.createdAt));
    if (tab === "DUE") rows = rows.filter((i) => due(i) > 0 && i.status !== "CANCELLED");
    const s = q.trim().toLowerCase();
    if (s) rows = rows.filter((i) =>
      i.receiptNo.toLowerCase().includes(s) ||
      i.patient.fullName.toLowerCase().includes(s) ||
      i.patient.displayId.toLowerCase().includes(s));
    return rows;
  }, [invs, tab, q]);

  /** What the desk hands over at end of shift. Counts only today's live money. */
  const till = useMemo(() => {
    const today = invs.filter((i) => isToday(i.createdAt) && i.status !== "CANCELLED");
    return {
      collected: today.reduce((s, i) => s + Number(i.amountPaid), 0),
      outstanding: today.reduce((s, i) => s + due(i), 0),
      bills: today.length,
    };
  }, [invs]);

  const counts = useMemo(() => ({
    TODAY: invs.filter((i) => isToday(i.createdAt)).length,
    DUE: invs.filter((i) => due(i) > 0 && i.status !== "CANCELLED").length,
    ALL: invs.length,
  }), [invs]);

  async function collect() {
    if (!pay) return;
    const amt = Number(payAmt);
    if (!amt || amt <= 0) return;
    setBusy(true); setErr(null);
    try {
      await api.post("/billing/payment", {
        invoiceId: pay.id, mode: payMode, amount: amt,
        reference: payRef.trim() || undefined,
      });
      setFlash(`₹${money(String(amt))} collected against ${pay.receiptNo}.`);
      setPay(null); setPayAmt(""); setPayRef(""); setPayMode("CASH");
      await load();
    } catch (e) { setErr(e instanceof ApiClientError ? e.message : "Could not record the payment."); }
    finally { setBusy(false); }
  }

  async function voidBill() {
    if (!voiding || voidReason.trim().length < 3) return;
    setBusy(true); setErr(null);
    try {
      await api.post(`/billing/invoice/${voiding.id}/cancel`, { reason: voidReason.trim() });
      setFlash(`${voiding.receiptNo} voided.`);
      setVoiding(null); setVoidReason("");
      await load();
    } catch (e) { setErr(e instanceof ApiClientError ? e.message : "Could not void the bill."); }
    finally { setBusy(false); }
  }

  const fld = "w-full rounded-lg border border-[var(--p-border)] bg-white px-3 py-2 text-sm text-[var(--p-ink)] outline-none focus:border-[var(--p-teal)]";
  const TABS: { k: Tab; label: string }[] = [
    { k: "TODAY", label: "Today" }, { k: "DUE", label: "Balance due" }, { k: "ALL", label: "All bills" },
  ];

  return (
    <PortalScroll>
      <div data-rise className="surface dotgrid mb-5 px-6 py-5">
        <h1 className="font-serif-p text-[22px] font-semibold text-[var(--p-ink)]">Billing</h1>
        <p className="mt-1 text-[14px] text-[var(--p-muted)]">
          Settle balances, reprint a receipt, void a wrong bill.
        </p>
      </div>

      {/* the till — what you hand over at the end of the shift */}
      <div data-rise className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="surface px-5 py-4">
          <div className="text-[12px] font-semibold uppercase tracking-wide text-[var(--p-muted)]">Collected today</div>
          <div className="mt-1 text-[24px] font-semibold text-[var(--p-ink)]">₹{money(String(till.collected))}</div>
          <div className="mt-0.5 text-[13px] text-[var(--p-muted)]">across {till.bills} bill{till.bills === 1 ? "" : "s"}</div>
        </div>
        <div className="surface px-5 py-4">
          <div className="text-[12px] font-semibold uppercase tracking-wide text-[var(--p-muted)]">Still owed today</div>
          <div className={`mt-1 text-[24px] font-semibold ${till.outstanding > 0 ? "text-[var(--p-rose)]" : "text-[var(--p-ink)]"}`}>
            ₹{money(String(till.outstanding))}
          </div>
          <div className="mt-0.5 text-[13px] text-[var(--p-muted)]">
            {counts.DUE > 0 ? `${counts.DUE} bill${counts.DUE === 1 ? "" : "s"} with a balance` : "everything settled"}
          </div>
        </div>
        <div className="surface flex items-center px-5 py-4">
          <p className="text-[13px] leading-relaxed text-[var(--p-muted)]">
            These are <b className="text-[var(--p-ink)]">today&apos;s live bills only</b> — voided ones are excluded, so this
            is what should physically be in the drawer.
          </p>
        </div>
      </div>

      <div data-rise className="mb-4 flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`flex items-center gap-2 rounded-lg border px-3.5 py-2 text-[14px] font-medium transition-colors ${
              tab === t.k ? "border-[var(--p-teal)] bg-[var(--p-teal)] text-white"
                : "border-[var(--p-border)] bg-white text-[var(--p-text)] hover:border-[var(--p-teal)]"}`}>
            {t.label}
            <span className={`rounded px-1.5 py-0.5 font-mono text-[12px] font-bold ${
              tab === t.k ? "bg-white/20" : t.k === "DUE" && counts.DUE > 0 ? "bg-[var(--p-rose-soft)] text-[var(--p-rose)]" : "bg-[var(--p-bg)] text-[var(--p-muted)]"}`}>
              {counts[t.k]}
            </span>
          </button>
        ))}
        <div className="surface ml-auto flex min-w-[240px] items-center gap-2 px-3.5 py-2">
          <Icon name="search" size={15} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Receipt or patient…" className="w-full bg-transparent text-sm outline-none" />
          {loading && <Spinner size={13} />}
        </div>
      </div>

      {flash && (
        <div data-rise className="mb-4 flex items-center justify-between rounded-lg border border-[var(--p-teal)]/30 bg-[var(--p-teal-soft)] px-4 py-3 text-[14px] font-medium text-[var(--p-teal-deep)]">
          <span className="flex items-center gap-2"><Icon name="check" size={15} /> {flash}</span>
          <button onClick={() => setFlash(null)}>✕</button>
        </div>
      )}
      {err && <div data-rise className="mb-4 rounded-lg border border-[var(--p-rose)]/25 bg-[var(--p-rose-soft)] px-4 py-3 text-[14px] text-[var(--p-rose)]">{err}</div>}

      <section data-rise className="surface overflow-hidden">
        {filtered.length === 0 && !loading ? (
          <p className="py-16 text-center text-[14px] text-[var(--p-muted)]">
            {tab === "DUE" ? "Nothing outstanding — every bill is settled." : "No bills here."}
          </p>
        ) : (
          <div className="divide-y divide-[var(--p-border)]">
            {filtered.map((i) => {
              const bal = due(i);
              const voided = i.status === "CANCELLED";
              return (
                <div key={i.id} className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 transition-colors hover:bg-[var(--p-bg)] ${voided ? "opacity-55" : ""}`}>
                  <div className="min-w-[190px] flex-1">
                    <div className="font-mono text-[14px] font-semibold text-[var(--p-ink)]">{i.receiptNo}</div>
                    <div className="truncate text-[13px] text-[var(--p-muted)]">
                      {i.patient.fullName} · <span className="font-mono">{i.patient.displayId}</span>
                    </div>
                  </div>

                  <span className="rounded bg-[var(--p-bg)] px-2 py-1 text-[12px] font-medium text-[var(--p-muted)]">
                    {SOURCE[i.source] ?? i.source}
                  </span>

                  <div className="w-[92px] text-right">
                    <div className="font-mono text-[14px] font-semibold text-[var(--p-ink)]">₹{money(i.totalAmount)}</div>
                    <div className="text-[11px] text-[var(--p-muted)]">total</div>
                  </div>
                  <div className="w-[92px] text-right">
                    <div className={`font-mono text-[14px] font-semibold ${bal > 0 && !voided ? "text-[var(--p-rose)]" : "text-[var(--p-muted)]"}`}>
                      ₹{money(String(bal))}
                    </div>
                    <div className="text-[11px] text-[var(--p-muted)]">due</div>
                  </div>

                  <Pill tone={statusTone(
                    i.status === "REFUNDED" ? "Cancelled" : voided ? "Cancelled" : bal > 0 ? "Pending" : "Paid"
                  )}>
                    {i.status === "REFUNDED" ? "Refunded" : voided ? "Voided" : bal > 0 ? "Part paid" : "Paid"}
                  </Pill>

                  {/* how it was paid — cash, UPI, or both (split) — across every portal's bills */}
                  {i.paymentModes.length > 0 && (
                    <span
                      title={i.paymentModes.length > 1 ? "Split payment" : "Payment type"}
                      className={`rounded px-2 py-1 text-[11px] font-semibold ${
                        i.paymentModes.length > 1
                          ? "bg-[var(--p-cyan-soft)] text-[var(--p-cyan-deep)]"
                          : "bg-[var(--p-teal-soft)] text-[var(--p-teal-deep)]"}`}>
                      {payLabel(i.paymentModes)}
                    </span>
                  )}

                  {Number(i.refunded) > 0 && i.status !== "REFUNDED" && (
                    <span className="rounded bg-[var(--p-amber-soft)] px-2 py-1 font-mono text-[11px] font-semibold text-[var(--p-amber)]">
                      −₹{money(i.refunded)} back
                    </span>
                  )}

                  <div className="flex items-center gap-2">
                    {/* Refund is only offered when there is money to give back.
                        A cancelled bill is the COMMON case — you void the visit,
                        then you return the fee. */}
                    {Number(i.refundable) > 0 && (
                      <button onClick={() => {
                        setRefunding(i);
                        setRefAmt(i.refundable);
                        setRefMode("CASH");
                        setRefReason("");
                      }}
                        title={`Up to ₹${money(i.refundable)} can be returned`}
                        className="rounded-lg border border-[var(--p-rose)]/40 px-3 py-1.5 text-[13px] font-semibold text-[var(--p-rose)] transition-colors hover:bg-[var(--p-rose-soft)]">
                        Refund
                      </button>
                    )}
                    {!voided && bal > 0 && (
                      <button onClick={() => { setPay(i); setPayAmt(String(bal)); setPayMode("CASH"); setPayRef(""); }}
                        className="rounded-lg bg-[var(--p-teal)] px-3 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-[var(--p-teal-deep)]">
                        Collect ₹{money(String(bal))}
                      </button>
                    )}
                    <a href={`/print/invoice/${i.id}`} target="_blank" rel="noopener noreferrer"
                      className="rounded-lg border border-[var(--p-border)] px-2.5 py-1.5 text-[13px] font-medium text-[var(--p-teal)] hover:border-[var(--p-teal)]">
                      Print
                    </a>
                    {!voided && (
                      <button onClick={() => { setVoiding(i); setVoidReason(""); }}
                        className="rounded-lg border border-[var(--p-border)] px-2.5 py-1.5 text-[13px] font-medium text-[var(--p-muted)] transition-colors hover:border-[var(--p-rose)] hover:text-[var(--p-rose)]">
                        Void
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* COLLECT */}
      {pay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="surface w-full max-w-sm bg-white">
            <div className="border-b border-[var(--p-border)] px-6 py-4">
              <h3 className="text-[14px] font-semibold text-[var(--p-ink)]">Collect payment</h3>
              <p className="mt-0.5 text-[13px] text-[var(--p-muted)]">
                {pay.patient.fullName} · <span className="font-mono">{pay.receiptNo}</span> · ₹{money(String(due(pay)))} outstanding
              </p>
            </div>
            <div className="space-y-4 p-6">
              <Field label="Amount (₹)">
                <input className={fld} value={payAmt} inputMode="decimal" autoFocus
                  onChange={(e) => setPayAmt(e.target.value.replace(/[^\d.]/g, ""))} />
              </Field>
              <Field label="Paid by">
                <div className="flex gap-2">
                  {MODES.map((m) => (
                    <button key={m} onClick={() => setPayMode(m)}
                      className={`flex-1 rounded-lg border px-3 py-2 text-[14px] font-medium transition-colors ${
                        payMode === m ? "border-[var(--p-teal)] bg-[var(--p-teal)] text-white"
                          : "border-[var(--p-border)] text-[var(--p-text)] hover:border-[var(--p-teal)]"}`}>
                      {m}
                    </button>
                  ))}
                </div>
              </Field>
              {payMode !== "CASH" && (
                <Field label="Reference (UPI / card ref)">
                  <input className={fld} value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="Optional" />
                </Field>
              )}
              {Number(payAmt) > due(pay) && (
                <p className="rounded-lg bg-[var(--p-amber-soft)] px-3 py-2 text-[12px] text-[#8a6414]">
                  That&apos;s more than the ₹{money(String(due(pay)))} outstanding. Check before you take the money.
                </p>
              )}
            </div>
            <div className="flex justify-end gap-3 border-t border-[var(--p-border)] p-5">
              <button onClick={() => setPay(null)} className="rounded-lg border border-[var(--p-border)] px-4 py-2 text-sm text-[var(--p-text)]">Cancel</button>
              <button onClick={collect} disabled={busy || !payAmt || Number(payAmt) <= 0}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--p-teal)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
                {busy ? <><Spinner /> Recording…</> : <><Icon name="check" size={15} /> Record ₹{payAmt || 0}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VOID */}
      {/* ─────────── REFUND ───────────
          The only screen that takes cash OUT of the hospital. The ceiling is
          shown, not merely enforced: a receptionist who can SEE that only ₹500
          was ever collected will not try to hand back ₹5,000. */}
      {refunding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setRefunding(null)}>
          <div onClick={(e) => e.stopPropagation()} className="surface w-full max-w-md overflow-hidden">
            <div className="border-b border-[var(--p-border)] bg-[var(--p-rose-soft)] px-5 py-4">
              <h3 className="flex items-center gap-2 text-[15px] font-semibold text-[var(--p-rose)]">
                <Icon name="alert" size={16} /> Give money back
              </h3>
              <p className="mt-0.5 text-[12px] text-[var(--p-text)]">
                <span className="font-mono font-semibold">{refunding.receiptNo}</span> · {refunding.patient.fullName}
              </p>
            </div>

            <div className="space-y-4 p-5">
              <div className="rounded-lg border border-[var(--p-border)] bg-[var(--p-bg)] px-4 py-3">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-[var(--p-muted)]">Collected on this bill</span>
                  <span className="font-mono font-semibold text-[var(--p-ink)]">₹{money(refunding.refundable)}</span>
                </div>
                {Number(refunding.refunded) > 0 && (
                  <div className="mt-1 flex items-center justify-between text-[12px]">
                    <span className="text-[var(--p-muted)]">Already returned</span>
                    <span className="font-mono text-[var(--p-amber)]">−₹{money(refunding.refunded)}</span>
                  </div>
                )}
                <p className="mt-2 text-[11px] leading-relaxed text-[var(--p-muted)]">
                  You cannot return more than was actually collected. Not from a voided bill,
                  not from a typo.
                </p>
              </div>

              <Field label="Amount to return">
                <div className="flex gap-2">
                  <input className={fld} value={refAmt} inputMode="decimal"
                    onChange={(e) => setRefAmt(e.target.value.replace(/[^\d.]/g, ""))} />
                  <button onClick={() => setRefAmt(refunding.refundable)}
                    className="shrink-0 rounded-lg border border-[var(--p-border)] px-3 text-[12px] font-medium text-[var(--p-text)] hover:border-[var(--p-teal)]">
                    All
                  </button>
                </div>
                {Number(refAmt) > Number(refunding.refundable) && (
                  <p className="mt-1 text-[12px] font-semibold text-[var(--p-rose)]">
                    That&apos;s more than was ever collected (₹{money(refunding.refundable)}).
                  </p>
                )}
              </Field>

              <Field label="How is it going back?">
                <div className="flex flex-wrap gap-2">
                  {(["CASH", "UPI", "CARD", "NETBANKING"] as const).map((m) => (
                    <button key={m} onClick={() => setRefMode(m)}
                      className={`rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                        refMode === m
                          ? "border-[var(--p-rose)] bg-[var(--p-rose)] text-white"
                          : "border-[var(--p-border)] text-[var(--p-text)] hover:border-[var(--p-rose)]"}`}>
                      {m}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] text-[var(--p-muted)]">
                  A UPI refund does not come out of the cash drawer — the day-close depends on this being right.
                </p>
              </Field>

              <Field label="Why? (goes on the record)">
                <input className={fld} value={refReason} onChange={(e) => setRefReason(e.target.value)}
                  placeholder="Visit cancelled · overcharged · procedure not done" />
              </Field>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[var(--p-border)] bg-[var(--p-bg)] px-5 py-3">
              <button onClick={() => setRefunding(null)}
                className="rounded-lg px-4 py-2 text-[13px] font-medium text-[var(--p-muted)] hover:text-[var(--p-ink)]">
                Cancel
              </button>
              <button onClick={doRefund}
                disabled={
                  refBusy ||
                  !(Number(refAmt) > 0) ||
                  Number(refAmt) > Number(refunding.refundable) ||
                  refReason.trim().length < 3
                }
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--p-rose)] px-4 py-2 text-[13px] font-semibold text-white transition-opacity disabled:opacity-40">
                {refBusy ? <><Spinner /> Returning…</> : <>Return ₹{money(refAmt || "0")}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {voiding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="surface w-full max-w-sm bg-white">
            <div className="border-b border-[var(--p-border)] px-6 py-4">
              <h3 className="text-[14px] font-semibold text-[var(--p-ink)]">Void this bill?</h3>
              <p className="mt-0.5 text-[13px] text-[var(--p-muted)]">
                <span className="font-mono">{voiding.receiptNo}</span> · ₹{money(voiding.totalAmount)} · {voiding.patient.fullName}
              </p>
            </div>
            <div className="space-y-3 p-6">
              <label className="block text-[13px] font-medium text-[var(--p-text)]">Why?</label>
              <input value={voidReason} onChange={(e) => setVoidReason(e.target.value)} autoFocus
                placeholder="Billed the wrong patient / duplicate…" className={fld} />
              <p className="rounded-lg bg-[var(--p-amber-soft)] px-3 py-2 text-[12px] leading-relaxed text-[#8a6414]">
                The bill is marked <b>cancelled</b>, not deleted — the receipt number stays used, which is what GST expects.
                {Number(voiding.amountPaid) > 0 && <> This bill already took <b>₹{money(voiding.amountPaid)}</b>; voiding it does <b>not</b> hand the cash back.</>}
              </p>
            </div>
            <div className="flex justify-end gap-3 border-t border-[var(--p-border)] p-5">
              <button onClick={() => setVoiding(null)} className="rounded-lg border border-[var(--p-border)] px-4 py-2 text-sm text-[var(--p-text)]">Keep it</button>
              <button onClick={voidBill} disabled={busy || voidReason.trim().length < 3}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--p-rose)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
                {busy ? <><Spinner /> Voiding…</> : "Void bill"}
              </button>
            </div>
          </div>
        </div>
      )}
    </PortalScroll>
  );
}
