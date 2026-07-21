"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PrimaryButton, Pill } from "@/components/portal/ui/primitives";
import { Icon } from "@/components/portal/ui/icons";
import { Spinner, Field } from "@/components/portal/ui/form-atoms";
import { PortalScroll } from "@/components/portal/portal-scroll";
import { api, ApiClientError } from "@/lib/api-client";
import { AdmissionBanner, useAdmission } from "@/components/portal/reception/admission-banner";
import { InpatientPicker } from "@/components/portal/reception/inpatient-picker";
import { PRINT_CSS, RxTable } from "@/components/print/stationery";

interface Patient { id: string; displayId: string; fullName: string; phone: string; }
interface Visit { id: string; opNumber: string; visitDate: string; doctorName: string; department: string; }
interface Med { id: string; name: string; unit: string; inStock: number; }
interface RxItem { medicineName: string; medicineId?: string; qty: number; dosage: string; }
interface Existing { id: string; fileName: string; title: string | null; fileUrl: string; status: string; createdAt: string; }
interface VitalsForm { bpSystolic: string; bpDiastolic: string; pulse: string; heightCm: string; weightKg: string; tempF: string; spo2: string; }
const BLANK_VITALS: VitalsForm = { bpSystolic: "", bpDiastolic: "", pulse: "", heightCm: "", weightKg: "", tempF: "", spo2: "" };

const ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";

