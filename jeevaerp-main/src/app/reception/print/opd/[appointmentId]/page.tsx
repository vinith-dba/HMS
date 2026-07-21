"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { api, ApiClientError } from "@/lib/api-client";
import {
  PRINT_CSS, PrintToolbar, LetterHead, PatientStrip, RuledLine, FilledLine, LabList, RxTable, FooterBand,
  type HospitalInfo,
} from "@/components/print/stationery";

interface Data {
  hospital: HospitalInfo | null;
  appointment: { id: string; opNumber: string; type: string; status: string; visitDate: string; time: string; referredByName: string | null; visitNumber: number };
  doctor: { name: string; specialization: string; department: string };
  patient: { displayId: string; fullName: string; age: number | null; gender: string | null; bloodGroup: string | null; phone: string; address: string | null; city: string | null };
  rxItems: { medicineName: string; qty: number; dosage: string | null }[];
  vitals: {
    bpSystolic: number | null; bpDiastolic: number | null; pulse: number | null;
    tempF: number | null; spo2: number | null; heightCm: number | null; weightKg: number | null;
  } | null;
  clinical: { diagnosis: string | null; advice: string | null; labs: string[]; nextVisit: string | null } | null;
}

const to12h = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  if (isNaN(h)) return hhmm;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m ?? 0).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
};
const pretty = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

/**
 * The vitals boxes — blank for the triage pen until reception types the
 * handwritten numbers in (see /reception/prescriptions). Whatever hasn't
 * been typed yet just stays a blank ruled line, same paper either way.
 * BMI / BSA are computed here from height + weight — never stored, so they
 * can't go stale if either number is corrected later.
 */
function vitalsBoxes(v: Data["vitals"]): { label: string; value: string | null }[] {
  const heightM = v?.heightCm ? v.heightCm / 100 : null;
  const bmi = heightM && v?.weightKg ? v.weightKg / (heightM * heightM) : null;
  const bsa = v?.heightCm && v?.weightKg ? Math.sqrt((v.heightCm * v.weightKg) / 3600) : null;
  return [
    { label: "BP (mmHg)", value: v?.bpSystolic != null && v?.bpDiastolic != null ? `${v.bpSystolic}/${v.bpDiastolic}` : null },
    { label: "Pulse (bpm)", value: v?.pulse != null ? String(v.pulse) : null },
    { label: "Height (cm)", value: v?.heightCm != null ? v.heightCm.toFixed(1) : null },
    { label: "Weight (kg)", value: v?.weightKg != null ? v.weightKg.toFixed(1) : null },
    { label: "Temp (°F)", value: v?.tempF != null ? v.tempF.toFixed(1) : null },
    { label: "BMI", value: bmi ? bmi.toFixed(1) : null },
    { label: "SpO₂ (%)", value: v?.spo2 != null ? String(v.spo2) : null },
    { label: "BSA (m²)", value: bsa ? bsa.toFixed(2) : null },
  ];
}

/**
 * Three ways to print this one sheet:
 *   /print/opd/{appointmentId}                  -> patient block computer-filled
 *   /print/opd/blank                            -> everything empty (print a pad of
 *                                                  these; they're the power-cut fallback)
 *   append ?paper=letterhead to either          -> suppresses the printed header/footer
 *                                                  and leaves matching gaps, for feeding
 *                                                  pre-printed letterhead through the tray
 */
export default function OpdPrintPageWrapper() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-[14px] text-[#5a6a66]">Preparing the OPD sheet…</div>}>
      <OpdPrintPage />
    </Suspense>
  );
}

