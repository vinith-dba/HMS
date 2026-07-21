"use client";

import { useEffect, useState } from "react";
import { PrimaryButton } from "@/components/portal/ui/primitives";
import { Icon } from "@/components/portal/ui/icons";
import { Spinner } from "@/components/portal/ui/form-atoms";
import { PortalScroll } from "@/components/portal/portal-scroll";
import { api, ApiClientError } from "@/lib/api-client";
import { DispenseScratchpad, type PadLine } from "@/components/portal/pharmacy/scratchpad";
import { DiscountInput, PaymentSection, type Tender } from "@/components/portal/ui/bill-fields";

interface Patient { id: string; displayId: string; fullName: string; phone: string; }
interface Med { id: string; name: string; unit: string; gstRatePct: string; inStock: number; mrp: string | null; nearestExpiry: string | null;  courseCritical: boolean; }
type Line = PadLine;

export default function DispensePage() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Patient[]>([]);
  const [patient, setPatient] = useState<Patient | null>(null);

  const [meds, setMeds] = useState<Med[]>([]);
  const [search, setSearch] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [disc, setDisc] = useState(0);
  const [shortReason, setShortReason] = useState("");
  const [payNow, setPayNow] = useState(true);
  const [payments, setPayments] = useState<Tender[]>([]);
  const [payValid, setPayValid] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // An admitted patient's medicines are charged to their room, so there is no
  // receipt at the counter. Both outcomes must be renderable.
  const [done, setDone] = useState<{ receiptNo: string; total: string } | null>(null);
  const [toRoom, setToRoom] = useState<{ ipNumber: string } | null>(null);

  useEffect(() => {
    api.get<{ medicines: Med[] }>(`/pharmacy/medicines${search ? `?q=${encodeURIComponent(search)}` : ""}`)
      .then((r) => setMeds(r.medicines)).catch(() => setMeds([]));
  }, [search]);

  useEffect(() => {
    if (patient || !q.trim()) { setResults([]); return; }
    const t = setTimeout(() => {
      api.get<{ patients: Patient[] }>(`/reception/patients?q=${encodeURIComponent(q)}&limit=6`)
        .then((r) => setResults(r.patients)).catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q, patient]);

  function add(m: Med) {
    if (m.inStock === 0) return;
    setLines((p) => p.some((l) => l.medicineId === m.id)
      ? p.map((l) => l.medicineId === m.id ? { ...l, qty: Math.min(l.qty + 1, m.inStock) } : l)
      : [...p, { medicineId: m.id, name: m.name, unit: m.unit, qty: 1, mrp: Number(m.mrp ?? 0), gst: Number(m.gstRatePct), inStock: m.inStock, prescribedQty: 0, perDay: 0, courseCritical: m.courseCritical, locked: m.courseCritical }]);
  }

  const subtotal = lines.reduce((s, l) => s + l.qty * l.mrp, 0);
  const gst = lines.reduce((s, l) => s + (l.qty * l.mrp * (subtotal > 0 ? 1 - disc / subtotal : 1) * l.gst) / 100, 0);
  const total = subtotal - disc + gst;

  async function submit() {
    if (!patient || !lines.length) return;
    setBusy(true); setError(null);
    try {
      const res = await api.post<{ chargedToRoom: boolean; ipNumber: string | null; invoice: { receiptNo: string; totalAmount: string } | null }>("/pharmacy/dispense", {
        patientId: patient.id,
        items: lines.map((l) => ({ medicineId: l.medicineId, qty: l.qty })),
        discountAmount: disc || undefined,
        payments: payNow && payments.length ? payments : undefined,
      });
      if (res.chargedToRoom) setToRoom({ ipNumber: res.ipNumber ?? "" });
      else if (res.invoice) setDone({ receiptNo: res.invoice.receiptNo, total: res.invoice.totalAmount });
    } catch (e) { setError(e instanceof ApiClientError ? e.message : "Could not dispense."); }
    finally { setBusy(false); }
  }

  function reset() { setDone(null); setToRoom(null); setPatient(null); setLines([]); setQ(""); setDisc(0); setPayments([]); setPayValid(true); setShortReason(""); setError(null); }

  if (toRoom) {
    return (
      <div className="mx-auto max-w-md">
        <div className="surface flex flex-col items-center p-8 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--p-blue-soft)] text-[var(--p-blue-deep)]"><Icon name="bed" size={26} /></span>
          <h3 className="mt-4 font-serif-p text-[22px] font-semibold text-[var(--p-ink)]">Charged to the room</h3>
          <p className="mt-1 text-[13px] text-[var(--p-muted)]">
            Admitted patient — <span className="font-mono font-semibold text-[var(--p-ink)]">{toRoom.ipNumber}</span>
          </p>
          <p className="mt-4 rounded-lg bg-[var(--p-amber-soft)] px-4 py-2.5 text-left text-[12px] leading-relaxed text-[#8a6414]">
            <b>Do not take money.</b> These medicines are on the patient&apos;s room tab and settle in the
            discharge bill. No receipt is printed here.
          </p>
          <p className="mt-2 text-[12px] text-[var(--p-muted)]">Stock decremented FEFO.</p>
          <div className="mt-6"><PrimaryButton onClick={reset}><Icon name="plus" size={15} /> New sale</PrimaryButton></div>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="mx-auto max-w-md">
        <div className="surface flex flex-col items-center p-8 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--p-cyan-soft)] text-[var(--p-cyan-deep)]"><Icon name="check" size={26} /></span>
          <h3 className="mt-4 font-serif-p text-[22px] font-semibold text-[var(--p-ink)]">Dispensed</h3>
          <p className="mt-1 text-[13px] text-[var(--p-muted)]">Receipt <span className="font-mono font-semibold text-[var(--p-ink)]">{done.receiptNo}</span> · ₹{done.total}</p>
          <div className="mt-6"><PrimaryButton onClick={reset}><Icon name="plus" size={15} /> New sale</PrimaryButton></div>
        </div>
      </div>
    );
  }

  return (
    <PortalScroll>
      <div data-rise className="surface dotgrid mb-6 px-6 py-5">
        <h1 className="font-serif-p text-[22px] font-semibold text-[var(--p-ink)]">Dispense medicines</h1>
        <p className="mt-1 text-[13px] text-[var(--p-muted)]">Counter sale. For a doctor&apos;s prescription, use the queue so it&apos;s linked to the scan.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <section data-rise className="surface overflow-hidden">
            <div className="border-b border-[var(--p-border)] px-6 py-4"><h3 className="text-[14px] font-semibold text-[var(--p-ink)]">1 · Patient</h3></div>
            <div className="p-6">
              {!patient ? (
                <>
                  <div className="flex items-center gap-2 rounded-lg border border-[var(--p-border)] px-3.5 py-2.5">
                    <Icon name="search" size={16} />
                    <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or JMH2026OP00123…" className="w-full text-sm outline-none" />
                  </div>
                  {results.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {results.map((p) => (
                        <button key={p.id} onClick={() => { setPatient(p); setQ(""); }} className="surface-hover flex w-full items-center justify-between rounded-lg border border-[var(--p-border)] p-3 text-left">
                          <div><div className="text-[13px] font-medium text-[var(--p-ink)]">{p.fullName}</div><div className="text-[11px] text-[var(--p-muted)]"><span className="tabular">{p.displayId}</span> · {p.phone}</div></div>
                          <Icon name="chevron" size={16} />
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center justify-between rounded-xl border border-[var(--p-blue)] bg-[var(--p-blue-soft)] p-4">
                  <div><div className="text-[14px] font-semibold text-[var(--p-ink)]">{patient.fullName}</div><div className="text-[11px] text-[var(--p-muted)]"><span className="tabular">{patient.displayId}</span> · {patient.phone}</div></div>
                  <button onClick={() => setPatient(null)} className="rounded-lg border border-[var(--p-border)] bg-white px-3 py-1.5 text-[12px] font-medium text-[var(--p-blue)]">Change</button>
                </div>
              )}
            </div>
          </section>

          <section data-rise className={`surface overflow-hidden ${patient ? "" : "pointer-events-none opacity-55"}`}>
            <div className="flex items-center justify-between border-b border-[var(--p-border)] px-6 py-4">
              <h3 className="text-[14px] font-semibold text-[var(--p-ink)]">2 · Medicines</h3>
              <span className="badge">{lines.length} added</span>
            </div>
            <div className="p-6">
              <div className="mb-3 flex items-center gap-2 rounded-lg border border-[var(--p-border)] px-3.5 py-2.5">
                <Icon name="search" size={15} />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search medicines…" className="w-full text-sm outline-none" />
              </div>
              <div className="max-h-64 space-y-1 overflow-y-auto overscroll-contain">
                {meds.map((m) => (
                  <button key={m.id} onClick={() => add(m)} disabled={m.inStock === 0}
                    className="flex w-full items-center justify-between rounded-lg border border-[var(--p-border)] p-2.5 text-left transition-colors hover:border-[var(--p-blue)] disabled:opacity-40">
                    <div>
                      <div className="rx-name text-[13px] font-medium text-[var(--p-ink)]">{m.name}</div>
                      <div className="text-[11px] text-[var(--p-muted)]">
                        {m.inStock === 0 ? "Out of stock" : `${m.inStock} in stock`}{m.nearestExpiry && ` · exp ${m.nearestExpiry}`} · GST {m.gstRatePct}%
                      </div>
                    </div>
                    <span className="font-mono text-[12px]">{m.mrp ? `₹${m.mrp}` : "—"}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>

        <aside data-rise className="lg:sticky lg:top-24 lg:self-start">
          <div className="surface overflow-hidden">
            <div className="border-b border-[var(--p-border)] px-5 py-4"><p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--p-ink)]">Bill</p></div>
            <div className="max-h-56 divide-y divide-[var(--p-border)] overflow-y-auto overscroll-contain">
              {lines.length === 0 ? <p className="px-5 py-8 text-center text-[12px] text-[var(--p-muted)]">No medicines added.</p> : lines.map((l) => (
                <div key={l.medicineId} className="flex items-center gap-2 px-5 py-2.5">
                  <div className="flex-1"><div className="rx-name text-[12px] text-[var(--p-ink)]">{l.name}</div><div className="text-[10px] text-[var(--p-muted)]">₹{l.mrp} · GST {l.gst}%</div></div>
                  <input type="number" min={1} max={l.inStock} value={l.qty}
                    onChange={(e) => setLines((p) => p.map((x) => x.medicineId === l.medicineId ? { ...x, qty: Math.max(1, Math.min(Number(e.target.value), x.inStock)) } : x))}
                    className="w-12 rounded border border-[var(--p-border)] px-1 py-0.5 text-center text-[11px] outline-none" />
                  <button onClick={() => setLines((p) => p.filter((x) => x.medicineId !== l.medicineId))} className="text-[var(--p-rose)]">✕</button>
                </div>
              ))}
            </div>
            <div className="space-y-3 border-t border-[var(--p-border)] p-5">
              <DiscountInput subtotal={subtotal} accent="blue" onChange={(d) => setDisc(d.amount)} />
              <label className="flex items-center gap-2 text-[13px] text-[var(--p-text)]">
                <input type="checkbox" checked={payNow} onChange={(e) => setPayNow(e.target.checked)} className="h-4 w-4 accent-[var(--p-blue)]" /> Collect payment now
              </label>
              {payNow && (
                <PaymentSection total={total} accent="blue" onChange={(r) => { setPayments(r.payments); setPayValid(r.valid); }} />
              )}
              {lines.length > 0 && (
                <div className="border-t border-[var(--p-border)] pt-3">
                  <DispenseScratchpad
                    lines={lines} discount={disc} onChange={setLines}
                    reason={shortReason} onReasonChange={setShortReason}
                  />
                </div>
              )}

              <div className="space-y-1 border-t border-[var(--p-border)] pt-3 text-[13px]">
                <div className="flex justify-between"><span className="text-[var(--p-muted)]">Subtotal</span><span className="font-mono">₹{subtotal.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-[var(--p-muted)]">GST</span><span className="font-mono">₹{gst.toFixed(2)}</span></div>
                <div className="flex justify-between pt-1"><span className="font-semibold text-[var(--p-ink)]">Total</span><span className="font-mono text-[15px] font-semibold text-[var(--p-blue)]">₹{total.toFixed(2)}</span></div>
              </div>
            </div>
            {error && <div className="border-t border-[var(--p-border)] bg-[var(--p-rose-soft)] px-5 py-3 text-[12px] text-[var(--p-rose)]">{error}</div>}
            <div className="border-t border-[var(--p-border)] p-5">
              <PrimaryButton onClick={submit} disabled={!patient || lines.length === 0 || busy || (payNow && !payValid)} full>
                {busy ? <><Spinner /> Dispensing…</> : <><Icon name="pill" size={15} /> Dispense &amp; bill</>}
              </PrimaryButton>
              <p className="mt-2 text-center text-[10px] text-[var(--p-muted)]">Medicines are taxable (5%/12%). Batches picked FEFO.</p>
            </div>
          </div>
        </aside>
      </div>
    </PortalScroll>
  );
}
