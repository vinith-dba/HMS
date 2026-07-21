"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PrimaryButton, Pill } from "@/components/portal/ui/primitives";
import { Icon } from "@/components/portal/ui/icons";
import { Spinner, Field } from "@/components/portal/ui/form-atoms";
import { DiscountInput, PaymentSection, type Tender } from "@/components/portal/ui/bill-fields";
import { PortalScroll } from "@/components/portal/portal-scroll";
import { api, ApiClientError } from "@/lib/api-client";

interface Inpatient {
  bedCharge: string; extrasCharge: string; extras: number;
  id: string; ipNumber: string; admittedAt: string; days: number;
  ward: string; bedNo: string; dailyCharge: string; runningCharge: string;
  reason: string | null; attendantName: string | null; attendantPhone: string | null;
  doctor: { name: string; department: string };
  patient: { displayId: string; fullName: string; age: number | null; gender: string | null; phone: string };
}

export default function InpatientsPage() {
  const [rows, setRows] = useState<Inpatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dischargeOf, setDischargeOf] = useState<Inpatient | null>(null);
  const [disc, setDisc] = useState(0);
  const [payNow, setPayNow] = useState(true);
  const [payments, setPayments] = useState<Tender[]>([]);
  const [payValid, setPayValid] = useState(true);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ ipNumber: string; days: number; receiptNo: string; total: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await api.get<{ inpatients: Inpatient[] }>("/ipd/admissions"); setRows(r.inpatients); }
    catch (e) { setError(e instanceof ApiClientError ? e.message : "Couldn't load inpatients."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const bedSubtotal = dischargeOf ? dischargeOf.days * Number(dischargeOf.dailyCharge) : 0;
  const est = Math.max(0, bedSubtotal - disc);

  async function discharge() {
    if (!dischargeOf) return;
    setBusy(true); setError(null);
    try {
      const res = await api.post<{ ipNumber: string; days: number; invoice: { receiptNo: string; totalAmount: string } }>(
        `/ipd/admissions/${dischargeOf.id}/discharge`,
        {
          discountAmount: disc || undefined,
          payments: payNow && payments.length ? payments : undefined,
          notes: notes || undefined,
        }
      );
      setDone({ ipNumber: res.ipNumber, days: res.days, receiptNo: res.invoice.receiptNo, total: res.invoice.totalAmount });
      await load();
    } catch (e) { setError(e instanceof ApiClientError ? e.message : "Could not discharge."); }
    finally { setBusy(false); }
  }

  function closeModal() { setDischargeOf(null); setDisc(0); setPayments([]); setPayValid(true); setNotes(""); setPayNow(true); setDone(null); setError(null); }

  const fld = "w-full rounded-lg border border-[var(--p-border)] bg-white px-3 py-2 text-sm text-[var(--p-ink)] outline-none focus:border-[var(--p-blue)]";

  return (
    <PortalScroll>
      <div data-rise className="surface dotgrid mb-6 flex flex-wrap items-center justify-between gap-4 px-6 py-5">
        <div>
          <h1 className="font-serif-p text-[22px] font-semibold text-[var(--p-ink)]">Inpatients</h1>
          <p className="mt-1 text-[14px] text-[var(--p-muted)]">Everyone currently in a bed, with the stay charge running.</p>
        </div>
        <Link href="/ipd" className="inline-flex items-center gap-2 rounded-lg border border-[var(--p-border)] px-4 py-2.5 text-sm font-medium text-[var(--p-blue)] hover:border-[var(--p-blue)]">
          <Icon name="bed" size={15} /> Bed board
        </Link>
      </div>

      {error && !dischargeOf && <div data-rise className="mb-4 rounded-lg border border-[var(--p-rose)]/25 bg-[var(--p-rose-soft)] px-4 py-3 text-[14px] text-[var(--p-rose)]">{error}</div>}

      <section data-rise className="surface overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-[14px] text-[var(--p-muted)]"><Spinner /> Loading…</div>
        ) : rows.length === 0 ? (
          <p className="py-16 text-center text-[14px] text-[var(--p-muted)]">No one is admitted right now.</p>
        ) : (
          <div className="divide-y divide-[var(--p-border)]">
            {rows.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[14px] font-semibold text-[var(--p-ink)]">{r.patient.fullName}</span>
                    <span className="font-mono text-[12px] text-[var(--p-blue)]">{r.ipNumber}</span>
                    <Pill tone="checkedin">{r.ward} · {r.bedNo}</Pill>
                  </div>
                  <div className="mt-1 text-[13px] text-[var(--p-muted)]">
                    <span className="tabular">{r.patient.displayId}</span>
                    {r.patient.age != null && ` · ${r.patient.age}y`}
                    {" · "}{r.doctor.name}
                    {r.reason && ` · ${r.reason}`}
                  </div>
                  {r.attendantName && (
                    <div className="mt-0.5 text-[12px] text-[var(--p-muted)]">
                      Attendant: {r.attendantName}{r.attendantPhone && ` · ${r.attendantPhone}`}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="font-mono text-[14px] font-semibold text-[var(--p-ink)] tabular">₹{r.runningCharge}</div>
                    <div className="text-[12px] text-[var(--p-muted)]">
                      bed ₹{r.bedCharge} ({r.days}d)
                      {r.extras > 0 && <> + {r.extras} charge{r.extras === 1 ? "" : "s"} ₹{r.extrasCharge}</>}
                    </div>
                  </div>
                  <Link href={`/ipd/${r.id}`}
                    className="rounded-lg border border-[var(--p-border)] px-3 py-2 text-[13px] font-medium text-[var(--p-blue)] hover:border-[var(--p-blue)]">
                    Open sheet
                  </Link>
                  <button onClick={() => setDischargeOf(r)}
                    className="btn-primary rounded-lg px-3.5 py-2 text-[13px] font-semibold text-white">
                    Discharge
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ---------- DISCHARGE MODAL ---------- */}
      {dischargeOf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="surface w-full max-w-md overflow-hidden bg-white">
            <div className="flex items-center justify-between border-b border-[var(--p-border)] px-6 py-4">
              <div>
                <h3 className="text-[15px] font-semibold text-[var(--p-ink)]">Discharge {dischargeOf.patient.fullName}</h3>
                <p className="text-[13px] text-[var(--p-muted)]"><span className="font-mono">{dischargeOf.ipNumber}</span> · {dischargeOf.ward} · {dischargeOf.bedNo}</p>
              </div>
              <button onClick={closeModal} className="text-[var(--p-muted)] hover:text-[var(--p-ink)]">✕</button>
            </div>

            {done ? (
              <div className="flex flex-col items-center px-6 py-12 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--p-cyan-soft)] text-[var(--p-cyan-deep)]"><Icon name="check" size={26} /></span>
                <h3 className="mt-4 font-serif-p text-[22px] font-semibold text-[var(--p-ink)]">Discharged</h3>
                <p className="mt-1 text-[14px] text-[var(--p-muted)]">
                  {done.days} day{done.days > 1 ? "s" : ""} · Receipt <span className="font-mono font-semibold text-[var(--p-ink)]">{done.receiptNo}</span> · ₹{done.total}
                </p>
                <p className="mt-1 text-[13px] text-[var(--p-muted)]">The bed is free again on the board.</p>
                <div className="mt-6"><PrimaryButton onClick={closeModal}>Done</PrimaryButton></div>
              </div>
            ) : (
              <>
                <div className="space-y-4 p-6">
                  <div className="rounded-xl border border-[var(--p-border)] bg-[var(--p-bg)] p-4 text-[14px]">
                    <div className="flex justify-between"><span className="text-[var(--p-muted)]">Stay</span><span className="font-mono tabular">{dischargeOf.days} day{dischargeOf.days > 1 ? "s" : ""} × ₹{dischargeOf.dailyCharge}</span></div>
                    <div className="mt-1 flex justify-between"><span className="text-[var(--p-muted)]">Bed charges</span><span className="font-mono tabular">₹{dischargeOf.runningCharge}</span></div>
                    <div className="mt-2 flex justify-between border-t border-[var(--p-border)] pt-2">
                      <span className="font-semibold text-[var(--p-ink)]">To bill now</span>
                      <span className="font-mono text-[15px] font-semibold text-[var(--p-blue)] tabular">₹{est.toFixed(2)}</span>
                    </div>
                    <p className="mt-2 text-[12px] leading-relaxed text-[var(--p-muted)]">Lab and pharmacy bills were already raised during the stay — this invoice is bed charges only.</p>
                  </div>

                  <DiscountInput subtotal={bedSubtotal} accent="blue" onChange={(d) => setDisc(d.amount)} />

                  <label className="flex items-center gap-2 text-[14px] text-[var(--p-text)]">
                    <input type="checkbox" checked={payNow} onChange={(e) => setPayNow(e.target.checked)} className="h-4 w-4 accent-[var(--p-blue)]" /> Collect payment now
                  </label>
                  {payNow && (
                    <PaymentSection total={est} accent="blue" onChange={(r) => { setPayments(r.payments); setPayValid(r.valid); }} />
                  )}

                  <Field label="Discharge notes"><textarea className={`${fld} min-h-[56px] resize-y`} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Condition on discharge, advice…" /></Field>
                </div>

                {error && <div className="border-t border-[var(--p-border)] bg-[var(--p-rose-soft)] px-6 py-2.5 text-[13px] text-[var(--p-rose)]">{error}</div>}

                <div className="flex justify-end gap-3 border-t border-[var(--p-border)] p-5">
                  <button onClick={closeModal} className="rounded-lg border border-[var(--p-border)] px-4 py-2 text-sm text-[var(--p-text)]">Cancel</button>
                  <PrimaryButton onClick={discharge} disabled={busy || (payNow && !payValid)}>
                    {busy ? <><Spinner /> Discharging…</> : <><Icon name="check" size={15} /> Discharge &amp; bill</>}
                  </PrimaryButton>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </PortalScroll>
  );
}
