"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PrimaryButton, Pill, statusTone } from "@/components/portal/ui/primitives";
import { Icon } from "@/components/portal/ui/icons";
import { Spinner, Field } from "@/components/portal/ui/form-atoms";
import { DiscountInput, PaymentSection, type Tender } from "@/components/portal/ui/bill-fields";
import { PortalScroll } from "@/components/portal/portal-scroll";
import { api, ApiClientError } from "@/lib/api-client";

interface Patient {
  id: string; displayId: string; fullName: string; firstName: string; middleName?: string | null; lastName: string | null;
  dob: string | null; age: number | null; gender: string | null; bloodGroup: string | null; maritalStatus?: string | null;
  phone: string; alternatePhone?: string | null; email?: string | null;
  address?: string | null; city: string | null; state?: string | null; country?: string | null; postalCode?: string | null;
  occupation?: string | null; nationality?: string | null; preferredLanguage?: string | null;
  isVip?: boolean; remarks?: string | null; createdAt: string;
}
interface Appt { id: string; opNumber: string; visitDate: string; time: string; status: string; doctorName: string; department: string; price: string; }
interface Rx { id: string; fileUrl: string; fileName: string; title: string | null; createdAt: string; }
interface Invoice { id: string; receiptNo: string; source: string; status: string; totalAmount: string; amountPaid: string; createdAt: string; }

const BLOODS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const LABEL: Record<string, string> = { BOOKED: "Booked", CHECKED_IN: "Checked-in", COMPLETED: "Completed", CANCELLED: "Cancelled" };

