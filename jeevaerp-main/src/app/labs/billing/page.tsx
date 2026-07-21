"use client";

import { useEffect, useState } from "react";
import { PrimaryButton } from "@/components/portal/ui/primitives";
import { Icon } from "@/components/portal/ui/icons";
import { Spinner } from "@/components/portal/ui/form-atoms";
import { DiscountInput, PaymentSection, type Tender } from "@/components/portal/ui/bill-fields";
import { PortalScroll } from "@/components/portal/portal-scroll";
import { api, ApiClientError } from "@/lib/api-client";

interface Patient { id: string; displayId: string; fullName: string; phone: string; age: number | null; gender: string | null; }
interface Test { id: string; testName: string; status: string; price: string | null; billed: boolean; }
interface Invoice {
  id: string; receiptNo: string; source: string; status: string; createdAt: string;
  patient: { displayId: string; fullName: string; phone: string; address: string | null };
  items: { description: string; hsnSac: string | null; qty: number; unitPrice: string; amount: string; gstRatePct: string }[];
  subtotal: string; discountAmount: string; taxableAmount: string;
  cgstAmount: string; sgstAmount: string; totalAmount: string; amountPaid: string; balanceDue: string;
  hospital: { legalName: string; addressLine: string; city: string; state: string; stateCode: string; pincode: string; gstin: string | null; phone: string | null } | null;
}


