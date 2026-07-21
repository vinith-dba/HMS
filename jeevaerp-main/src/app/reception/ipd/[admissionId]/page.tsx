"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/portal/ui/icons";
import { Spinner, Field } from "@/components/portal/ui/form-atoms";
import { PortalScroll } from "@/components/portal/portal-scroll";
import { api, ApiClientError } from "@/lib/api-client";

interface Charge {
  id: string; category: string; description: string; qty: number;
  unitPrice: string; gstRatePct: string; amount: string;
  addedBy: string; createdAt: string; fromPharmacy: boolean;
}
interface Sheet {
  admission: {
    id: string; ipNumber: string; status: string; admittedAt: string; reason: string | null;
    wardName: string; bedNo: string; dailyCharge: string; gstRatePct: string;
    attendantName: string | null; attendantPhone: string | null; attendantRelation: string | null;
    patient: { id: string; displayId: string; fullName: string; age: number | null; gender: string | null; phone: string };
    doctor: { name: string; department: string };
  };
  days: number; bedTotal: string; charges: Charge[]; chargesTotal: string; grandTotal: string;
  /** One row per bed occupied. Two rows = they were transferred mid-stay. */
  legs: { wardName: string; bedNo: string; dailyCharge: string; days: number; total: string; current: boolean }[];
  advanceTotal: string;
  balance: string;
}
interface Med { id: string; name: string; unit: string; inStock: number; }

const CATEGORIES = [
  { k: "PROCEDURE", label: "Procedure" },
  { k: "DOCTOR_VISIT", label: "Doctor round" },
  { k: "NURSING", label: "Nursing" },
  { k: "OXYGEN", label: "Oxygen" },
  { k: "INVESTIGATION", label: "Investigation" },
  { k: "CONSUMABLE", label: "Consumables" },
  { k: "OTHER", label: "Other" },
];
const CAT_LABEL: Record<string, string> = Object.fromEntries(CATEGORIES.map((c) => [c.k, c.label]));
const money = (v: string | number) => Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2 });
const ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";