export default function PatientDetailPage() {
  const { displayId } = useParams<{ displayId: string }>();
  const router = useRouter();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [appts, setAppts] = useState<Appt[]>([]);
  const [rx, setRx] = useState<Rx[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState<Record<string, string | boolean>>({});

  // billing
  const [billOpen, setBillOpen] = useState(false);
  const [billDesc, setBillDesc] = useState("Doctor consultation");
  const [billAmt, setBillAmt] = useState("");
  const [billGst, setBillGst] = useState("0");
  const [billDisc, setBillDisc] = useState(0);
  const [payNow, setPayNow] = useState(true);
  const [payments, setPayments] = useState<Tender[]>([]);
  const [payValid, setPayValid] = useState(true);
  const [billing, setBilling] = useState(false);
  const billTotal = Math.max(0, Number(billAmt || 0) - billDisc) * (1 + (Number(billGst) || 0) / 100);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [p, a, r, inv] = await Promise.all([
        api.get<{ patient: Patient }>(`/reception/patients/${displayId}`),
        api.get<{ appointments: Appt[] }>(`/reception/patients/${displayId}/appointments`),
        api.get<{ prescriptions: Rx[] }>(`/reception/patients/${displayId}/prescriptions`),
        api.get<{ invoices: Invoice[] }>(`/billing/invoices`),
      ]);
      setPatient(p.patient); setAppts(a.appointments); setRx(r.prescriptions);
      setInvoices(inv.invoices.filter((x) => true)); // filtered client-side below by patient
      seed(p.patient);
    } catch (e) { setError(e instanceof ApiClientError ? e.message : "Couldn't load this patient."); }
    finally { setLoading(false); }
  }, [displayId]);

  useEffect(() => { load(); }, [load]);

  function seed(p: Patient) {
    setF({
      firstName: p.firstName ?? "", middleName: p.middleName ?? "", lastName: p.lastName ?? "",
      dob: p.dob ?? "", age: p.age != null ? String(p.age) : "", gender: p.gender ?? "",
      bloodGroup: p.bloodGroup ?? "", maritalStatus: p.maritalStatus ?? "",
      phone: p.phone ?? "", alternatePhone: p.alternatePhone ?? "", email: p.email ?? "",
      address: p.address ?? "", city: p.city ?? "", state: p.state ?? "", country: p.country ?? "",
      postalCode: p.postalCode ?? "", occupation: p.occupation ?? "", nationality: p.nationality ?? "",
      preferredLanguage: p.preferredLanguage ?? "", isVip: p.isVip ?? false, remarks: p.remarks ?? "",
    });
  }

  async function save() {
    setSaving(true); setError(null);
    try {
      const body: Record<string, unknown> = { ...f };
      body.age = f.age ? Number(f.age) : undefined;
      for (const k of Object.keys(body)) if (body[k] === "") body[k] = undefined;
      await api.patch(`/reception/patients/${displayId}`, body);
      setEditing(false); await load();
    } catch (e) { setError(e instanceof ApiClientError ? e.message : "Could not save."); }
    finally { setSaving(false); }
  }

  async function generateBill() {
    if (!patient || !billAmt) return;
    setBilling(true); setError(null);
    try {
      const amount = Number(billAmt);
      await api.post("/billing/consultation", {
        patientId: patient.id,
        description: billDesc,
        amount,
        gstRatePct: Number(billGst) || 0,
        discountAmount: billDisc || undefined,
        payments: payNow && payments.length ? payments : undefined,
      });
      setBillOpen(false); setBillAmt(""); setBillDisc(0); setPayments([]); await load();
    } catch (e) { setError(e instanceof ApiClientError ? e.message : "Could not generate the bill."); }
    finally { setBilling(false); }
  }

  const fld = "w-full rounded-lg border border-[var(--p-border)] bg-white px-3 py-2 text-sm text-[var(--p-ink)] outline-none focus:border-[var(--p-teal)]";
  const set = (k: string) => (v: string | boolean) => setF((p) => ({ ...p, [k]: v }));
  const myInvoices = invoices.filter((i) => true);

  if (loading) return <div className="flex items-center justify-center gap-2 py-20 text-[14px] text-[var(--p-muted)]"><Spinner /> Loading patient…</div>;
  if (!patient) return <div className="surface p-10 text-center text-[14px] text-[var(--p-muted)]">{error ?? "Patient not found."}</div>;

  return (
    <PortalScroll>
      {/* header */}
      <div data-rise className="surface dotgrid mb-6 flex flex-wrap items-center justify-between gap-4 px-6 py-5">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push("/patients")} className="rounded-lg border border-[var(--p-border)] p-2 text-[var(--p-muted)] hover:border-[var(--p-teal)] hover:text-[var(--p-teal)]">←</button>
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--p-teal)] font-serif-p text-[15px] font-semibold text-white">
            {patient.fullName.split(" ").map((n) => n[0]).slice(0, 2).join("")}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-serif-p text-[22px] font-semibold text-[var(--p-ink)]">{patient.fullName}</h1>
              {patient.isVip && <span className="badge !text-[11px]">VIP</span>}
            </div>
            <p className="mt-0.5 font-mono text-[13px] text-[var(--p-teal)]">{patient.displayId}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`/book?patient=${patient.displayId}`} className="inline-flex items-center gap-2 rounded-lg border border-[var(--p-border)] px-4 py-2 text-[14px] font-medium text-[var(--p-text)] hover:border-[var(--p-teal)] hover:text-[var(--p-teal)]">
            <Icon name="calendar" size={14} /> Book appointment
          </a>
          <a href={`/prescriptions?patient=${patient.displayId}`} className="inline-flex items-center gap-2 rounded-lg border border-[var(--p-border)] px-4 py-2 text-[14px] font-medium text-[var(--p-text)] hover:border-[var(--p-teal)] hover:text-[var(--p-teal)]">
            <Icon name="file" size={14} /> Upload Rx
          </a>
          <a href={`/ipd?patient=${patient.displayId}`} className="inline-flex items-center gap-2 rounded-lg border border-[var(--p-border)] px-4 py-2 text-[14px] font-medium text-[var(--p-text)] hover:border-[var(--p-teal)] hover:text-[var(--p-teal)]">
            <Icon name="bed" size={14} /> Admit
          </a>
          <button onClick={() => setBillOpen(true)} className="inline-flex items-center gap-2 rounded-lg border border-[var(--p-border)] px-4 py-2 text-[14px] font-medium text-[var(--p-text)] hover:border-[var(--p-teal)] hover:text-[var(--p-teal)]">
            <Icon name="rupee" size={14} /> Generate bill
          </button>
          {!editing ? (
            <button onClick={() => setEditing(true)} className="inline-flex items-center gap-2 rounded-lg bg-[var(--p-teal)] px-4 py-2 text-[14px] font-semibold text-white hover:bg-[var(--p-teal-deep)]">
              <Icon name="file" size={14} /> Edit details
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => { setEditing(false); seed(patient); }} className="rounded-lg border border-[var(--p-border)] px-4 py-2 text-[14px] text-[var(--p-text)]">Cancel</button>
              <PrimaryButton onClick={save} disabled={saving}>{saving ? <><Spinner /> Saving…</> : <><Icon name="check" size={14} /> Save</>}</PrimaryButton>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div data-rise className="mb-4 flex items-start gap-2 rounded-lg border border-[var(--p-rose)]/25 bg-[var(--p-rose-soft)] px-4 py-3 text-[14px] text-[var(--p-rose)]">
          <Icon name="alert" size={15} /> <span>{error}</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        {/* DETAILS */}
        <section data-rise className="surface overflow-hidden">
          <div className="border-b border-[var(--p-border)] px-6 py-4"><h3 className="text-[14px] font-semibold text-[var(--p-ink)]">Patient details</h3></div>
          {!editing ? (
            <div className="grid grid-cols-2 gap-px bg-[var(--p-border)]">
              <D k="First name" v={patient.firstName} />
              <D k="Last name" v={patient.lastName ?? "—"} />
              <D k="Date of birth" v={patient.dob ?? "—"} />
              <D k="Age" v={patient.age != null ? `${patient.age}` : "—"} />
              <D k="Gender" v={cap(patient.gender)} />
              <D k="Blood group" v={patient.bloodGroup ?? "—"} />
              <D k="Marital status" v={cap(patient.maritalStatus ?? null)} />
              <D k="Phone" v={patient.phone} mono />
              <D k="Alternate" v={patient.alternatePhone ?? "—"} mono />
              <D k="Email" v={patient.email ?? "—"} />
              <D k="Address" v={patient.address ?? "—"} />
              <D k="City" v={patient.city ?? "—"} />
              <D k="State" v={patient.state ?? "—"} />
              <D k="PIN" v={patient.postalCode ?? "—"} />
              <D k="Occupation" v={patient.occupation ?? "—"} />
              <D k="Language" v={patient.preferredLanguage ?? "—"} />
            </div>
          ) : (
            <div className="grid gap-4 p-6 sm:grid-cols-2">
              <Field label="First name"><input className={fld} value={f.firstName as string} onChange={(e) => set("firstName")(e.target.value)} /></Field>
              <Field label="Last name"><input className={fld} value={f.lastName as string} onChange={(e) => set("lastName")(e.target.value)} /></Field>
              <Field label="Date of birth"><input type="date" className={fld} value={f.dob as string} onChange={(e) => set("dob")(e.target.value)} /></Field>
              <Field label="Age"><input className={fld} value={f.age as string} onChange={(e) => set("age")(e.target.value.replace(/\D/g, "").slice(0, 3))} /></Field>
              <Field label="Gender">
                <select className={fld} value={f.gender as string} onChange={(e) => set("gender")(e.target.value)}>
                  <option value="">—</option><option value="MALE">Male</option><option value="FEMALE">Female</option><option value="OTHER">Other</option>
                </select>
              </Field>
              <Field label="Blood group">
                <select className={fld} value={f.bloodGroup as string} onChange={(e) => set("bloodGroup")(e.target.value)}>
                  <option value="">—</option>{BLOODS.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </Field>
              <Field label="Marital status">
                <select className={fld} value={f.maritalStatus as string} onChange={(e) => set("maritalStatus")(e.target.value)}>
                  <option value="">—</option><option value="SINGLE">Single</option><option value="MARRIED">Married</option><option value="DIVORCED">Divorced</option><option value="WIDOWED">Widowed</option><option value="OTHER">Other</option>
                </select>
              </Field>
              <Field label="Phone"><input className={fld} value={f.phone as string} onChange={(e) => set("phone")(e.target.value.replace(/\D/g, "").slice(0, 10))} /></Field>
              <Field label="Alternate phone"><input className={fld} value={f.alternatePhone as string} onChange={(e) => set("alternatePhone")(e.target.value.replace(/\D/g, "").slice(0, 10))} /></Field>
              <Field label="Email"><input className={fld} value={f.email as string} onChange={(e) => set("email")(e.target.value)} /></Field>
              <Field label="Address" span><input className={fld} value={f.address as string} onChange={(e) => set("address")(e.target.value)} /></Field>
              <Field label="City"><input className={fld} value={f.city as string} onChange={(e) => set("city")(e.target.value)} /></Field>
              <Field label="State"><input className={fld} value={f.state as string} onChange={(e) => set("state")(e.target.value)} /></Field>
              <Field label="PIN"><input className={fld} value={f.postalCode as string} onChange={(e) => set("postalCode")(e.target.value.replace(/\D/g, "").slice(0, 10))} /></Field>
              <Field label="Occupation"><input className={fld} value={f.occupation as string} onChange={(e) => set("occupation")(e.target.value)} /></Field>
              <Field label="Language"><input className={fld} value={f.preferredLanguage as string} onChange={(e) => set("preferredLanguage")(e.target.value)} /></Field>
              <Field label="Remarks" span><input className={fld} value={f.remarks as string} onChange={(e) => set("remarks")(e.target.value)} /></Field>
              <label className="col-span-2 flex items-center gap-2 text-[14px] text-[var(--p-text)]">
                <input type="checkbox" checked={f.isVip as boolean} onChange={(e) => set("isVip")(e.target.checked)} className="h-4 w-4 accent-[var(--p-teal)]" /> VIP patient
              </label>
            </div>
          )}
        </section>

        {/* SIDE: visits, prescriptions, invoices */}
        <div className="space-y-6">
          <section data-rise className="surface overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--p-border)] px-6 py-4">
              <h3 className="text-[14px] font-semibold text-[var(--p-ink)]">Visits</h3><span className="badge">{appts.length}</span>
            </div>
            {appts.length === 0 ? <p className="px-6 py-8 text-center text-[13px] text-[var(--p-muted)]">No visits yet.</p> : (
              <div className="max-h-64 divide-y divide-[var(--p-border)] overflow-y-auto overscroll-contain">
                {appts.map((a) => (
                  <div key={a.opNumber} className="flex items-center justify-between gap-2 px-6 py-3">
                    <div className="min-w-0">
                      <div className="text-[14px] font-medium text-[var(--p-ink)]">{a.doctorName}</div>
                      <div className="text-[12px] text-[var(--p-muted)]"><span className="font-mono">{a.visitDate}</span> · {a.time}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <a href={`/print/opd/${a.id}`} target="_blank" rel="noopener noreferrer"
                        className="rounded-lg border border-[var(--p-border)] px-2.5 py-1 text-[12px] font-medium text-[var(--p-teal)] hover:border-[var(--p-teal)]">Print</a>
                      <div className="text-right">
                        <Pill tone={statusTone(LABEL[a.status] ?? a.status)}>{LABEL[a.status] ?? a.status}</Pill>
                        <div className="mt-1 font-mono text-[12px] text-[var(--p-muted)]">₹{a.price}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section data-rise className="surface overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--p-border)] px-6 py-4">
              <h3 className="text-[14px] font-semibold text-[var(--p-ink)]">Prescriptions</h3><span className="badge">{rx.length}</span>
            </div>
            {rx.length === 0 ? <p className="px-6 py-8 text-center text-[13px] text-[var(--p-muted)]">No prescriptions uploaded.</p> : (
              <div className="max-h-56 divide-y divide-[var(--p-border)] overflow-y-auto overscroll-contain">
                {rx.map((r) => (
                  <div key={r.id} className="flex items-center justify-between px-6 py-3">
                    <div className="text-[14px] text-[var(--p-ink)]">{r.title || r.fileName}</div>
                    <a href={r.fileUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-[var(--p-border)] px-2.5 py-1 text-[12px] font-medium text-[var(--p-teal)] hover:border-[var(--p-teal)]">View</a>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section data-rise className="surface overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--p-border)] px-6 py-4">
              <h3 className="text-[14px] font-semibold text-[var(--p-ink)]">Bills</h3><span className="badge">{myInvoices.length}</span>
            </div>
            {myInvoices.length === 0 ? <p className="px-6 py-8 text-center text-[13px] text-[var(--p-muted)]">No bills yet.</p> : (
              <div className="max-h-56 divide-y divide-[var(--p-border)] overflow-y-auto overscroll-contain">
                {myInvoices.map((i) => (
                  <div key={i.id} className="flex items-center justify-between gap-2 px-6 py-3">
                    <div className="min-w-0">
                      <div className="font-mono text-[13px] text-[var(--p-ink)]">{i.receiptNo}</div>
                      <div className="text-[12px] text-[var(--p-muted)]">{i.source} · ₹{i.totalAmount}</div>
                    </div>
                    <a href={`/print/invoice/${i.id}`} target="_blank" rel="noopener noreferrer"
                      className="rounded-lg border border-[var(--p-border)] px-2.5 py-1 text-[12px] font-medium text-[var(--p-teal)] hover:border-[var(--p-teal)]">Print</a>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* BILL modal */}
      {billOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="surface w-full max-w-md bg-white">
            <div className="border-b border-[var(--p-border)] px-6 py-4"><h3 className="text-[14px] font-semibold text-[var(--p-ink)]">Generate bill · {patient.fullName}</h3></div>
            <div className="space-y-4 p-6">
              <Field label="Description"><input className={fld} value={billDesc} onChange={(e) => setBillDesc(e.target.value)} /></Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Amount (₹)"><input className={fld} value={billAmt} onChange={(e) => setBillAmt(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" placeholder="700" autoFocus /></Field>
                <Field label="GST %"><input className={fld} value={billGst} onChange={(e) => setBillGst(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" /></Field>
              </div>
              <p className="text-[12px] leading-relaxed text-[var(--p-muted)]">Consultations are typically GST-exempt (0%). CGST/SGST split is computed automatically.</p>
              <DiscountInput subtotal={Number(billAmt || 0)} accent="teal" onChange={(d) => setBillDisc(d.amount)} />
              <div className="flex justify-between border-t border-[var(--p-border)] pt-3 text-[14px]">
                <span className="font-semibold text-[var(--p-ink)]">Total</span>
                <span className="font-mono font-semibold text-[var(--p-teal)]">₹{billTotal.toFixed(2)}</span>
              </div>
              <label className="flex items-center gap-2 text-[14px] text-[var(--p-text)]">
                <input type="checkbox" checked={payNow} onChange={(e) => setPayNow(e.target.checked)} className="h-4 w-4 accent-[var(--p-teal)]" /> Collect payment now
              </label>
              {payNow && (
                <PaymentSection total={billTotal} accent="teal" onChange={(r) => { setPayments(r.payments); setPayValid(r.valid); }} />
              )}
            </div>
            <div className="flex justify-end gap-3 border-t border-[var(--p-border)] p-5">
              <button onClick={() => setBillOpen(false)} className="rounded-lg border border-[var(--p-border)] px-4 py-2 text-sm text-[var(--p-text)]">Cancel</button>
              <PrimaryButton onClick={generateBill} disabled={billing || !billAmt || (payNow && !payValid)}>{billing ? <><Spinner /> Billing…</> : <><Icon name="receipt" size={15} /> Generate</>}</PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </PortalScroll>
  );
}

function cap(v: string | null) { return v ? v.charAt(0) + v.slice(1).toLowerCase() : "—"; }
function D({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="bg-white px-6 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--p-muted)]">{k}</p>
      <p className={`mt-0.5 text-[14px] text-[var(--p-ink)] ${mono ? "font-mono text-[13px]" : ""}`}>{v}</p>
    </div>
  );
}