function OpdPrintPage() {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const params = useSearchParams();
  const isBlank = appointmentId === "blank";
  const onLetterhead = params.get("paper") === "letterhead";
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isBlank) return; // nothing to fetch — the emptiness is the point
    api.get<Data>(`/reception/appointments/${appointmentId}/print`)
      .then(setData)
      .catch((e) => setError(e instanceof ApiClientError ? e.message : "Couldn't load the sheet."));
  }, [appointmentId, isBlank]);

  if (error) return <div className="p-10 text-center text-[14px] text-[#8a3b2e]">{error}</div>;
  if (!isBlank && !data) return <div className="p-10 text-center text-[14px] text-[#5a6a66]">Preparing the OPD sheet…</div>;

  const hospital = data?.hospital ?? null;
  const a = data?.appointment ?? null;
  const doctor = data?.doctor ?? null;
  const p = data?.patient ?? null;
  const rxItems = data?.rxItems ?? [];
  const v = data?.vitals ?? null;
  const clin = data?.clinical ?? null;
  // a blank pad sheet gets more writing room than a padded typed one
  const blankRows = isBlank ? 10 : Math.max(0, 5 - rxItems.length);
  const dash = "";

  return (
    <div className="print-stage">
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      <PrintToolbar title={isBlank ? "OPD case sheet · blank pad" : `OPD sheet · ${a!.opNumber} · ${p!.fullName}`} />

      <div id="print-sheet">
        {onLetterhead ? (
          /* pre-printed letterhead paper: leave the header zone untouched.
             34mm approximates the printed LetterHead's height (logo + red
             wordmark + address + doctor line) — if the actual pre-printed
             stock's header block is taller or shorter, tune this ONE number
             to match; a quick test print against the real paper is the
             fastest way to dial it in exactly. */
          <div style={{ height: "34mm" }} aria-hidden />
        ) : (
          <LetterHead hospital={hospital} doctor={isBlank ? null : doctor} />
        )}

        {isBlank ? (
          <>
            <PatientStrip cells={[
              { k: "Name", v: dash, grow: true, pen: true },
              { k: "Age / Sex", v: dash, pen: true },
              { k: "Phone", v: dash, pen: true },
              { k: "UHID", v: dash, pen: true },
              { k: "OP No", v: dash, pen: true },
            ]} />
            <PatientStrip cells={[
              { k: "Address", v: dash, grow: true, pen: true },
              { k: "Blood", v: dash, pen: true },
              { k: "Date", v: dash, pen: true },
              { k: "Doctor", v: dash, pen: true },
            ]} />
          </>
        ) : (
          <>
            <PatientStrip cells={[
              { k: "Name", v: `${p!.fullName}${p!.age != null || p!.gender ? ` (${[p!.age != null ? `${p!.age}y` : null, p!.gender ?? null].filter(Boolean).join(", ")})` : ""}`, grow: true },
              { k: "Date", v: `${pretty(a!.visitDate)} · ${to12h(a!.time)}`, mono: true },
            ]} />
            <PatientStrip cells={[
              { k: "Phone", v: p!.phone, mono: true },
              { k: "UHID", v: p!.displayId, mono: true },
              { k: "OP No", v: a!.opNumber, mono: true },
            ]} />
            <PatientStrip cells={[
              { k: "Address", v: [p!.address, p!.city].filter(Boolean).join(", "), grow: true },
              { k: "Blood", v: p!.bloodGroup ?? "—" },
              { k: "#Visit", v: String(a!.visitNumber), mono: true },
            ]} />

          </>
        )}

        {/* vitals — computerized once reception has typed them in; still a blank
            ruled box for the triage pen for anything not typed yet */}
        <div className=" flex flex-wrap gap-x-4 gap-y-2.5 py-4.5">
          {vitalsBoxes(isBlank ? null : v).map((b) => (
            <span key={b.label} className="flex items-end gap-1 text-[9.5px] font-semibold text-[#3c4a45]">
              {b.label}{" "}
              {b.value ? (
                <span className="mb-0.5 inline-block min-w-[72px] border-b border-[var(--pr-line)] px-3.5 text-center font-mono text-[10.5px] font-bold" style={{ color: "var(--pr-primary)" }}>
                  {b.value}
                </span>
              ) : (
                <span className="mb-0.5 inline-block w-[52px] border-b border-[var(--pr-line)]" />
              )}
            </span>
          ))}
        </div>

        <div className="rule py-5 text-[11px]">
          <span className="font-bold uppercase tracking-wide text-[#3c4a45]">Allergy:</span>
          <span className="mx-2 inline-block w-[220px] border-b border-[var(--pr-line)] align-middle" />
          <span className="text-[9px] text-[#6b7772]">(REVIEW SOS IN CASE OF DRUG INTOLERANCE)</span>
        </div>

        <RuledLine label="Evaluation / Investigations" lines={2} />
        <FilledLine label="Diagnosis" value={clin?.diagnosis} />

        {/* ℞ table — the heart of the sheet, now the same component the
            stationery file exports (not bespoke markup living only here) */}
        <RxTable
          items={rxItems}
          blankRows={blankRows}
          note="As transcribed at the front desk from the doctor's handwritten prescription — the scanned original stays on the patient's record."
        />

        <div className="mt-2">
          {clin?.labs?.length ? (
            <LabList tests={clin.labs} />
          ) : (
            <RuledLine label="Tests prescribed" />
          )}
          <FilledLine label="Advice" value={clin?.advice} />
          <div className="flex gap-6">
            <div className="flex-1" />
            <div className="w-[260px]"><FilledLine label="Next visit" value={clin?.nextVisit} /></div>
          </div>
        </div>

        {/* signature */}
        <div className="mb-4 mt-6 flex items-end justify-between">
          <p className="text-[8.5px] text-[#6b7772]">
            {isBlank
              ? "Attach to the patient's visit record. Not valid for medico-legal use without signature."
              : `This sheet accompanies the visit record ${a!.opNumber}. Not valid for medico-legal use without signature.`}
          </p>
          <div className="text-center">
            <div className="mx-auto w-[180px] border-b border-[var(--pr-ink)]" />
            <div className="mt-1 text-[11px] font-semibold">{isBlank ? "Doctor's signature & seal" : `Dr. ${doctor!.name}`}</div>
            <div className="text-[8.5px] text-[#57655f]">{isBlank ? "Reg. no." : `${doctor!.specialization} · ${doctor!.department}`}</div>
          </div>
        </div>

        {onLetterhead ? <div style={{ height: "14mm" }} aria-hidden /> : <FooterBand hospital={hospital} />}
      </div>
    </div>
  );
}