export default function AdmissionSheetPage() {
  const { admissionId } = useParams<{ admissionId: string }>();
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // add-charge form
  const [cat, setCat] = useState("PROCEDURE");
  const [desc, setDesc] = useState("");
  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState("");
  const [gst, setGst] = useState("0");

  // IP prescription
  // ── TRANSFER ── General → ICU. Until now the only way was discharge+readmit,
  //    which splits one stay into two bills.
  const [xferOpen, setXferOpen] = useState(false);
  const [xferWards, setXferWards] = useState<{ id: string; name: string; dailyCharge: string; gstRatePct: string; beds: { id: string; bedNo: string }[] }[]>([]);
  const [xferBed, setXferBed] = useState("");
  const [xferReason, setXferReason] = useState("");

  // ── ADVANCE ── the deposit. Every hospital takes one.
  const [advOpen, setAdvOpen] = useState(false);
  const [advAmt, setAdvAmt] = useState("");
  const [advMode, setAdvMode] = useState<"CASH" | "UPI" | "CARD" | "NETBANKING">("CASH");

  async function openTransfer() {
    setXferOpen(true);
    try {
      const r = await api.get<{ wards: typeof xferWards }>(`/ipd/admissions/${admissionId}/transfer`);
      setXferWards(r.wards);
      setXferBed(r.wards[0]?.beds[0]?.id ?? "");
    } catch { setXferWards([]); }
  }

  async function doTransfer() {
    if (!xferBed) return;
    setBusy(true); setErr(null);
    try {
      const r = await api.post<{ toWard: string; toBed: string; newDailyCharge: string }>(
        `/ipd/admissions/${admissionId}/transfer`,
        { toBedId: xferBed, reason: xferReason.trim() || undefined }
      );
      setFlash(`Moved to ${r.toWard} · ${r.toBed}. Billed at ₹${r.newDailyCharge}/day from today — the days already spent keep their old rate.`);
      setXferOpen(false); setXferReason("");
      await load();
    } catch (e) { setErr(e instanceof ApiClientError ? e.message : "Could not transfer."); }
    finally { setBusy(false); }
  }

  async function doAdvance() {
    if (!(Number(advAmt) > 0)) return;
    setBusy(true); setErr(null);
    try {
      const r = await api.post<{ totalAdvance: string }>(`/ipd/admissions/${admissionId}/advance`, {
        amount: Number(advAmt), mode: advMode,
      });
      setFlash(`Advance taken. ₹${r.totalAdvance} held against this stay — it comes off the discharge bill.`);
      setAdvOpen(false); setAdvAmt("");
      await load();
    } catch (e) { setErr(e instanceof ApiClientError ? e.message : "Could not record the advance."); }
    finally { setBusy(false); }
  }

  const [rxOpen, setRxOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [meds, setMeds] = useState<Med[]>([]);
  const [rxItems, setRxItems] = useState<{ name: string; medicineId: string | null; qty: string; dosage: string }[]>([
    { name: "", medicineId: null, qty: "1", dosage: "" },
  ]);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setSheet(await api.get<Sheet>(`/ipd/admissions/${admissionId}/sheet`)); }
    catch (e) { setErr(e instanceof ApiClientError ? e.message : "Couldn't load the sheet."); }
    finally { setLoading(false); }
  }, [admissionId]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api.get<{ medicines: Med[] }>("/pharmacy/medicines").then((r) => setMeds(r.medicines)).catch(() => {});
  }, []);

  const lineTotal = useMemo(() => (Number(qty || 0) * Number(price || 0)).toFixed(2), [qty, price]);

  async function addCharge() {
    if (!desc.trim() || !price) return;
    setBusy(true); setErr(null);
    try {
      await api.post(`/ipd/admissions/${admissionId}/charges`, {
        category: cat, description: desc.trim(),
        qty: Number(qty || 1), unitPrice: Number(price), gstRatePct: Number(gst || 0),
      });
      setFlash(`₹${money(lineTotal)} added to the tab.`);
      setDesc(""); setQty("1"); setPrice(""); setGst("0");
      await load();
    } catch (e) { setErr(e instanceof ApiClientError ? e.message : "Could not add the charge."); }
    finally { setBusy(false); }
  }

  async function removeCharge(c: Charge) {
    setBusy(true); setErr(null);
    try { await api.del(`/ipd/charges/${c.id}`); await load(); }
    catch (e) { setErr(e instanceof ApiClientError ? e.message : "Could not remove it."); }
    finally { setBusy(false); }
  }

  /** IP prescription: the doctor's round produced a chit. Same flow as OPD, tied to the stay. */
  async function uploadRx(send: boolean) {
    if (!file || !sheet) return;
    setBusy(true); setErr(null);
    try {
      const items = rxItems
        .filter((r) => r.name.trim())
        .map((r) => ({ medicineName: r.name.trim(), medicineId: r.medicineId ?? undefined, qty: Number(r.qty || 1), dosage: r.dosage.trim() || undefined }));

      const fd = new FormData();
      fd.append("file", file);
      fd.append("patientId", sheet.admission.patient.id);
      fd.append("admissionId", sheet.admission.id);
      fd.append("items", JSON.stringify(items));
      if (send) fd.append("sendNow", "1");

      const res = await fetch("/api/v1/reception/prescriptions", { method: "POST", body: fd, credentials: "include" });
      if (!res.ok) throw new ApiClientError(res.status, (await res.json().catch(() => ({}))).error ?? "Upload failed");

      setFlash(send
        ? "Prescription sent to the pharmacy — the medicines will be charged to this room, not to the patient at the counter."
        : "Prescription saved to the stay.");
      setRxOpen(false); setFile(null); setRxItems([{ name: "", medicineId: null, qty: "1", dosage: "" }]);
      await load();
    } catch (e) { setErr(e instanceof ApiClientError ? e.message : "Could not upload."); }
    finally { setBusy(false); }
  }

  const fld = "w-full rounded-lg border border-[var(--p-border)] bg-white px-3 py-2 text-sm text-[var(--p-ink)] outline-none focus:border-[var(--p-blue)]";

  if (loading) return <PortalScroll><div className="flex items-center justify-center gap-2 py-24 text-[14px] text-[var(--p-muted)]"><Spinner /> Loading the sheet…</div></PortalScroll>;
  if (!sheet) return <PortalScroll><p className="py-24 text-center text-[14px] text-[var(--p-rose)]">{err ?? "Not found."}</p></PortalScroll>;

  const a = sheet.admission;
  const discharged = a.status !== "ADMITTED";

  return (
    <PortalScroll>
      {/* header */}
      <div data-rise className="surface dotgrid mb-5 flex flex-wrap items-start justify-between gap-4 px-6 py-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-serif-p text-[22px] font-semibold text-[var(--p-ink)]">{a.patient.fullName}</h1>
            <span className="rounded bg-[var(--p-blue-soft)] px-2 py-0.5 font-mono text-[13px] font-bold text-[var(--p-blue-deep)]">{a.ipNumber}</span>
            {discharged && <span className="rounded bg-[var(--p-bg)] px-2 py-0.5 text-[12px] font-semibold uppercase text-[var(--p-muted)]">Discharged</span>}
          </div>
          <p className="mt-1 text-[14px] text-[var(--p-muted)]">
            <span className="font-mono">{a.patient.displayId}</span> · {a.wardName} · Bed <b className="text-[var(--p-ink)]">{a.bedNo}</b> ·
            Dr. {a.doctor.name} ({a.doctor.department})
          </p>
          {a.reason && <p className="mt-0.5 text-[13px] text-[var(--p-muted)]">Reason: {a.reason}</p>}
          {a.attendantName && (
            <p className="mt-0.5 text-[13px] text-[var(--p-muted)]">
              Attendant: <b className="text-[var(--p-ink)]">{a.attendantName}</b>
              {a.attendantRelation && ` (${a.attendantRelation})`}
              {a.attendantPhone && <> · <a href={`tel:${a.attendantPhone}`} className="font-mono text-[var(--p-blue)]">{a.attendantPhone}</a></>}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {!discharged && (
            <button onClick={() => setAdvOpen(true)}
              title="The deposit. Comes off the discharge bill."
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--p-border)] px-4 py-2.5 text-sm font-medium text-[var(--p-text)] hover:border-[var(--p-teal)] hover:text-[var(--p-teal)]">
              <Icon name="rupee" size={15} /> Take advance
            </button>
          )}
          {!discharged && (
            <button onClick={openTransfer}
              title="Move them to another bed. The bill keeps each leg at its own rate."
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--p-border)] px-4 py-2.5 text-sm font-medium text-[var(--p-text)] hover:border-[var(--p-blue)] hover:text-[var(--p-blue)]">
              <Icon name="bed" size={15} /> Transfer bed
            </button>
          )}
          {!discharged && (
            <button onClick={() => setRxOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--p-border)] px-4 py-2.5 text-sm font-medium text-[var(--p-text)] hover:border-[var(--p-blue)] hover:text-[var(--p-blue)]">
              <Icon name="file" size={15} /> Add prescription
            </button>
          )}
          <Link href="/ipd/inpatients" className="inline-flex items-center gap-2 rounded-lg border border-[var(--p-border)] px-4 py-2.5 text-sm font-medium text-[var(--p-text)] hover:border-[var(--p-blue)] hover:text-[var(--p-blue)]">
            Inpatients
          </Link>
        </div>
      </div>

      {flash && (
        <div data-rise className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-[var(--p-cyan)]/30 bg-[var(--p-cyan-soft)] px-4 py-3 text-[14px] text-[var(--p-cyan-deep)]">
          <span className="flex items-start gap-2"><Icon name="check" size={15} /> {flash}</span>
          <button onClick={() => setFlash(null)}>✕</button>
        </div>
      )}
      {err && <div data-rise className="mb-4 rounded-lg border border-[var(--p-rose)]/25 bg-[var(--p-rose-soft)] px-4 py-3 text-[14px] text-[var(--p-rose)]">{err}</div>}

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        {/* THE TAB */}
        <section data-rise className="surface overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--p-border)] px-5 py-3.5">
            <h3 className="text-[14px] font-semibold text-[var(--p-ink)]">The running tab</h3>
            <span className="badge">{sheet.charges.length + 1} lines</span>
          </div>

          <div className="divide-y divide-[var(--p-border)]">
            {/* bed is always line 1 */}
            <div className="flex items-center justify-between gap-3 bg-[var(--p-bg)] px-5 py-3.5">
              <div className="min-w-0">
                <div className="text-[14px] font-semibold text-[var(--p-ink)]">
                  Bed charges · {a.wardName} · {a.bedNo}
                </div>
                <div className="text-[12px] text-[var(--p-muted)]">
                  {sheet.days} day{sheet.days === 1 ? "" : "s"} × ₹{money(a.dailyCharge)}
                  {Number(a.gstRatePct) > 0 && ` · ${a.gstRatePct}% GST`}
                  {" · rate locked at admission"}
                </div>
              </div>
              <span className="font-mono text-[14px] font-bold text-[var(--p-ink)]">₹{money(sheet.bedTotal)}</span>
            </div>

            {sheet.charges.length === 0 ? (
              <p className="px-5 py-8 text-center text-[13px] text-[var(--p-muted)]">
                Nothing else on the tab yet. Add procedures, oxygen, doctor rounds below —
                pharmacy medicines land here automatically.
              </p>
            ) : sheet.charges.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[14px] font-medium text-[var(--p-ink)]">{c.description}</span>
                    {c.fromPharmacy && (
                      <span className="shrink-0 rounded bg-[var(--p-cyan-soft)] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[var(--p-cyan-deep)]">Pharmacy</span>
                    )}
                  </div>
                  <div className="text-[12px] text-[var(--p-muted)]">
                    {CAT_LABEL[c.category] ?? c.category} · {c.qty} × ₹{money(c.unitPrice)}
                    {Number(c.gstRatePct) > 0 && ` · ${c.gstRatePct}% GST`} · {c.addedBy}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-mono text-[14px] font-semibold text-[var(--p-ink)]">₹{money(c.amount)}</span>
                  {!discharged && !c.fromPharmacy && (
                    <button onClick={() => removeCharge(c)} disabled={busy}
                      className="rounded-lg border border-[var(--p-border)] px-2 py-1 text-[12px] text-[var(--p-muted)] hover:border-[var(--p-rose)] hover:text-[var(--p-rose)]">
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* add a charge */}
          {!discharged && (
            <div className="border-t border-[var(--p-border)] bg-[var(--p-bg)] p-5">
              <p className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-[var(--p-muted)]">Add to the tab</p>
              <div className="grid gap-3 sm:grid-cols-6">
                <div className="sm:col-span-2">
                  <Field label="What"><select className={fld} value={cat} onChange={(e) => setCat(e.target.value)}>
                    {CATEGORIES.map((c) => <option key={c.k} value={c.k}>{c.label}</option>)}
                  </select></Field>
                </div>
                <div className="sm:col-span-4">
                  <Field label="Description"><input className={fld} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Dressing change, ECG, night nursing…" /></Field>
                </div>
                <Field label="Qty"><input className={fld} value={qty} inputMode="numeric" onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} /></Field>
                <div className="sm:col-span-2">
                  <Field label="Rate (₹)"><input className={fld} value={price} inputMode="decimal" onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ""))} /></Field>
                </div>
                <Field label="GST %"><input className={fld} value={gst} inputMode="decimal" onChange={(e) => setGst(e.target.value.replace(/[^\d.]/g, ""))} /></Field>
                <div className="flex items-end sm:col-span-2">
                  <button onClick={addCharge} disabled={busy || !desc.trim() || !price}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--p-blue)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
                    {busy ? <Spinner /> : <Icon name="plus" size={14} />} Add ₹{money(lineTotal)}
                  </button>
                </div>
              </div>
              <p className="mt-2 text-[12px] text-[var(--p-muted)]">
                Most hospital services are GST-exempt — leave it 0 unless your CA says otherwise.
              </p>
            </div>
          )}
        </section>

        {/* TOTAL */}
        <aside data-rise className="surface h-fit overflow-hidden lg:sticky lg:top-4">
          <div className="border-b border-[var(--p-border)] px-5 py-3.5">
            <h3 className="text-[14px] font-semibold text-[var(--p-ink)]">{discharged ? "Final bill" : "Running total"}</h3>
          </div>
          <div className="space-y-2.5 p-5">
            {/* Each leg of the stay, priced at the rate it actually carried. Two
                rows here means the patient was moved — and the bill says so. */}
            {sheet.legs.length > 1 ? (
              sheet.legs.map((l, i) => (
                <div key={i} className="flex items-center justify-between text-[14px]">
                  <span className="min-w-0 text-[var(--p-muted)]">
                    <span className="text-[var(--p-ink)]">{l.wardName}</span> · {l.bedNo}
                    <span className="ml-1 text-[12px]">({l.days}d × ₹{money(l.dailyCharge)})</span>
                    {l.current && <span className="ml-1 rounded bg-[var(--p-blue-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--p-blue)]">now</span>}
                  </span>
                  <span className="shrink-0 font-mono text-[var(--p-ink)]">₹{money(l.total)}</span>
                </div>
              ))
            ) : (
              <div className="flex items-center justify-between text-[14px]">
                <span className="text-[var(--p-muted)]">Bed ({sheet.days}d)</span>
                <span className="font-mono text-[var(--p-ink)]">₹{money(sheet.bedTotal)}</span>
              </div>
            )}

            <div className="flex items-center justify-between text-[14px]">
              <span className="text-[var(--p-muted)]">Charges ({sheet.charges.length})</span>
              <span className="font-mono text-[var(--p-ink)]">₹{money(sheet.chargesTotal)}</span>
            </div>

            <div className="flex items-center justify-between border-t border-[var(--p-border)] pt-3">
              <span className="text-[14px] font-semibold text-[var(--p-ink)]">Total so far</span>
              <span className="font-mono text-[18px] font-bold text-[var(--p-ink)]">₹{money(sheet.grandTotal)}</span>
            </div>

            {/* The deposit. Reception took this money — it must be visible, or
                they'll ask the family for the full total at discharge. */}
            {Number(sheet.advanceTotal) > 0 && (
              <>
                <div className="flex items-center justify-between text-[14px]">
                  <span className="text-[var(--p-muted)]">Advance already taken</span>
                  <span className="font-mono font-semibold text-[var(--p-cyan-deep)]">−₹{money(sheet.advanceTotal)}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-[var(--p-teal-soft)] px-3 py-2.5">
                  <span className="text-[14px] font-bold text-[var(--p-ink)]">Still to pay</span>
                  <span className="font-mono text-[20px] font-bold text-[var(--p-teal-deep)]">₹{money(sheet.balance)}</span>
                </div>
                {Number(sheet.advanceTotal) > Number(sheet.grandTotal) && (
                  <p className="rounded-lg bg-[var(--p-amber-soft)] px-3 py-2 text-[12px] leading-relaxed text-[#8a6414]">
                    <b>The advance is larger than the bill.</b> ₹{money(String(Number(sheet.advanceTotal) - Number(sheet.grandTotal)))} must
                    be <b>refunded</b> at discharge — not kept.
                  </p>
                )}
              </>
            )}
            <p className="text-[12px] leading-relaxed text-[var(--p-muted)]">
              {discharged
                ? "This stay is closed. The invoice was raised at discharge."
                : "Bed charges grow each day. GST is applied per line at discharge — the room and a 12% syrup aren't taxed the same."}
            </p>
          </div>
          {!discharged && (
            <div className="border-t border-[var(--p-border)] p-5">
              <Link href="/ipd/inpatients"
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--p-blue)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--p-blue-deep)]">
                <Icon name="receipt" size={15} /> Discharge &amp; bill
              </Link>
              <p className="mt-2 text-center text-[12px] text-[var(--p-muted)]">Everything above goes on one invoice.</p>
            </div>
          )}
        </aside>
      </div>

      {/* IP PRESCRIPTION */}
      {rxOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="surface flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden bg-white">
            <div className="flex items-center justify-between border-b border-[var(--p-border)] px-6 py-4">
              <div>
                <h3 className="text-[15px] font-semibold text-[var(--p-ink)]">Prescription for {a.patient.fullName}</h3>
                <p className="text-[13px] text-[var(--p-muted)]">{a.ipNumber} · Dr. {a.doctor.name}&apos;s round</p>
              </div>
              <button onClick={() => setRxOpen(false)} className="text-[var(--p-muted)] hover:text-[var(--p-ink)]">✕</button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-6">
              <div>
                <p className="mb-1.5 text-[13px] font-medium text-[var(--p-text)]">Scan of the chit <span className="text-[var(--p-rose)]">*</span></p>
                <input ref={fileRef} type="file" accept={ACCEPT} className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                <button onClick={() => fileRef.current?.click()}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--p-border-strong)] px-4 py-6 text-[14px] text-[var(--p-muted)] hover:border-[var(--p-blue)] hover:text-[var(--p-blue)]">
                  <Icon name="file" size={16} />
                  {file ? <span className="font-medium text-[var(--p-ink)]">{file.name}</span> : "PDF, JPG or PNG — up to 10MB"}
                </button>
              </div>

              <div>
                <p className="mb-1.5 text-[13px] font-medium text-[var(--p-text)]">Type the medicines</p>
                <div className="space-y-2">
                  {rxItems.map((r, i) => {
                    const match = meds.find((m) => m.name.toLowerCase() === r.name.trim().toLowerCase());
                    return (
                      <div key={i} className="flex gap-2">
                        <div className="relative flex-1">
                          <input list={`meds-${i}`} className={fld} value={r.name} placeholder="Medicine name"
                            onChange={(e) => {
                              const v = e.target.value;
                              const m = meds.find((x) => x.name.toLowerCase() === v.trim().toLowerCase());
                              const next = [...rxItems];
                              next[i] = { ...next[i], name: v, medicineId: m?.id ?? null };
                              setRxItems(next);
                            }} />
                          <datalist id={`meds-${i}`}>
                            {meds.map((m) => <option key={m.id} value={m.name}>{m.inStock} {m.unit}s in stock</option>)}
                          </datalist>
                          {r.name.trim() && (
                            <span className={`absolute right-2 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full ${match ? "bg-[var(--p-cyan)]" : "bg-[var(--p-amber)]"}`}
                              title={match ? "In the catalog — pharmacy gets it pre-filled" : "Free text — pharmacy will type it"} />
                          )}
                        </div>
                        <input className={`${fld} w-16`} value={r.qty} inputMode="numeric" placeholder="Qty"
                          onChange={(e) => { const n = [...rxItems]; n[i] = { ...n[i], qty: e.target.value.replace(/\D/g, "") }; setRxItems(n); }} />
                        <input className={`${fld} w-32`} value={r.dosage} placeholder="1-0-1"
                          onChange={(e) => { const n = [...rxItems]; n[i] = { ...n[i], dosage: e.target.value }; setRxItems(n); }} />
                        <button onClick={() => setRxItems(rxItems.filter((_, j) => j !== i))} disabled={rxItems.length === 1}
                          className="rounded-lg border border-[var(--p-border)] px-2 text-[var(--p-muted)] hover:border-[var(--p-rose)] hover:text-[var(--p-rose)] disabled:opacity-30">✕</button>
                      </div>
                    );
                  })}
                </div>
                <button onClick={() => setRxItems([...rxItems, { name: "", medicineId: null, qty: "1", dosage: "" }])}
                  className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--p-blue)]">
                  <Icon name="plus" size={12} /> Another medicine
                </button>
              </div>

              <p className="rounded-lg bg-[var(--p-cyan-soft)] px-3 py-2.5 text-[13px] leading-relaxed text-[var(--p-cyan-deep)]">
                <b>This patient is admitted</b>, so the pharmacy will <b>charge the medicines to this room</b> instead of
                taking money at the counter. They&apos;ll appear on the tab and settle in the discharge bill.
              </p>
            </div>

            <div className="flex flex-wrap justify-end gap-3 border-t border-[var(--p-border)] p-5">
              <button onClick={() => setRxOpen(false)} className="rounded-lg border border-[var(--p-border)] px-4 py-2 text-sm text-[var(--p-text)]">Cancel</button>
              <button onClick={() => uploadRx(false)} disabled={busy || !file}
                className="rounded-lg border border-[var(--p-border)] px-4 py-2 text-sm font-medium text-[var(--p-text)] hover:border-[var(--p-blue)] disabled:opacity-40">
                Save only
              </button>
              <button onClick={() => uploadRx(true)} disabled={busy || !file}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--p-blue)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
                {busy ? <><Spinner /> Sending…</> : <><Icon name="check" size={15} /> Send to pharmacy</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────── TRANSFER ───────────
          The bill keeps EACH LEG at its own rate. Three days in General then four
          in ICU is billed as exactly that — not seven days at whichever rate
          happened to be last. */}
      {xferOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setXferOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="surface w-full max-w-md overflow-hidden">
            <div className="border-b border-[var(--p-border)] px-5 py-4">
              <h3 className="text-[15px] font-semibold text-[var(--p-ink)]">Move to another bed</h3>
              <p className="mt-0.5 text-[12px] text-[var(--p-muted)]">
                Currently {a.wardName} · {a.bedNo}. Only free beds are offered.
              </p>
            </div>

            <div className="space-y-4 p-5">
              {xferWards.length === 0 ? (
                <p className="rounded-lg bg-[var(--p-bg)] px-4 py-3 text-[13px] text-[var(--p-muted)]">
                  No free beds anywhere in the hospital.
                </p>
              ) : (
                <>
                  <div>
                    <label className="mb-1.5 block text-[12px] font-medium text-[var(--p-text)]">Where to?</label>
                    <select value={xferBed} onChange={(e) => setXferBed(e.target.value)}
                      className="w-full rounded-lg border border-[var(--p-border)] bg-white px-3 py-2 text-sm text-[var(--p-ink)] outline-none focus:border-[var(--p-blue)]">
                      {xferWards.map((w) => (
                        <optgroup key={w.id} label={`${w.name} — ₹${Number(w.dailyCharge).toLocaleString("en-IN")}/day`}>
                          {w.beds.map((b) => <option key={b.id} value={b.id}>{w.name} · {b.bedNo}</option>)}
                        </optgroup>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[12px] font-medium text-[var(--p-text)]">Why? (optional)</label>
                    <input value={xferReason} onChange={(e) => setXferReason(e.target.value)}
                      placeholder="Condition worsened · needs monitoring"
                      className="w-full rounded-lg border border-[var(--p-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--p-blue)]" />
                  </div>

                  <p className="rounded-lg bg-[var(--p-blue-soft)] px-3 py-2.5 text-[12px] leading-relaxed text-[var(--p-text)]">
                    <b>The days already spent keep their old rate.</b> The new ward&apos;s rate applies from
                    today onward, and the discharge bill shows both legs separately — which is what
                    actually happened, and what they should pay.
                  </p>
                </>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[var(--p-border)] bg-[var(--p-bg)] px-5 py-3">
              <button onClick={() => setXferOpen(false)} className="rounded-lg px-4 py-2 text-[13px] font-medium text-[var(--p-muted)] hover:text-[var(--p-ink)]">Cancel</button>
              <button onClick={doTransfer} disabled={busy || !xferBed}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--p-blue)] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-40">
                {busy ? <><Spinner /> Moving…</> : <><Icon name="bed" size={14} /> Move them</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────── ADVANCE ─────────── */}
      {advOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setAdvOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="surface w-full max-w-sm overflow-hidden">
            <div className="border-b border-[var(--p-border)] px-5 py-4">
              <h3 className="text-[15px] font-semibold text-[var(--p-ink)]">Take an advance</h3>
              <p className="mt-0.5 text-[12px] text-[var(--p-muted)]">
                The deposit. It comes straight off the discharge bill.
              </p>
            </div>

            <div className="space-y-4 p-5">
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-[var(--p-text)]">Amount</label>
                <input value={advAmt} inputMode="decimal"
                  onChange={(e) => setAdvAmt(e.target.value.replace(/[^\d.]/g, ""))}
                  placeholder="10000"
                  className="w-full rounded-lg border border-[var(--p-border)] bg-white px-3 py-2.5 text-center font-mono text-[18px] font-semibold text-[var(--p-ink)] outline-none focus:border-[var(--p-teal)]" />
              </div>

              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-[var(--p-text)]">How did they pay?</label>
                <div className="flex flex-wrap gap-2">
                  {(["CASH", "UPI", "CARD", "NETBANKING"] as const).map((m) => (
                    <button key={m} onClick={() => setAdvMode(m)}
                      className={`rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                        advMode === m
                          ? "border-[var(--p-teal)] bg-[var(--p-teal)] text-white"
                          : "border-[var(--p-border)] text-[var(--p-text)] hover:border-[var(--p-teal)]"}`}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <p className="rounded-lg bg-[var(--p-bg)] px-3 py-2.5 text-[11px] leading-relaxed text-[var(--p-muted)]">
                If the advance ends up larger than the final bill, the difference is
                <b className="text-[var(--p-ink)]"> refunded</b> — not kept.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[var(--p-border)] bg-[var(--p-bg)] px-5 py-3">
              <button onClick={() => setAdvOpen(false)} className="rounded-lg px-4 py-2 text-[13px] font-medium text-[var(--p-muted)] hover:text-[var(--p-ink)]">Cancel</button>
              <button onClick={doAdvance} disabled={busy || !(Number(advAmt) > 0)}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--p-teal)] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-40">
                {busy ? <><Spinner /> Recording…</> : <>Take ₹{Number(advAmt || 0).toLocaleString("en-IN")}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </PortalScroll>
  );
}