/** ?patient=JMH... -> preselect. Visits and history load reactively off it. */
function PatientFromUrl({ onFound }: { onFound: (p: Patient) => void }) {
  const params = useSearchParams();
  useEffect(() => {
    const pid = params.get("patient");
    if (!pid) return;
    api.get<{ patient: Patient }>(`/reception/patients/${encodeURIComponent(pid)}`)
      .then((r) => onFound(r.patient)).catch(() => { });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

export default function UploadPrescriptionPage() {
  // ---- patient ----
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Patient[]>([]);
  const [recent, setRecent] = useState<Patient[]>([]);
  const [patient, setPatient] = useState<Patient | null>(null);
  // the bed board decides IP vs OP — reception never has to.
  const { admission, checking: checkingAdm } = useAdmission(patient?.id);

  // ---- which consultation this scan belongs to ----
  const [visits, setVisits] = useState<Visit[]>([]);
  const [visitId, setVisitId] = useState<string>("");

  // ---- the scan ----
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");

  // ---- vitals typed in from the doctor's handwritten sheet (BP, height, weight…) ----
  const [vitals, setVitals] = useState<VitalsForm>(BLANK_VITALS);
  const [vitalsBusy, setVitalsBusy] = useState(false);
  const [vitalsSavedAt, setVitalsSavedAt] = useState<number | null>(null);
  const [vitalsError, setVitalsError] = useState<string | null>(null);

  // ---- typed medicines (the latency killer) ----
  const [items, setItems] = useState<RxItem[]>([]);
  const [medQuery, setMedQuery] = useState("");
  const [medResults, setMedResults] = useState<Med[]>([]);
  const [qty, setQty] = useState("1");
  const [dosage, setDosage] = useState("");
  const medBox = useRef<HTMLInputElement>(null);

  // ---- clinical details typed from the sheet — labs, diagnosis, advice ----
  const [labs, setLabs] = useState<string[]>([]);
  const [labInput, setLabInput] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [advice, setAdvice] = useState("");
  const [nextVisit, setNextVisit] = useState("");

  // ---- existing uploads for this patient ----
  const [existing, setExisting] = useState<Existing[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ sent: boolean; visitId: string | null; fileUrl?: string | null; generated?: boolean } | null>(null);

  useEffect(() => {
    api.get<{ patients: Patient[] }>("/reception/patients/recent").then((r) => setRecent(r.patients)).catch(() => { });
  }, []);

  // patient search
  useEffect(() => {
    if (patient || !query.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const { patients } = await api.get<{ patients: Patient[] }>(`/reception/patients?q=${encodeURIComponent(query)}&limit=6`);
        setResults(patients);
      } catch { setResults([]); }
    }, 250);
    return () => clearTimeout(t);
  }, [query, patient]);

  const loadExisting = useCallback(async (displayId: string) => {
    try {
      const r = await api.get<{ prescriptions: Existing[] }>(`/reception/patients/${displayId}/prescriptions`);
      setExisting(r.prescriptions);
    } catch { setExisting([]); }
  }, []);

  // when a patient is picked: their recent COMPLETED visits + past uploads
  useEffect(() => {
    if (!patient) return;
    api.get<{ visits: Visit[] }>(`/reception/patients/${patient.displayId}/completed-visits`)
      .then((r) => {
        setVisits(r.visits);
        // preselect the most recent completed consult — the usual case
        setVisitId(r.visits[0]?.id ?? "");
      })
      .catch(() => setVisits([]));
    loadExisting(patient.displayId);
  }, [patient, loadExisting]);

  // vitals belong to the OP visit, not the stay — reload whatever's typed
  // in already whenever the picked consultation changes.
  useEffect(() => {
    setVitalsSavedAt(null); setVitalsError(null);
    if (!visitId || admission) { setVitals(BLANK_VITALS); return; }
    api.get<{ vitals: { bpSystolic: number | null; bpDiastolic: number | null; pulse: number | null; heightCm: number | null; weightKg: number | null; tempF: number | null; spo2: number | null } | null }>(`/reception/appointments/${visitId}/vitals`)
      .then((r) => {
        const v = r.vitals;
        setVitals(v ? {
          bpSystolic: v.bpSystolic?.toString() ?? "",
          bpDiastolic: v.bpDiastolic?.toString() ?? "",
          pulse: v.pulse?.toString() ?? "",
          heightCm: v.heightCm?.toString() ?? "",
          weightKg: v.weightKg?.toString() ?? "",
          tempF: v.tempF?.toString() ?? "",
          spo2: v.spo2?.toString() ?? "",
        } : BLANK_VITALS);
      })
      .catch(() => setVitals(BLANK_VITALS));
  }, [visitId, admission]);

  // medicine autocomplete against the pharmacy catalog
  useEffect(() => {
    if (!medQuery.trim()) { setMedResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const { medicines } = await api.get<{ medicines: Med[] }>(`/pharmacy/medicines?q=${encodeURIComponent(medQuery)}`);
        setMedResults(medicines.slice(0, 6));
      } catch { setMedResults([]); }
    }, 220);
    return () => clearTimeout(t);
  }, [medQuery]);

  function addItem(name: string, medicineId?: string) {
    const n = name.trim();
    if (!n) return;
    setItems((p) => [...p, { medicineName: n, medicineId, qty: Math.max(1, Number(qty) || 1), dosage: dosage.trim() }]);
    setMedQuery(""); setMedResults([]); setQty("1"); setDosage("");
    medBox.current?.focus();
  }

  function addLab(name: string) {
    const n = name.trim();
    if (!n || labs.some((l) => l.toLowerCase() === n.toLowerCase())) { setLabInput(""); return; }
    setLabs((p) => [...p, n]);
    setLabInput("");
  }

  function resetClinical() {
    setLabs([]); setLabInput(""); setDiagnosis(""); setAdvice(""); setNextVisit("");
  }

  function pickFile(f: File | null) {
    setError(null);
    if (!f) { setFile(null); return; }
    if (f.size > 10 * 1024 * 1024) { setError("File too large (max 10 MB)."); return; }
    setFile(f);
  }

  async function upload(sendNow: boolean) {
    if (!patient || !file) return;
    setBusy(true); setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("patientId", patient.id);
      // An admitted patient's Rx belongs to the STAY, not a visit. Filing it
      // against an appointment would strand it outside the discharge bill.
      if (admission) fd.append("admissionId", admission.id);
      else if (visitId) fd.append("appointmentId", visitId);
      if (title.trim()) fd.append("title", title.trim());
      if (items.length) fd.append("items", JSON.stringify(items));
      if (sendNow) fd.append("sendNow", "1");

      const res = await fetch("/api/v1/reception/prescriptions", { method: "POST", body: fd, credentials: "include" });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? "Upload failed");
      }
      // Snapshot now: pinning to a visit is optional, and an admitted
      // patient's Rx has no OPD sheet to print (it's charged to the room).
      const printableVisitId = !admission && visitId ? visitId : null;
      setDone({ sent: sendNow, visitId: printableVisitId });
      if (sendNow && printableVisitId) {
        // Best-effort: still within the click's promise chain, so most
        // browsers allow it. The banner's own Print button is the fallback
        // if a popup blocker steps in.
        window.open(`/print/opd/${printableVisitId}`, "_blank");
      }
      setFile(null); setTitle(""); setItems([]);
      await loadExisting(patient.displayId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally { setBusy(false); }
  }

  /**
   * The new default path: send the OPD sheet *itself*, built from the typed
   * vitals + medicines — no scan required. It's filed to the patient's record
   * (their copy, by UHID) and, when sendNow, dropped into the pharmacy queue.
   * The scan-upload path below still works; this just doesn't need it.
   */
  async function sendOpdSheet(sendNow: boolean) {
    if (!patient || !visitId || admission) return;
    setBusy(true); setError(null);
    try {
      // persist whatever vitals are typed so the sheet carries them
      try { await saveVitals(); } catch { /* non-blocking */ }
      const res = await api.post<{ prescription: { fileUrl: string } }>("/reception/prescriptions/opd", {
        appointmentId: visitId,
        items,
        title: title.trim() || undefined,
        sendNow,
        diagnosis: diagnosis.trim() || undefined,
        advice: advice.trim() || undefined,
        nextVisit: nextVisit.trim() || undefined,
        labs,
      });
      setDone({ sent: sendNow, visitId, fileUrl: res.prescription?.fileUrl ?? null, generated: true });
      setItems([]); setTitle(""); resetClinical();
      await loadExisting(patient.displayId);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Could not send the OPD sheet.");
    } finally { setBusy(false); }
  }

  async function saveVitals() {
    if (!visitId) return;
    setVitalsBusy(true); setVitalsError(null);
    try {
      const num = (s: string) => (s.trim() === "" ? undefined : Number(s));
      const raw: Record<keyof VitalsForm, number | undefined> = {
        bpSystolic: num(vitals.bpSystolic), bpDiastolic: num(vitals.bpDiastolic),
        pulse: num(vitals.pulse), heightCm: num(vitals.heightCm),
        weightKg: num(vitals.weightKg), tempF: num(vitals.tempF), spo2: num(vitals.spo2),
      };
      const payload: Record<string, number> = {};
      for (const k of Object.keys(raw) as (keyof VitalsForm)[]) {
        const v = raw[k];
        if (v !== undefined && !Number.isNaN(v)) payload[k] = v;
      }
      await api.put(`/reception/appointments/${visitId}/vitals`, payload);
      setVitalsSavedAt(Date.now());
    } catch (e) {
      setVitalsError(e instanceof ApiClientError ? e.message : "Could not save vitals.");
    } finally { setVitalsBusy(false); }
  }

  async function sendToPharmacy(id: string) {
    setBusyId(id); setError(null);
    try { await api.post(`/reception/prescriptions/${id}/send`, {}); if (patient) await loadExisting(patient.displayId); }
    catch (e) { setError(e instanceof ApiClientError ? e.message : "Could not send to pharmacy."); }
    finally { setBusyId(null); }
  }
  async function recallFromPharmacy(id: string) {
    setBusyId(id); setError(null);
    try { await api.del(`/reception/prescriptions/${id}/send`); if (patient) await loadExisting(patient.displayId); }
    catch (e) { setError(e instanceof ApiClientError ? e.message : "Could not recall."); }
    finally { setBusyId(null); }
  }
  async function removeFile(id: string) {
    setBusyId(id); setError(null);
    try { await api.del(`/reception/prescriptions/${id}`); if (patient) await loadExisting(patient.displayId); }
    catch (e) { setError(e instanceof ApiClientError ? e.message : "Could not remove."); }
    finally { setBusyId(null); }
  }

  const fld = "w-full rounded-lg border border-[var(--p-border)] bg-white px-3 py-2 text-sm text-[var(--p-ink)] outline-none focus:border-[var(--p-blue)]";
  const selectedVisit = visits.find((v) => v.id === visitId);

  return (
    <PortalScroll>
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      <Suspense fallback={null}>
        <PatientFromUrl onFound={(p) => setPatient(p)} />
      </Suspense>
      <div data-rise className="surface dotgrid mb-6 px-6 py-5">
        <h1 className="font-serif-p text-[22px] font-semibold text-[var(--p-ink)]">Prescriptions</h1>
        <p className="mt-1 text-[14px] text-[var(--p-muted)]">
          The doctor wrote it by hand. Type the vitals and medicines in, scan the sheet — and it&apos;s all computerized and at the pharmacy before the patient is.
        </p>
      </div>

      {done && (
        <div data-rise className="mb-4 flex items-center justify-between rounded-lg border border-[var(--p-cyan)]/30 bg-[var(--p-cyan-soft)] px-4 py-3">
          <p className="text-[14px] font-medium text-[var(--p-cyan-deep)]">
            {done.generated
              ? (done.sent
                ? "OPD sheet sent to the pharmacy queue and saved to the patient's record. ✓"
                : "OPD sheet saved to the patient's record — send it to pharmacy when ready.")
              : (done.sent
                ? "Uploaded and sent — the pharmacy can already see it in their queue. ✓"
                : "Uploaded. It's on the patient's record — send it to pharmacy when ready.")}
          </p>
          <span className="flex items-center gap-3">
            {done.fileUrl && (
              <a href={done.fileUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg border border-[var(--p-cyan-deep)]/40 px-3 py-1.5 text-[13px] font-semibold text-[var(--p-cyan-deep)] hover:bg-white/50">
                <Icon name="file" size={13} /> Patient&apos;s copy
              </a>
            )}
            {done.visitId && (
              <a href={`/print/opd/${done.visitId}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg bg-[var(--p-cyan-deep)] px-3 py-1.5 text-[13px] font-semibold text-white hover:opacity-90">
                <Icon name="printer" size={13} /> Print OPD sheet
              </a>
            )}
            <a href="/" className="text-[13px] font-semibold text-[var(--p-cyan-deep)] underline underline-offset-2">Back to today</a>
            <button onClick={() => setDone(null)} className="text-[var(--p-cyan-deep)]">✕</button>
          </span>
        </div>
      )}
      {error && <div data-rise className="mb-4 rounded-lg border border-[var(--p-rose)]/25 bg-[var(--p-rose-soft)] px-4 py-3 text-[14px] text-[var(--p-rose)]">{error}</div>}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          {/* Inpatient work starts at a BED, not a name. The ward says "ICU 3" —
              so that's what reception should be able to tap. */}
          <InpatientPicker
            pickedPatientId={patient?.id}
            onPick={(ip) => {
              setPatient({
                id: ip.patient.id, displayId: ip.patient.displayId,
                fullName: ip.patient.fullName, phone: ip.patient.phone,
              });
              setQuery("");
              setVisitId("");   // an IP Rx files to the STAY — never to an old visit
            }}
          />

          {/* ---- 1 · patient ---- */}
          <section data-rise className="surface overflow-hidden">
            <div className="border-b border-[var(--p-border)] px-6 py-4"><h3 className="text-[14px] font-semibold text-[var(--p-ink)]">1 · Patient</h3></div>
            <div className="p-6">
              {!patient ? (
                <>
                  <div className="flex items-center gap-2 rounded-lg border border-[var(--p-border)] px-3.5 py-2.5">
                    <Icon name="search" size={16} />
                    <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, phone or JMH2026OP00123…" className="w-full text-sm outline-none" autoFocus />
                  </div>
                  {(results.length ? results : recent).length > 0 && (
                    <div className="mt-3 space-y-2">
                      {!results.length && <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--p-muted)]">Recent</p>}
                      {(results.length ? results : recent).map((p) => (
                        <button key={p.id} onClick={() => { setPatient(p); setQuery(""); }} className="surface-hover flex w-full items-center justify-between rounded-lg border border-[var(--p-border)] p-3 text-left">
                          <div><div className="text-[14px] font-medium text-[var(--p-ink)]">{p.fullName}</div><div className="text-[12px] text-[var(--p-muted)]"><span className="tabular">{p.displayId}</span> · {p.phone}</div></div>
                          <Icon name="chevron" size={16} />
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center justify-between rounded-xl border border-[var(--p-blue)] bg-[var(--p-blue-soft)] p-4">
                  <div><div className="text-[14px] font-semibold text-[var(--p-ink)]">{patient.fullName}</div><div className="text-[12px] text-[var(--p-muted)]"><span className="tabular">{patient.displayId}</span> · {patient.phone}</div></div>
                  <button onClick={() => { setPatient(null); setVisits([]); setVisitId(""); setItems([]); }} className="rounded-lg border border-[var(--p-border)] bg-white px-3 py-1.5 text-[13px] font-medium text-[var(--p-blue)]">Change</button>
                </div>
              )}
            </div>
          </section>

          {/* The bed board answers IP vs OP. Reception reads it; they don't decide it. */}
          {patient && <AdmissionBanner admission={admission} checking={checkingAdm} what="This prescription" />}

          {/* ---- 2 · which consultation (OP) — or which stay (IP) ---- */}
          <section data-rise className={`surface overflow-hidden ${patient ? "" : "pointer-events-none opacity-55"}`}>
            <div className="border-b border-[var(--p-border)] px-6 py-4">
              <h3 className="text-[14px] font-semibold text-[var(--p-ink)]">
                2 · {admission ? "Filing against the stay" : "Which consultation?"}
              </h3>
              <p className="mt-0.5 text-[13px] text-[var(--p-muted)]">
                {admission
                  ? "They're in a bed — so this pins to the admission, not to an old outpatient visit."
                  : "Link the scan to the visit — the record shows whose handwriting it is."}
              </p>
            </div>
            <div className="p-6">
              {admission ? (
                /* An inpatient Rx does not attach to a consultation. Choosing one
                   would strand the document outside the discharge bill — so the
                   picker is replaced, not merely disabled. */
                <div className="flex items-center gap-3 rounded-lg border border-[var(--p-blue)]/30 bg-[var(--p-blue-soft)] p-4">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--p-blue)] text-white">
                    <Icon name="bed" size={18} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-[var(--p-ink)]">
                      <span className="font-mono">{admission.ipNumber}</span> — {admission.wardName} · {admission.bedNo}
                    </p>
                    <p className="mt-0.5 text-[12px] text-[var(--p-muted)]">
                      Under Dr. {admission.doctorName}. The pharmacy will charge these medicines to the room.
                    </p>
                  </div>
                  <Icon name="check" size={18} />
                </div>
              ) : visits.length === 0 ? (
                <p className="rounded-lg bg-[var(--p-bg)] px-4 py-3 text-[13px] text-[var(--p-muted)]">
                  No completed consultations yet. You can still upload — it just won&apos;t be pinned to a visit.
                </p>
              ) : (
                <div className="space-y-2">
                  {visits.map((v) => (
                    <button key={v.id} onClick={() => setVisitId(visitId === v.id ? "" : v.id)}
                      className={`flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors ${visitId === v.id ? "border-[var(--p-blue)] bg-[var(--p-blue-soft)]" : "border-[var(--p-border)] hover:border-[var(--p-border-strong)]"}`}>
                      <div>
                        <div className="text-[14px] font-medium text-[var(--p-ink)]">{v.doctorName} · {v.department}</div>
                        <div className="text-[12px] text-[var(--p-muted)]"><span className="font-mono">{v.opNumber}</span> · {v.visitDate}</div>
                      </div>
                      {visitId === v.id && <Icon name="check" size={16} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* ---- 3 · vitals (OP visits only — a stay's vitals are a ward-round concern) ---- */}
          {!admission && (
            <section data-rise className={`surface overflow-hidden ${patient && visitId ? "" : "pointer-events-none opacity-55"}`}>
              <div className="border-b border-[var(--p-border)] px-6 py-4">
                <h3 className="text-[14px] font-semibold text-[var(--p-ink)]">3 · Vitals</h3>
                <p className="mt-0.5 text-[13px] text-[var(--p-muted)]">
                  BP, height, weight — whatever the doctor or nurse wrote by hand at triage. Once saved, it prints on the OPD sheet instead of a blank box.
                </p>
              </div>
              <div className="p-6">
                <div className="grid gap-3 sm:grid-cols-4">
                  <Field label="BP systolic">
                    <input className={fld} inputMode="numeric" value={vitals.bpSystolic} placeholder="120"
                      onChange={(e) => setVitals((v) => ({ ...v, bpSystolic: e.target.value.replace(/\D/g, "") }))} />
                  </Field>
                  <Field label="BP diastolic">
                    <input className={fld} inputMode="numeric" value={vitals.bpDiastolic} placeholder="80"
                      onChange={(e) => setVitals((v) => ({ ...v, bpDiastolic: e.target.value.replace(/\D/g, "") }))} />
                  </Field>
                  <Field label="Pulse (bpm)">
                    <input className={fld} inputMode="numeric" value={vitals.pulse} placeholder="76"
                      onChange={(e) => setVitals((v) => ({ ...v, pulse: e.target.value.replace(/\D/g, "") }))} />
                  </Field>
                  <Field label="SpO₂ (%)">
                    <input className={fld} inputMode="numeric" value={vitals.spo2} placeholder="98"
                      onChange={(e) => setVitals((v) => ({ ...v, spo2: e.target.value.replace(/\D/g, "") }))} />
                  </Field>
                  <Field label="Height (cm)">
                    <input className={fld} inputMode="decimal" value={vitals.heightCm} placeholder="165"
                      onChange={(e) => setVitals((v) => ({ ...v, heightCm: e.target.value.replace(/[^0-9.]/g, "") }))} />
                  </Field>
                  <Field label="Weight (kg)">
                    <input className={fld} inputMode="decimal" value={vitals.weightKg} placeholder="68"
                      onChange={(e) => setVitals((v) => ({ ...v, weightKg: e.target.value.replace(/[^0-9.]/g, "") }))} />
                  </Field>
                  <Field label="Temp (°F)">
                    <input className={fld} inputMode="decimal" value={vitals.tempF} placeholder="98.6"
                      onChange={(e) => setVitals((v) => ({ ...v, tempF: e.target.value.replace(/[^0-9.]/g, "") }))} />
                  </Field>
                </div>
                {vitalsError && <p className="mt-3 text-[13px] text-[var(--p-rose)]">{vitalsError}</p>}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--p-border)] pt-4">
                  <p className="text-[12px] text-[var(--p-muted)]">
                    {vitalsSavedAt ? "Saved ✓ — visible on the printed OPD sheet." : "Leave a box blank if it wasn't written down — nothing here is required."}
                  </p>
                  <button onClick={saveVitals} disabled={!visitId || vitalsBusy}
                    className="btn-primary rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                    {vitalsBusy ? <><Spinner /> Saving…</> : "Save vitals"}
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* ---- 4 · scan + medicines ---- */}
          <section data-rise className={`surface overflow-hidden ${patient ? "" : "pointer-events-none opacity-55"}`}>
            <div className="border-b border-[var(--p-border)] px-6 py-4">
              <h3 className="text-[14px] font-semibold text-[var(--p-ink)]">4 · Medicines, labs &amp; sheet</h3>
              <p className="mt-0.5 text-[13px] text-[var(--p-muted)]">Type the medicines, prescribed labs and clinical notes — the OPD sheet PDF carries all of it. Attaching the original scan is optional.</p>
            </div>
            <div className="space-y-5 p-6">
              {/* file */}
              <label className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors ${file ? "border-[var(--p-cyan)] bg-[var(--p-cyan-soft)]" : "border-[var(--p-border-strong)] hover:border-[var(--p-blue)]"}`}>
                <input type="file" accept={ACCEPT} className="hidden" onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
                <Icon name="file" size={22} />
                {file ? (
                  <>
                    <p className="mt-2 text-[14px] font-semibold text-[var(--p-ink)]">{file.name}</p>
                    <p className="text-[12px] text-[var(--p-muted)]">{(file.size / 1024).toFixed(0)} KB · click to replace</p>
                  </>
                ) : (
                  <>
                    <p className="mt-2 text-[14px] font-medium text-[var(--p-ink)]">Optional — drop a scan of the original here</p>
                    <p className="text-[12px] text-[var(--p-muted)]">PDF · JPG · PNG · WebP — up to 10 MB. Not needed to send the sheet.</p>
                  </>
                )}
              </label>

              <Field label="Title (optional)">
                <input className={fld} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={selectedVisit ? `${selectedVisit.department} consult — ${selectedVisit.visitDate}` : "e.g. Cardiology consult"} />
              </Field>

              {/* typed medicines */}
              <div>
                <p className="mb-1.5 text-[13px] font-medium text-[var(--p-text)]">Prescribed medicines <span className="text-[var(--p-muted)]">(typed from the handwriting — this is what makes pharmacy fast)</span></p>
                <div className="grid gap-2 sm:grid-cols-[1fr_72px_1fr_auto]">
                  <div className="relative">
                    <input ref={medBox} className={fld} value={medQuery} onChange={(e) => setMedQuery(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(medQuery); } }}
                      placeholder="Medicine name…" />
                    {medResults.length > 0 && (
                      <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-[var(--p-border)] bg-white shadow-lg">
                        {medResults.map((m) => (
                          <button key={m.id} onClick={() => addItem(m.name, m.id)}
                            className="flex w-full items-center justify-between px-3 py-2 text-left text-[14px] hover:bg-[var(--p-bg)]">
                            <span className="font-medium text-[var(--p-ink)]">{m.name}</span>
                            <span className={`text-[12px] ${m.inStock > 0 ? "text-[var(--p-muted)]" : "text-[var(--p-rose)]"}`}>{m.inStock > 0 ? `${m.inStock} in stock` : "out of stock"}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <input className={fld} value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} placeholder="Qty" inputMode="numeric" />
                  <div className="flex items-center gap-2">
                    <input
                      className={`${fld} w-14 text-center`}
                      maxLength={1}
                      inputMode="numeric"
                      value={dosage.split("-")[0] ?? ""}
                      onChange={(e) => {
                        const morning = e.target.value.replace(/\D/g, "");
                        const [, afternoon = "", night = ""] = dosage.split("-");
                        setDosage(`${morning}-${afternoon}-${night}`);
                      }}
                      placeholder="1"
                    />

                    <span className="text-[var(--p-muted)] font-semibold">-</span>

                    <input
                      className={`${fld} w-14 text-center`}
                      maxLength={1}
                      inputMode="numeric"
                      value={dosage.split("-")[1] ?? ""}
                      onChange={(e) => {
                        const afternoon = e.target.value.replace(/\D/g, "");
                        const [morning = "", , night = ""] = dosage.split("-");
                        setDosage(`${morning}-${afternoon}-${night}`);
                      }}
                      placeholder="0"
                    />

                    <span className="text-[var(--p-muted)] font-semibold">-</span>

                    <input
                      className={`${fld} w-14 text-center`}
                      maxLength={1}
                      inputMode="numeric"
                      value={dosage.split("-")[2] ?? ""}
                      onChange={(e) => {
                        const night = e.target.value.replace(/\D/g, "");
                        const [morning = "", afternoon = ""] = dosage.split("-");
                        setDosage(`${morning}-${afternoon}-${night}`);
                      }}
                      placeholder="1"
                    />
                  </div>
                  <button onClick={() => addItem(medQuery)} disabled={!medQuery.trim()}
                    className="rounded-lg border border-[var(--p-border)] px-3.5 text-[14px] font-medium text-[var(--p-blue)] hover:border-[var(--p-blue)] disabled:opacity-40">Add</button>
                </div>

                {items.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {items.map((it, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-lg border border-[var(--p-border)] px-3 py-2">
                        <span className={`h-1.5 w-1.5 rounded-full ${it.medicineId ? "bg-[var(--p-cyan)]" : "bg-[var(--p-amber, #d9a514)]"}`} title={it.medicineId ? "Matched to pharmacy catalog" : "Free text — pharmacist will match"} />
                        <div className="flex-1 text-[14px] text-[var(--p-ink)]">
                          {it.medicineName} <span className="text-[var(--p-muted)]">× {it.qty}{it.dosage && ` · ${it.dosage}`}</span>
                        </div>
                        <button onClick={() => setItems((p) => p.filter((_, x) => x !== i))} className="text-[var(--p-rose)]">✕</button>
                      </div>
                    ))}

                    {/* Live preview — the same RxTable component the OPD sheet
                        prints with, fed straight from this draft. Nothing is
                        saved yet; this is just what it'll look like once it is. */}
                    <div className="mt-4 overflow-hidden rounded-lg border border-[var(--p-border)]">
                      <p className="border-b border-[var(--p-border)] bg-[var(--p-bg)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--p-muted)]">
                        Live preview — how this prints on the OPD sheet
                      </p>
                      <div className="print-stage" style={{ background: "transparent", minHeight: 0, padding: "10px 14px" }}>
                        <div id="print-sheet" style={{ width: "100%", minHeight: 0, boxShadow: "none", padding: 0, background: "transparent" }}>
                          <RxTable items={items} blankRows={0} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ---- prescribed labs & clinical details — print on the sheet ---- */}
              <div className="border-t border-dashed border-[var(--p-border)] pt-4">
                <p className="mb-1.5 text-[13px] font-medium text-[var(--p-text)]">
                  Prescribed labs &amp; clinical details{" "}
                  <span className="text-[var(--p-muted)]">(optional — whatever is typed prints on the sheet instead of a blank pen line)</span>
                </p>

                {/* labs — chip list, Enter to add */}
                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <input className={fld} value={labInput} onChange={(e) => setLabInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLab(labInput); } }}
                    placeholder="Prescribed lab test — e.g. CBP, RBS, Lipid profile… (Enter to add)" />
                  <button onClick={() => addLab(labInput)} disabled={!labInput.trim()}
                    className="rounded-lg border border-[var(--p-border)] px-3.5 py-2 text-[14px] font-medium text-[var(--p-blue)] hover:border-[var(--p-blue)] disabled:opacity-40">
                    Add lab
                  </button>
                </div>
                {labs.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {labs.map((l, i) => (
                      <span key={l} className="inline-flex items-center gap-2 rounded-full border border-[var(--p-blue)]/30 bg-[var(--p-blue-soft)] py-1 pl-3 pr-2 text-[12.5px] font-medium text-[var(--p-blue-deep)]">
                        <span className="font-mono text-[10px]">{i + 1}.</span> {l}
                        <button onClick={() => setLabs((p) => p.filter((x) => x !== l))} aria-label={`Remove ${l}`}
                          className="grid h-4 w-4 place-items-center rounded-full text-[10px] hover:bg-white/70">✕</button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field label="Diagnosis">
                    <input className={fld} value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)}
                      placeholder="As written on the sheet — e.g. Viral fever" />
                  </Field>
                  <Field label="Next visit">
                    <input className={fld} value={nextVisit} onChange={(e) => setNextVisit(e.target.value)}
                      placeholder="e.g. After 5 days / 21 Aug" />
                  </Field>
                  <Field label="Advice" span>
                    <textarea className={`${fld} min-h-[64px] resize-y`} value={advice} onChange={(e) => setAdvice(e.target.value)}
                      placeholder="Diet, rest, follow-up instructions — prints under the ℞ table" />
                  </Field>
                </div>
              </div>

              <div className="space-y-3 border-t border-[var(--p-border)] pt-4">
                {/* Default: send the generated OPD sheet itself — no scan needed. */}
                {!admission && (
                  <div className="flex flex-wrap items-center justify-end gap-3">
                    <span className="mr-auto text-[12px] text-[var(--p-muted)]">
                      {visitId ? "Sends the typed sheet to pharmacy and files the patient's copy." : "Pick the consultation above to enable this."}
                    </span>
                    <button onClick={() => sendOpdSheet(false)} disabled={!patient || !visitId || busy}
                      className="rounded-lg border border-[var(--p-border)] px-4 py-2.5 text-sm font-medium text-[var(--p-text)] hover:border-[var(--p-blue)] hover:text-[var(--p-blue)] disabled:opacity-40">
                      Save to record
                    </button>
                    <PrimaryButton onClick={() => sendOpdSheet(true)} disabled={!patient || !visitId || busy}>
                      {busy ? <><Spinner /> Working…</> : <><Icon name="pill" size={15} /> Send OPD sheet to pharmacy</>}
                    </PrimaryButton>
                  </div>
                )}

                {/* Optional path, kept intact: send the actual scan if one is attached. */}
                {(file || admission) && (
                  <div className="flex flex-wrap items-center justify-end gap-3 border-t border-dashed border-[var(--p-border)] pt-3">
                    <span className="mr-auto text-[12px] text-[var(--p-muted)]">
                      {admission ? "Inpatient Rx — attach the ward chit and send." : "Attached the original scan? Send that instead:"}
                    </span>
                    <button onClick={() => upload(false)} disabled={!patient || !file || busy}
                      className="rounded-md border border-[var(--p-border)] px-4 py-2.5 text-sm font-medium text-[var(--p-text)] hover:border-[var(--p-blue)] hover:text-[var(--p-blue)] disabled:opacity-40">
                      Upload only
                    </button>
                    <PrimaryButton onClick={() => upload(true)} disabled={!patient || !file || busy}>
                      {busy ? <><Spinner /> Uploading…</> : <><Icon name="file" size={15} /> Upload &amp; send scan</>}
                    </PrimaryButton>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>

        {/* ---- existing uploads ---- */}
        <aside data-rise className="lg:sticky lg:top-24 lg:self-start">
          <div className="surface overflow-hidden">
            <div className="border-b border-[var(--p-border)] px-5 py-4">
              <h3 className="text-[14px] font-semibold text-[var(--p-ink)]">On this patient&apos;s record</h3>
            </div>
            {!patient ? (
              <p className="px-5 py-10 text-center text-[13px] text-[var(--p-muted)]">Pick a patient to see their prescriptions.</p>
            ) : existing.length === 0 ? (
              <p className="px-5 py-10 text-center text-[13px] text-[var(--p-muted)]">Nothing uploaded yet.</p>
            ) : (
              <div className="max-h-[520px] divide-y divide-[var(--p-border)] overflow-y-auto overscroll-contain">
                {existing.map((e) => (
                  <div key={e.id} className="px-5 py-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-[14px] font-medium text-[var(--p-ink)]">{e.title || e.fileName}</div>
                        <div className="text-[12px] text-[var(--p-muted)]">{new Date(e.createdAt).toLocaleDateString("en-IN")}</div>
                      </div>
                      <Pill tone={e.status === "DISPENSED" ? "completed" : e.status === "SENT_TO_PHARMACY" ? "waiting" : "neutral"}>
                        {e.status === "DISPENSED" ? "Dispensed" : e.status === "SENT_TO_PHARMACY" ? "At pharmacy" : "Scanned"}
                      </Pill>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <a href={e.fileUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-[var(--p-border)] px-2.5 py-1 text-[12px] font-medium text-[var(--p-blue)] hover:border-[var(--p-blue)]">View</a>
                      {e.status === "UPLOADED" && (
                        <button onClick={() => sendToPharmacy(e.id)} disabled={busyId === e.id}
                          className="btn-primary rounded-lg px-2.5 py-1 text-[12px] font-semibold text-white disabled:opacity-60">
                          {busyId === e.id ? "…" : "Send to pharmacy"}
                        </button>
                      )}
                      {e.status === "SENT_TO_PHARMACY" && (
                        <button onClick={() => recallFromPharmacy(e.id)} disabled={busyId === e.id}
                          className="rounded-lg border border-[var(--p-border)] px-2.5 py-1 text-[12px] font-medium text-[var(--p-muted)] hover:border-[var(--p-rose)] hover:text-[var(--p-rose)] disabled:opacity-60">
                          {busyId === e.id ? "…" : "Recall"}
                        </button>
                      )}
                      {e.status !== "DISPENSED" && (
                        <button onClick={() => removeFile(e.id)} disabled={busyId === e.id}
                          className="rounded-md border border-[var(--p-border)] px-2.5 py-1 text-[12px] font-medium text-[var(--p-rose)] hover:border-[var(--p-rose)] disabled:opacity-60">Remove</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </PortalScroll>
  );
}