export default function LabBillingPage() {
  const [uhid, setUhid] = useState("");
  const [patient, setPatient] = useState<Patient | null>(null);
  const [tests, setTests] = useState<Test[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const [disc, setDisc] = useState(0);
  const [payNow, setPayNow] = useState(true);
  const [payments, setPayments] = useState<Tender[]>([]);
  const [payValid, setPayValid] = useState(true);

  const [billing, setBilling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);

  async function lookup() {
    if (!uhid.trim()) return;
    setError(null); setLoading(true); setPatient(null); setTests([]); setPicked(new Set());
    try {
      const r = await api.get<{ patient: Patient; tests: Test[] }>(`/labs/patients/${uhid.trim().toUpperCase()}`);
      setPatient(r.patient);
      setTests(r.tests.filter((t) => !t.billed));
    } catch (e) { setError(e instanceof ApiClientError ? e.message : "Patient not found."); }
    finally { setLoading(false); }
  }

  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selected = tests.filter((t) => picked.has(t.id));
  const subtotal = selected.reduce((s, t) => s + Number(t.price ?? 0), 0);
  const estTotal = subtotal - disc; // GST added server-side per catalog rate

  async function generate() {
    if (!patient || picked.size === 0) return;
    setError(null); setBilling(true);
    try {
      const { invoice } = await api.post<{ invoice: Invoice }>("/labs/bill", {
        patientId: patient.id,
        labTestIds: [...picked],
        discountAmount: disc || undefined,
        payments: payNow && payments.length ? payments : undefined,
      });
      setInvoice(invoice);
    } catch (e) { setError(e instanceof ApiClientError ? e.message : "Could not generate the bill."); }
    finally { setBilling(false); }
  }

  function reset() { setInvoice(null); setPatient(null); setUhid(""); setTests([]); setPicked(new Set()); setDisc(0); setPayments([]); setPayValid(true); setError(null); }

  const fld = "w-full rounded-lg border border-[var(--p-border)] bg-white px-3.5 py-2.5 text-sm text-[var(--p-ink)] outline-none focus:border-[var(--p-teal)]";

  if (invoice) return <InvoiceView invoice={invoice} onNew={reset} />;

  return (
    <PortalScroll>
      <div data-rise className="surface dotgrid mb-6 px-6 py-5">
        <h1 className="font-serif-p text-[22px] font-semibold text-[var(--p-ink)]">Generate lab bill</h1>
        <p className="mt-1 text-[13px] text-[var(--p-muted)]">
          GST is applied per test from the catalog. Diagnostic services are set to <strong>0% (exempt)</strong> by default — your CA can change rates per test.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <section data-rise className="surface overflow-hidden">
            <div className="border-b border-[var(--p-border)] px-6 py-4"><h3 className="text-[14px] font-semibold text-[var(--p-ink)]">1 · Find patient by Jeeva ID</h3></div>
            <div className="p-6">
              <div className="flex gap-2">
                <input value={uhid} onChange={(e) => setUhid(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === "Enter" && lookup()}
                  placeholder="JMH2026OP00001" className={`${fld} font-mono`} />
                <PrimaryButton onClick={lookup} disabled={loading}>{loading ? <Spinner /> : <Icon name="search" size={15} />} Find</PrimaryButton>
              </div>
              {patient && (
                <div className="mt-4 flex items-center justify-between rounded-xl border border-[var(--p-teal)] bg-[var(--p-teal-soft)]/40 p-4">
                  <div>
                    <div className="text-[14px] font-semibold text-[var(--p-ink)]">{patient.fullName}</div>
                    <div className="text-[11px] text-[var(--p-muted)]"><span className="tabular">{patient.displayId}</span> · {patient.phone}{patient.age != null && ` · ${patient.age}y`}</div>
                  </div>
                  <span className="badge">{tests.length} unbilled</span>
                </div>
              )}
            </div>
          </section>

          <section data-rise className={`surface overflow-hidden ${patient ? "" : "pointer-events-none opacity-55"}`}>
            <div className="flex items-center justify-between border-b border-[var(--p-border)] px-6 py-4">
              <h3 className="text-[14px] font-semibold text-[var(--p-ink)]">2 · Select tests to bill</h3>
              <span className="badge">{picked.size} selected</span>
            </div>
            {tests.length === 0 ? (
              <p className="px-6 py-10 text-center text-[13px] text-[var(--p-muted)]">
                {patient ? "No unbilled tests for this patient." : "Find a patient to see their unbilled tests."}
              </p>
            ) : (
              <div className="divide-y divide-[var(--p-border)]">
                {tests.map((t) => {
                  const on = picked.has(t.id);
                  return (
                    <button key={t.id} onClick={() => toggle(t.id)} className={`flex w-full items-center justify-between px-6 py-3.5 text-left transition-colors ${on ? "bg-[var(--p-teal-soft)]/40" : "hover:bg-[var(--p-bg)]"}`}>
                      <div className="flex items-center gap-3">
                        <span className={`flex h-5 w-5 items-center justify-center rounded border ${on ? "border-[var(--p-teal)] bg-[var(--p-teal)] text-white" : "border-[var(--p-border)]"}`}>{on && <Icon name="check" size={12} />}</span>
                        <div>
                          <div className="text-[13px] font-medium text-[var(--p-ink)]">{t.testName}</div>
                          <div className="text-[11px] text-[var(--p-muted)]">{t.status === "PENDING" ? "Pending result" : "Completed"}</div>
                        </div>
                      </div>
                      <span className="font-mono text-[13px] text-[var(--p-ink)]">₹{t.price ?? "0.00"}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <aside data-rise className="lg:sticky lg:top-6 lg:self-start">
          <div className="surface overflow-hidden">
            <div className="border-b border-[var(--p-border)] px-5 py-4"><p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--p-ink)]">Bill</p></div>
            <div className="space-y-3 p-5">
              <Row k="Subtotal" v={`₹${subtotal.toFixed(2)}`} />
              <DiscountInput subtotal={subtotal} accent="teal" onChange={(d) => setDisc(d.amount)} />
              <div className="rule my-1" />
              <Row k="Taxable" v={`₹${estTotal.toFixed(2)}`} />
              <p className="text-[11px] leading-relaxed text-[var(--p-muted)]">CGST + SGST are computed server-side from each test&apos;s catalog rate (0% = exempt).</p>
            </div>

            <div className="border-t border-[var(--p-border)] p-5">
              <label className="mb-3 flex items-center gap-2 text-[13px] text-[var(--p-text)]">
                <input type="checkbox" checked={payNow} onChange={(e) => setPayNow(e.target.checked)} className="h-4 w-4 accent-[var(--p-teal)]" />
                Collect payment now
              </label>
              {payNow && (
                <PaymentSection total={estTotal} accent="teal" onChange={(r) => { setPayments(r.payments); setPayValid(r.valid); }} />
              )}
            </div>

            {error && <div className="border-t border-[var(--p-border)] bg-[var(--p-rose-soft)] px-5 py-3 text-[12px] text-[var(--p-rose)]">{error}</div>}

            <div className="border-t border-[var(--p-border)] p-5">
              <PrimaryButton onClick={generate} disabled={!patient || picked.size === 0 || billing || (payNow && !payValid)} full>
                {billing ? <><Spinner /> Generating…</> : <><Icon name="receipt" size={15} /> Generate GST bill</>}
              </PrimaryButton>
            </div>
          </div>
        </aside>
      </div>
    </PortalScroll>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between text-[13px]"><span className="text-[var(--p-muted)]">{k}</span><span className="font-mono text-[var(--p-ink)]">{v}</span></div>;
}

/** Printable GST invoice. */
function InvoiceView({ invoice, onNew }: { invoice: Invoice; onNew: () => void }) {
  const h = invoice.hospital;
  const exempt = Number(invoice.cgstAmount) === 0 && Number(invoice.sgstAmount) === 0;
  const discPctNum = Number(invoice.subtotal) > 0 ? (Number(invoice.discountAmount) / Number(invoice.subtotal)) * 100 : 0;
  const discPct = discPctNum % 1 === 0 ? discPctNum.toFixed(0) : discPctNum.toFixed(1);
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex justify-between print:hidden">
        <button onClick={onNew} className="inline-flex items-center gap-2 rounded-lg border border-[var(--p-border)] px-4 py-2 text-sm font-medium text-[var(--p-text)] hover:border-[var(--p-teal)]">
          <Icon name="plus" size={14} /> New bill
        </button>
        <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-[var(--p-teal)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--p-teal-deep)]">
          <Icon name="file" size={14} /> Print / Save PDF
        </button>
      </div>

      <div className="surface overflow-hidden bg-white">
        {/* header */}
        <div className="border-b border-[var(--p-border)] px-8 py-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-serif-p text-[20px] font-semibold text-[var(--p-ink)]">{h?.legalName ?? "Jeeva Multispeciality Hospital"}</h2>
              {h && <p className="mt-1 text-[12px] leading-relaxed text-[var(--p-muted)]">{h.addressLine}<br />{h.city}, {h.state} – {h.pincode}{h.phone && <> · {h.phone}</>}</p>}
              {h?.gstin && <p className="mt-1 font-mono text-[12px] text-[var(--p-ink)]">GSTIN: {h.gstin} · State code: {h.stateCode}</p>}
            </div>
            <div className="text-right">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--p-muted)]">Tax Invoice</p>
              <p className="mt-1 font-mono text-[15px] font-semibold text-[var(--p-ink)]">{invoice.receiptNo}</p>
              <p className="mt-0.5 text-[12px] text-[var(--p-muted)]">{new Date(invoice.createdAt).toLocaleString("en-IN")}</p>
              <span className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${invoice.status === "PAID" ? "bg-[var(--p-teal-soft)] text-[var(--p-teal-deep)]" : "bg-[var(--p-amber-soft)] text-[#8a6414]"}`}>{invoice.status}</span>
            </div>
          </div>
        </div>

        {/* patient */}
        <div className="grid grid-cols-2 gap-px border-b border-[var(--p-border)] bg-[var(--p-border)]">
          <div className="bg-white px-8 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--p-muted)]">Billed to</p>
            <p className="mt-1 text-[14px] font-medium text-[var(--p-ink)]">{invoice.patient.fullName}</p>
            <p className="font-mono text-[12px] text-[var(--p-muted)]">{invoice.patient.displayId} · {invoice.patient.phone}</p>
          </div>
          <div className="bg-white px-8 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--p-muted)]">Place of supply</p>
            <p className="mt-1 text-[14px] text-[var(--p-ink)]">{h?.state ?? "Telangana"} ({h?.stateCode ?? "36"})</p>
          </div>
        </div>

        {/* items */}
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-[var(--p-border)] bg-[var(--p-bg)] text-[11px] uppercase tracking-wide text-[var(--p-muted)]">
              <th className="px-8 py-2.5 font-semibold">Description</th>
              <th className="py-2.5 font-semibold">SAC</th>
              <th className="py-2.5 text-center font-semibold">Qty</th>
              <th className="py-2.5 text-right font-semibold">Rate</th>
              <th className="py-2.5 text-center font-semibold">GST</th>
              <th className="px-8 py-2.5 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--p-border)]">
            {invoice.items.map((it, i) => (
              <tr key={i}>
                <td className="px-8 py-3 text-[var(--p-ink)]">{it.description}</td>
                <td className="py-3 font-mono text-[12px] text-[var(--p-muted)]">{it.hsnSac ?? "—"}</td>
                <td className="py-3 text-center">{it.qty}</td>
                <td className="py-3 text-right font-mono">₹{it.unitPrice}</td>
                <td className="py-3 text-center font-mono text-[12px]">{Number(it.gstRatePct) === 0 ? "Exempt" : `${it.gstRatePct}%`}</td>
                <td className="px-8 py-3 text-right font-mono font-semibold">₹{it.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* totals */}
        <div className="flex justify-end border-t border-[var(--p-border)] bg-[var(--p-bg)] px-8 py-5">
          <div className="w-64 space-y-2 text-[13px]">
            <T k="Subtotal" v={invoice.subtotal} />
            {Number(invoice.discountAmount) > 0 && <T k={`Discount (${discPct}%)`} v={`-${invoice.discountAmount}`} />}
            <T k="Taxable value" v={invoice.taxableAmount} />
            <T k="CGST" v={invoice.cgstAmount} />
            <T k="SGST" v={invoice.sgstAmount} />
            <div className="rule" />
            <div className="flex justify-between pt-1">
              <span className="text-[14px] font-semibold text-[var(--p-ink)]">Total</span>
              <span className="font-mono text-[16px] font-semibold text-[var(--p-teal)]">₹{invoice.totalAmount}</span>
            </div>
            {Number(invoice.amountPaid) > 0 && <T k="Paid" v={invoice.amountPaid} />}
            {Number(invoice.balanceDue) > 0 && <T k="Balance due" v={invoice.balanceDue} />}
          </div>
        </div>

        {exempt && (
          <p className="border-t border-[var(--p-border)] px-8 py-3 text-[11px] leading-relaxed text-[var(--p-muted)]">
            Healthcare services by a clinical establishment are exempt from GST under Notification 12/2017 – Central Tax (Rate). Rates are configurable per test.
          </p>
        )}
      </div>
    </div>
  );
}
function T({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between"><span className="text-[var(--p-muted)]">{k}</span><span className="font-mono text-[var(--p-ink)]">₹{v.replace("-", "")}</span></div>;
}
