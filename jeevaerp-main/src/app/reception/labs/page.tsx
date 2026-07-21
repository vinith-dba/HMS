"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Icon } from "@/components/portal/ui/icons";
import { Spinner } from "@/components/portal/ui/form-atoms";
import { PortalScroll } from "@/components/portal/portal-scroll";
import { api, ApiClientError } from "@/lib/api-client";
import { AdmissionBanner, useAdmission } from "@/components/portal/reception/admission-banner";
import { InpatientPicker } from "@/components/portal/reception/inpatient-picker";
import { DiscountInput, PaymentSection, type Tender } from "@/components/portal/ui/bill-fields";

interface Patient { id: string; displayId: string; fullName: string; age: number | null; gender: string | null; phone: string; }
interface CatalogItem { id: string; name: string; code: string | null; price: string; gstRatePct: string; }
interface Visit { id: string; opNumber: string; doctorName: string; visitDate: string; }
interface Ordered { id: string; testName: string; priceAtOrder: string | null; billed: boolean; }

const money = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2 });

/** ?patient=JMH… — same deep-link contract as every other reception page. */
function PatientFromUrl({ onFound }: { onFound: (p: Patient) => void }) {
  const params = useSearchParams();
  useEffect(() => {
    const pid = params.get("patient");
    if (!pid) return;
    api.get<{ patient: Patient }>(`/reception/patients/${encodeURIComponent(pid)}`)
      .then((r) => onFound(r.patient)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

export default function LabOrderPage() {
  const [patient, setPatient] = useState<Patient | null>(null);
  const { admission, checking: checkingAdm } = useAdmission(patient?.id);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Patient[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [catQ, setCatQ] = useState("");
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [visits, setVisits] = useState<Visit[]>([]);
  const [visitId, setVisitId] = useState<string>("");

  const [billNow, setBillNow] = useState(true);
  const [labDisc, setLabDisc] = useState(0);
  const [payments, setPayments] = useState<Tender[]>([]);
  const [payValid, setPayValid] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ tests: Ordered[]; invoice?: { id: string; receiptNo: string; totalAmount: string } } | null>(null);

  useEffect(() => {
    api.get<{ catalog: CatalogItem[] }>("/labs/catalog").then((r) => setCatalog(r.catalog)).catch(() => {});
  }, []);

  // patient search
  useEffect(() => {
    if (patient || !q.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const { patients } = await api.get<{ patients: Patient[] }>(`/reception/patients?q=${encodeURIComponent(q)}&limit=6`);
        setResults(patients);
      } catch { setResults([]); }
    }, 250);
    return () => clearTimeout(t);
  }, [q, patient]);

  // a lab test is usually ordered off a doctor's chit — link it to that visit if there is one
  useEffect(() => {
    if (!patient) { setVisits([]); setVisitId(""); return; }
    api.get<{ visits: Visit[] }>(`/reception/patients/${patient.displayId}/completed-visits`)
      .then((r) => setVisits(r.visits)).catch(() => setVisits([]));
  }, [patient]);

  const shownCatalog = useMemo(() => {
    const s = catQ.trim().toLowerCase();
    if (!s) return catalog;
    return catalog.filter((c) => c.name.toLowerCase().includes(s) || (c.code ?? "").toLowerCase().includes(s));
  }, [catalog, catQ]);

  const chosen = useMemo(() => catalog.filter((c) => picked[c.id]), [catalog, picked]);
  const total = useMemo(() => chosen.reduce((s, c) => s + Number(c.price), 0), [chosen]);
  const collect = Math.max(0, total - labDisc);
  const paidModes = payments.map((p) => p.mode).join(" + ");
  // Diagnostics are GST-exempt in India — the total the patient pays IS the sum of prices.
  const anyTaxable = chosen.some((c) => Number(c.gstRatePct) > 0);

  const reset = useCallback(() => {
    setPatient(null); setQ(""); setResults([]); setPicked({});
    setVisits([]); setVisitId(""); setDone(null); setErr(null); setBillNow(true); setLabDisc(0); setPayments([]); setPayValid(true);
  }, []);

  async function submit() {
    if (!patient || chosen.length === 0) return;
    setBusy(true); setErr(null);
    try {
      const tests = await api.post<{ tests: Ordered[] }>("/labs/tests/order", {
        patientId: patient.id,
        catalogIds: chosen.map((c) => c.id),
        appointmentId: visitId || undefined,
      });

      // INPATIENT: orderTests already posted these to the room tab. Raising a
      // counter invoice here would bill the same blood draw twice — once now,
      // once at discharge. So we hard-stop, regardless of the "bill now" toggle.
      if (admission) { setDone({ tests: tests.tests }); return; }

      if (!billNow) { setDone({ tests: tests.tests }); return; }

      const bill = await api.post<{ invoice: { id: string; receiptNo: string; totalAmount: string } }>("/labs/bill", {
        patientId: patient.id,
        labTestIds: tests.tests.map((t) => t.id),
        discountAmount: labDisc || undefined,
        payments: payments.length ? payments : undefined,
      });
      setDone({ tests: tests.tests, invoice: bill.invoice });
    } catch (e) { setErr(e instanceof ApiClientError ? e.message : "Could not order the tests."); }
    finally { setBusy(false); }
  }

  // ---- success ----
  if (done) {
    return (
      <PortalScroll>
        <div data-rise className="surface mx-auto max-w-lg overflow-hidden">
          <div className="flex flex-col items-center px-6 py-8 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-[var(--p-teal-soft)] text-[var(--p-teal)]"><Icon name="check" size={22} /></span>
            <h2 className="mt-3 font-serif-p text-[19px] font-semibold text-[var(--p-ink)]">
              {done.tests.length} test{done.tests.length === 1 ? "" : "s"} ordered
            </h2>
            <p className="mt-1 text-[14px] text-[var(--p-muted)]">
              They&apos;re in the lab&apos;s queue now. The lab uploads the report when it&apos;s ready.
            </p>

            <div className="mt-5 w-full space-y-1.5 text-left">
              {done.tests.map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-lg border border-[var(--p-border)] px-3.5 py-2 text-[14px]">
                  <span className="text-[var(--p-ink)]">{t.testName}</span>
                  <span className="font-mono text-[var(--p-muted)]">₹{t.priceAtOrder ?? "—"}</span>
                </div>
              ))}
            </div>

            {done.invoice ? (
              <div className="mt-4 w-full rounded-lg bg-[var(--p-teal-soft)] px-4 py-3 text-left">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-[var(--p-teal-deep)]">Receipt</span>
                  <span className="font-mono text-[14px] font-semibold text-[var(--p-teal-deep)]">{done.invoice.receiptNo}</span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-[13px] text-[var(--p-teal-deep)]">Paid{paidModes ? ` (${paidModes})` : ""}</span>
                  <span className="font-mono text-[14px] font-semibold text-[var(--p-teal-deep)]">₹{done.invoice.totalAmount}</span>
                </div>
              </div>
            ) : (
              <p className="mt-4 w-full rounded-lg bg-[var(--p-amber-soft)] px-4 py-2.5 text-left text-[13px] text-[#8a6414]">
                <b>Not billed yet.</b> Collect payment from <b>Billing</b>, or the lab can bill it.
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-3 border-t border-[var(--p-border)] p-5">
            {done.invoice && (
              <a href={`/print/invoice/${done.invoice.id}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--p-teal)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--p-teal-deep)]">
                <Icon name="receipt" size={15} /> Print bill
              </a>
            )}
            <button onClick={reset} className="inline-flex items-center gap-2 rounded-lg border border-[var(--p-border)] px-4 py-2.5 text-sm font-medium text-[var(--p-text)] hover:border-[var(--p-teal)] hover:text-[var(--p-teal)]">
              <Icon name="plus" size={14} /> Order for someone else
            </button>
            <a href="/" className="inline-flex items-center gap-2 rounded-lg border border-[var(--p-border)] px-4 py-2.5 text-sm font-medium text-[var(--p-text)] hover:border-[var(--p-teal)] hover:text-[var(--p-teal)]">
              Back to today
            </a>
          </div>
        </div>
      </PortalScroll>
    );
  }

  return (
    <PortalScroll>
      <Suspense fallback={null}>
        <PatientFromUrl onFound={(p) => setPatient(p)} />
      </Suspense>

      <div data-rise className="surface dotgrid mb-5 px-6 py-5">
        <h1 className="font-serif-p text-[22px] font-semibold text-[var(--p-ink)]">Lab tests</h1>
        <p className="mt-1 max-w-[600px] text-[14px] leading-relaxed text-[var(--p-muted)]">
          Patient walks up with the doctor&apos;s chit — pick the tests, take the money, send it to the lab. One counter, one trip.
        </p>
      </div>

      {err && <div data-rise className="mb-4 rounded-lg border border-[var(--p-rose)]/25 bg-[var(--p-rose-soft)] px-4 py-3 text-[14px] text-[var(--p-rose)]">{err}</div>}

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          {/* 1 — patient */}
          <InpatientPicker
            pickedPatientId={patient?.id}
            onPick={(ip) => {
              setPatient(ip.patient);   // the picker already carries age + gender
              setQ("");
              setResults([]);
              setVisitId("");           // inpatient tests file to the STAY
            }}
          />

          <section data-rise className="surface overflow-hidden">
            <div className="border-b border-[var(--p-border)] px-5 py-3.5">
              <h3 className="text-[14px] font-semibold text-[var(--p-ink)]">1 · Who is it for?</h3>
            </div>
            <div className="p-5">
              {patient ? (
                <div className="flex items-center justify-between rounded-lg border border-[var(--p-teal)]/30 bg-[var(--p-teal-soft)] px-4 py-3">
                  <div>
                    <div className="text-[14px] font-semibold text-[var(--p-ink)]">{patient.fullName}</div>
                    <div className="text-[13px] text-[var(--p-muted)]">
                      <span className="font-mono">{patient.displayId}</span> · {patient.phone}
                      {patient.age != null && ` · ${patient.age}y`}
                    </div>
                  </div>
                  <button onClick={() => { setPatient(null); setQ(""); }} className="text-[13px] font-medium text-[var(--p-teal-deep)] underline underline-offset-2">Change</button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 rounded-lg border border-[var(--p-border)] px-3.5 py-2.5">
                    <Icon name="search" size={16} />
                    <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus
                      placeholder="Patient ID, name or phone…" className="w-full bg-transparent text-sm outline-none" />
                  </div>
                  {results.length > 0 && (
                    <div className="mt-2 divide-y divide-[var(--p-border)] rounded-lg border border-[var(--p-border)]">
                      {results.map((p) => (
                        <button key={p.id} onClick={() => { setPatient(p); setResults([]); }}
                          className="flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors hover:bg-[var(--p-bg)]">
                          <span className="text-[14px] font-medium text-[var(--p-ink)]">{p.fullName}</span>
                          <span className="font-mono text-[12px] text-[var(--p-muted)]">{p.displayId}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}

              {patient && visits.length > 0 && (
                <div className="mt-4">
                  <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-[var(--p-muted)]">
                    Which consultation ordered these? <span className="font-normal normal-case">(optional)</span>
                  </label>
                  <select value={visitId} onChange={(e) => setVisitId(e.target.value)}
                    className="w-full rounded-lg border border-[var(--p-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--p-teal)]">
                    <option value="">Walk-in — no consultation</option>
                    {visits.map((v) => (
                      <option key={v.id} value={v.id}>{v.visitDate} · {v.doctorName} · {v.opNumber}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </section>

          {/* 2 — tests */}
          {patient && <AdmissionBanner admission={admission} checking={checkingAdm} what="These tests" />}

          <section data-rise className="surface overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--p-border)] px-5 py-3.5">
              <h3 className="text-[14px] font-semibold text-[var(--p-ink)]">2 · Which tests?</h3>
              <span className="badge">{chosen.length} picked</span>
            </div>
            <div className="p-5">
              <div className="mb-3 flex items-center gap-2 rounded-lg border border-[var(--p-border)] px-3.5 py-2">
                <Icon name="search" size={15} />
                <input value={catQ} onChange={(e) => setCatQ(e.target.value)} placeholder="Search tests…" className="w-full bg-transparent text-sm outline-none" />
              </div>
              {shownCatalog.length === 0 ? (
                <p className="py-8 text-center text-[14px] text-[var(--p-muted)]">
                  {catalog.length === 0 ? "No tests in the catalog. The lab adds them." : "No test matches that."}
                </p>
              ) : (
                <div className="grid max-h-[340px] gap-1.5 overflow-y-auto sm:grid-cols-2">
                  {shownCatalog.map((c) => {
                    const on = !!picked[c.id];
                    return (
                      <button key={c.id} onClick={() => setPicked({ ...picked, [c.id]: !on })}
                        className={`flex items-center justify-between rounded-lg border px-3.5 py-2.5 text-left transition-colors ${
                          on ? "border-[var(--p-teal)] bg-[var(--p-teal-soft)]" : "border-[var(--p-border)] hover:border-[var(--p-teal)]"}`}>
                        <span className="min-w-0">
                          <span className={`block truncate text-[14px] ${on ? "font-semibold text-[var(--p-ink)]" : "text-[var(--p-text)]"}`}>{c.name}</span>
                          {c.code && <span className="block font-mono text-[11px] text-[var(--p-muted)]">{c.code}</span>}
                        </span>
                        <span className="ml-2 flex shrink-0 items-center gap-2">
                          <span className="font-mono text-[13px] text-[var(--p-muted)]">₹{c.price}</span>
                          {on && <Icon name="check" size={14} />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* summary rail */}
        <aside data-rise className="surface h-fit overflow-hidden lg:sticky lg:top-4">
          <div className="border-b border-[var(--p-border)] px-5 py-3.5">
            <h3 className="text-[14px] font-semibold text-[var(--p-ink)]">Summary</h3>
          </div>
          <div className="space-y-2.5 p-5">
            {chosen.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-[var(--p-muted)]">Pick a test to see the total.</p>
            ) : (
              <>
                {chosen.map((c) => (
                  <div key={c.id} className="flex items-center justify-between text-[14px]">
                    <span className="truncate pr-2 text-[var(--p-text)]">{c.name}</span>
                    <span className="font-mono text-[var(--p-ink)]">₹{c.price}</span>
                  </div>
                ))}
                <div className="!mt-4 flex items-center justify-between border-t border-[var(--p-border)] pt-3">
                  <span className="text-[14px] font-semibold text-[var(--p-ink)]">Total</span>
                  <span className="font-mono text-[16px] font-bold text-[var(--p-ink)]">₹{money(total)}</span>
                </div>
                {!anyTaxable && (
                  <p className="text-[12px] text-[var(--p-muted)]">
                    Diagnostics are <b>GST-exempt</b> — no tax added.
                  </p>
                )}

                {admission ? (
                  /* No payment control at all for an inpatient. A "take the money
                     now" checkbox on screen — even unticked — is an invitation to
                     charge a family twice for one blood draw. */
                  <div className="!mt-4 rounded-lg border border-[var(--p-blue)]/30 bg-[var(--p-blue-soft)] px-3 py-3">
                    <p className="text-[13px] font-semibold text-[var(--p-ink)]">
                      Charged to the room — <span className="font-mono">{admission.ipNumber}</span>
                    </p>
                    <p className="mt-1 text-[12px] leading-relaxed text-[var(--p-text)]">
                      These tests post straight to the room tab and settle in the discharge bill.
                      <b className="text-[var(--p-rose)]"> Take no money at the counter.</b>
                    </p>
                  </div>
                ) : (
                  <label className="!mt-4 flex cursor-pointer items-start gap-2.5 rounded-lg border border-[var(--p-border)] px-3 py-2.5">
                    <input type="checkbox" checked={billNow} onChange={(e) => setBillNow(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--p-teal)]" />
                    <span className="text-[13px] leading-relaxed text-[var(--p-text)]">
                      <b>Take the money now</b> — orders and bills in one step.
                    </span>
                  </label>
                )}

                {!admission && billNow && (
                  <div className="space-y-3">
                    <DiscountInput subtotal={total} accent="teal" onChange={(d) => setLabDisc(d.amount)} />
                    <PaymentSection total={collect} accent="teal" onChange={(r) => { setPayments(r.payments); setPayValid(r.valid); }} />
                  </div>
                )}
              </>
            )}
          </div>
          <div className="border-t border-[var(--p-border)] p-5">
            <button onClick={submit} disabled={busy || !patient || chosen.length === 0 || (!admission && billNow && collect > 0 && !payValid)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--p-teal)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--p-teal-deep)] disabled:opacity-40">
              {busy ? <><Spinner /> Sending…</>
                : <><Icon name="check" size={15} /> {billNow ? `Order & collect ₹${money(collect)}` : "Order tests"}</>}
            </button>
            {!patient && <p className="mt-2 text-center text-[12px] text-[var(--p-muted)]">Pick a patient first.</p>}
          </div>
        </aside>
      </div>
    </PortalScroll>
  );
}
