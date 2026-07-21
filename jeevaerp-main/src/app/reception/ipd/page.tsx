"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/portal/ui/icons";
import { Spinner } from "@/components/portal/ui/form-atoms";
import { PortalScroll } from "@/components/portal/portal-scroll";
import { api, ApiClientError } from "@/lib/api-client";

interface Bed {
  id: string; bedNo: string; status: string;
  patient: { displayId: string; fullName: string; ipNumber: string; admissionId: string } | null;
}
interface Ward {
  id: string; name: string; category: string; floor: string | null;
  dailyCharge: string; gstRatePct: string; available: number; total: number; beds: Bed[];
}
interface Board { summary: { total: number; available: number; occupied: number; maintenance: number }; wards: Ward[]; }
interface FreeWard {
  id: string; name: string; dailyCharge: string; gstRatePct: string;
  beds: { id: string; bedNo: string }[];
}
interface Doctor { id: string; name: string; department: string; }
interface Patient { id: string; displayId: string; fullName: string; phone: string; age?: number | null; gender?: string | null; }

/** The occupant panel is the admission sheet — no new endpoint needed. */
interface Sheet {
  admission: {
    id: string; ipNumber: string; status: string; admittedAt: string; reason: string | null;
    wardName: string; bedNo: string; dailyCharge: string; gstRatePct: string;
    attendantName: string | null; attendantPhone: string | null; attendantRelation: string | null;
    patient: { id: string; displayId: string; fullName: string; age: number | null; gender: string | null; phone: string };
    doctor: { name: string; department: string };
  };
  days: number; bedTotal: string; chargesTotal: string; grandTotal: string;
  charges: { id: string }[];
}

const blank = { reason: "", attendantName: "", attendantPhone: "", attendantRelation: "", notes: "" };
const money = (v: string | number) => Number(v).toLocaleString("en-IN", { maximumFractionDigits: 0 });

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

/**
 * A bed, drawn as a bed.
 *
 * A coloured square tells you nothing at a glance; a made bed vs. a bed with
 * someone in it does. Occupied beds get a blanket, a pillow dent and a head —
 * so the board reads as a ward from across the room, which is how a receptionist
 * actually uses it.
 */
function BedGlyph({ status }: { status: string }) {
  const occupied = status === "OCCUPIED";
  const maint = status === "MAINTENANCE";
  return (
    <svg viewBox="0 0 76 46" className="bed-svg" role="img" aria-label={occupied ? "Occupied bed" : maint ? "Bed out of service" : "Empty bed"}>
      {/* legs */}
      <rect className="bd-frame" x="7" y="36" width="3.5" height="8" rx="1.75" />
      <rect className="bd-frame" x="65" y="36" width="3.5" height="8" rx="1.75" />
      {/* headboard + footboard */}
      <rect className="bd-frame" x="5" y="9" width="5.5" height="29" rx="2.75" />
      <rect className="bd-frame" x="64.5" y="22" width="5.5" height="16" rx="2.75" />
      {/* mattress */}
      <rect className="bd-mattress" x="9" y="25" width="56" height="11" rx="3.5" />
      {/* pillow */}
      <rect className="bd-pillow" x="12" y="16" width="17" height="9.5" rx="4.5" />

      {occupied && (
        <>
          {/* blanket, drawn over the mattress */}
          <path className="bd-blanket" d="M31 25h29a4.5 4.5 0 0 1 4.5 4.5v2A4.5 4.5 0 0 1 60 36H31z" />
          {/* knees */}
          <path className="bd-blanket" d="M45 25.4c3.4-5.6 10-5.6 13.2 0z" />
          {/* head on the pillow */}
          <circle className="bd-head" cx="22" cy="19" r="5.2" />
        </>
      )}

      {maint && <line className="bd-slash" x1="18" y1="12" x2="58" y2="38" />}
    </svg>
  );
}

export default function BedBoardPage() {
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  // ── admit panel (always on screen, like the demo) ──
  const [freeWards, setFreeWards] = useState<FreeWard[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [pq, setPq] = useState("");
  const [pResults, setPResults] = useState<Patient[]>([]);
  const [wardId, setWardId] = useState("");
  const [bedId, setBedId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [form, setForm] = useState({ ...blank });
  const [busy, setBusy] = useState(false);
  const [doneIp, setDoneIp] = useState<{ ipNumber: string; bedNo: string; ward: string } | null>(null);

  // ── occupant drawer ──
  const [occupant, setOccupant] = useState<Sheet | null>(null);
  const [occupantLoading, setOccupantLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [b, fw] = await Promise.all([
        api.get<Board>("/ipd/board"),
        api.get<{ wards: FreeWard[] }>("/ipd/beds/available"),
      ]);
      setBoard(b);
      const withBeds = fw.wards.filter((w) => w.beds.length > 0);
      setFreeWards(withBeds);
      setWardId((cur) => (withBeds.some((w) => w.id === cur) ? cur : withBeds[0]?.id ?? ""));
    } catch (e) { setError(e instanceof ApiClientError ? e.message : "Couldn't load the board."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api.get<{ doctors: Doctor[] }>("/reception/doctors").then((r) => setDoctors(r.doctors)).catch(() => {});
  }, []);

  // keep the bed dropdown honest whenever the ward changes
  useEffect(() => {
    const w = freeWards.find((x) => x.id === wardId);
    setBedId((cur) => (w?.beds.some((b) => b.id === cur) ? cur : w?.beds[0]?.id ?? ""));
  }, [wardId, freeWards]);

  useEffect(() => {
    if (patient || !pq.trim()) { setPResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const { patients } = await api.get<{ patients: Patient[] }>(`/reception/patients?q=${encodeURIComponent(pq)}&limit=6`);
        setPResults(patients);
      } catch { setPResults([]); }
    }, 250);
    return () => clearTimeout(t);
  }, [pq, patient]);

  const selectedWard = freeWards.find((w) => w.id === wardId) ?? null;

  /** Tap a bed: free → load it into the admit panel; occupied → who's in it. */
  async function tapBed(b: Bed, w: Ward) {
    if (b.status === "MAINTENANCE") return;
    if (b.status === "AVAILABLE") {
      const fw = freeWards.find((x) => x.id === w.id);
      if (fw?.beds.some((x) => x.id === b.id)) { setWardId(w.id); setBedId(b.id); }
      setOccupant(null);
      return;
    }
    if (!b.patient) return;
    setOccupantLoading(true); setOccupant(null);
    try { setOccupant(await api.get<Sheet>(`/ipd/admissions/${b.patient.admissionId}/sheet`)); }
    catch (e) { setError(e instanceof ApiClientError ? e.message : "Couldn't load the patient."); }
    finally { setOccupantLoading(false); }
  }

  async function admit() {
    if (!patient || !bedId || !doctorId) return;
    setBusy(true); setError(null);
    try {
      const res = await api.post<{ ipNumber: string; bedNo: string; ward: string }>("/ipd/admissions", {
        patientDisplayId: patient.displayId,
        bedId, doctorId,
        reason: form.reason || undefined,
        attendantName: form.attendantName || undefined,
        attendantPhone: form.attendantPhone || undefined,
        attendantRelation: form.attendantRelation || undefined,
        notes: form.notes || undefined,
      });
      setDoneIp(res);
      setPatient(null); setPq(""); setDoctorId(""); setForm({ ...blank }); setBedId("");
      await load();
    } catch (e) { setError(e instanceof ApiClientError ? e.message : "Could not admit."); }
    finally { setBusy(false); }
  }

  const fld = "w-full rounded-lg border border-[var(--p-border)] bg-white px-3 py-2 text-sm text-[var(--p-ink)] outline-none transition-colors focus:border-[var(--p-blue)]";
  const lbl = "mb-1.5 block text-[13px] font-medium text-[var(--p-text)]";

  return (
    <PortalScroll>
      <style>{CSS}</style>
      <Suspense fallback={null}>
        <PatientFromUrl onFound={(p) => { setPatient(p); setPq(""); }} />
      </Suspense>

      <div data-rise className="surface dotgrid mb-5 flex flex-wrap items-center justify-between gap-4 px-6 py-5">
        <div>
          <h1 className="font-serif-p text-[22px] font-semibold text-[var(--p-ink)]">IP desk — inpatients &amp; beds</h1>
          <p className="mt-1 text-[14px] text-[var(--p-muted)]">
            Every bed in the hospital. Tap an <b className="text-[var(--p-ink)]">empty</b> bed to pick it, or an
            <b className="text-[var(--p-ink)]"> occupied</b> one to see who&apos;s in it.
          </p>
        </div>
        <Link href="/ipd/inpatients" className="inline-flex items-center gap-2 rounded-lg border border-[var(--p-border)] px-4 py-2.5 text-sm font-medium text-[var(--p-text)] hover:border-[var(--p-blue)] hover:text-[var(--p-blue)]">
          <Icon name="bed" size={15} /> Inpatients &amp; discharge
        </Link>
      </div>

      <div data-rise className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total beds" value={board?.summary.total ?? 0} tone="ink" />
        <Stat label="Empty" value={board?.summary.available ?? 0} tone="ok" />
        <Stat label="Occupied" value={board?.summary.occupied ?? 0} tone="busy" />
        <Stat label="Out of service" value={board?.summary.maintenance ?? 0} tone="off" />
      </div>

      {flash && (
        <div data-rise className="mb-4 flex items-center justify-between rounded-lg border border-[var(--p-cyan)]/30 bg-[var(--p-cyan-soft)] px-4 py-3 text-[14px] font-medium text-[var(--p-cyan-deep)]">
          <span className="flex items-center gap-2"><Icon name="check" size={15} /> {flash}</span>
          <button onClick={() => setFlash(null)}>✕</button>
        </div>
      )}
      {error && <div data-rise className="mb-4 rounded-lg border border-[var(--p-rose)]/25 bg-[var(--p-rose-soft)] px-4 py-3 text-[14px] text-[var(--p-rose)]">{error}</div>}

      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        {/* ───────── BED BOARD ───────── */}
        <section data-rise className="surface overflow-hidden">
          <div className="border-b border-[var(--p-border)] px-6 py-4">
            <h2 className="text-[14px] font-semibold text-[var(--p-ink)]">Ward &amp; bed board</h2>
            <p className="mt-0.5 text-[13px] text-[var(--p-muted)]">
              Live. Discharging frees the bed for the next admission immediately.
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-24 text-[14px] text-[var(--p-muted)]"><Spinner /> Loading…</div>
          ) : !board?.wards.length ? (
            <div className="flex flex-col items-center px-6 py-20 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-full border border-[var(--p-border)] text-[var(--p-muted)]"><Icon name="bed" size={20} /></span>
              <p className="mt-3 text-[14px] font-semibold text-[var(--p-ink)]">No wards yet.</p>
              <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-[var(--p-muted)]">
                An admin creates them under <b>Wards &amp; beds</b> — there&apos;s a one-click standard layout there.
                (Or run <span className="font-mono">npx prisma db seed</span>.)
              </p>
            </div>
          ) : (
            <div className="space-y-6 p-6">
              {board.wards.map((w) => (
                <div key={w.id}>
                  <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <h3 className="text-[14px] font-semibold text-[var(--p-ink)]">{w.name}</h3>
                      <p className="text-[12px] text-[var(--p-muted)]">
                        ₹{money(w.dailyCharge)}/day{Number(w.gstRatePct) > 0 && ` · ${w.gstRatePct}% GST`}
                        {w.floor && ` · ${w.floor}`}
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${
                      w.available === 0 ? "bg-[var(--p-rose-soft)] text-[var(--p-rose)]" : "bg-[var(--p-cyan-soft)] text-[var(--p-cyan-deep)]"}`}>
                      {w.total - w.available}/{w.total} occupied
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
                    {w.beds.map((b) => {
                      const st = b.status.toLowerCase();
                      const picked = bedId === b.id;
                      const shown = occupant?.admission.id === b.patient?.admissionId && !!b.patient;
                      return (
                        <button key={b.id} onClick={() => tapBed(b, w)}
                          disabled={b.status === "MAINTENANCE"}
                          className={`bed-card bed-${st} ${picked ? "is-picked" : ""} ${shown ? "is-shown" : ""}`}>
                          <BedGlyph status={b.status} />
                          <span className="bed-no">{b.bedNo}</span>
                          {b.patient ? (
                            <>
                              <span className="bed-who">{b.patient.fullName}</span>
                              <span className="bed-ip">{b.patient.ipNumber}</span>
                            </>
                          ) : (
                            <span className="bed-free">{b.status === "MAINTENANCE" ? "Out of service" : "Empty"}</span>
                          )}
                          {picked && <span className="bed-tick"><Icon name="check" size={11} /></span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ───────── RIGHT RAIL ───────── */}
        <div className="space-y-5">
          {/* WHO'S IN THIS BED */}
          {(occupant || occupantLoading) && (
            <section data-rise className="surface overflow-hidden xl:sticky xl:top-4">
              <div className="flex items-center justify-between border-b border-[var(--p-border)] px-5 py-3.5">
                <h2 className="text-[14px] font-semibold text-[var(--p-ink)]">Who&apos;s in this bed</h2>
                <button onClick={() => setOccupant(null)} className="text-[var(--p-muted)] hover:text-[var(--p-ink)]">✕</button>
              </div>
              {occupantLoading || !occupant ? (
                <div className="flex items-center justify-center gap-2 py-12 text-[14px] text-[var(--p-muted)]"><Spinner /> Loading…</div>
              ) : (
                <>
                  <div className="border-b border-[var(--p-border)] px-5 py-4">
                    <p className="text-[16px] font-semibold text-[var(--p-ink)]">{occupant.admission.patient.fullName}</p>
                    <p className="mt-0.5 text-[13px] text-[var(--p-muted)]">
                      <span className="font-mono">{occupant.admission.patient.displayId}</span>
                      {occupant.admission.patient.age != null && ` · ${occupant.admission.patient.age}y`}
                      {occupant.admission.patient.gender && ` · ${occupant.admission.patient.gender}`}
                    </p>
                    <a href={`tel:${occupant.admission.patient.phone}`} className="mt-1 inline-block font-mono text-[13px] font-medium text-[var(--p-blue)]">
                      {occupant.admission.patient.phone}
                    </a>
                  </div>

                  <dl className="divide-y divide-[var(--p-border)] text-[14px]">
                    <Row k="IP number" v={<span className="font-mono font-semibold text-[var(--p-ink)]">{occupant.admission.ipNumber}</span>} />
                    <Row k="Bed" v={<>{occupant.admission.wardName} · <b className="text-[var(--p-ink)]">{occupant.admission.bedNo}</b></>} />
                    <Row k="Attending" v={<>Dr. {occupant.admission.doctor.name} <span className="text-[var(--p-muted)]">({occupant.admission.doctor.department})</span></>} />
                    <Row k="Admitted" v={<>{new Date(occupant.admission.admittedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · <b className="text-[var(--p-ink)]">day {occupant.days}</b></>} />
                    {occupant.admission.reason && <Row k="Reason" v={occupant.admission.reason} />}
                    {occupant.admission.attendantName && (
                      <Row k="Attendant" v={
                        <>
                          {occupant.admission.attendantName}
                          {occupant.admission.attendantRelation && <span className="text-[var(--p-muted)]"> ({occupant.admission.attendantRelation})</span>}
                          {occupant.admission.attendantPhone && (
                            <a href={`tel:${occupant.admission.attendantPhone}`} className="ml-1 block font-mono text-[13px] text-[var(--p-blue)]">
                              {occupant.admission.attendantPhone}
                            </a>
                          )}
                        </>
                      } />
                    )}
                  </dl>

                  <div className="border-t border-[var(--p-border)] bg-[var(--p-bg)] px-5 py-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] text-[var(--p-muted)]">Running bill</span>
                      <span className="font-mono text-[17px] font-bold text-[var(--p-ink)]">₹{money(occupant.grandTotal)}</span>
                    </div>
                    <p className="mt-0.5 text-[12px] text-[var(--p-muted)]">
                      bed ₹{money(occupant.bedTotal)} ({occupant.days}d)
                      {occupant.charges.length > 0 && <> + {occupant.charges.length} charge{occupant.charges.length === 1 ? "" : "s"} ₹{money(occupant.chargesTotal)}</>}
                    </p>
                    <div className="mt-3 flex gap-2">
                      <Link href={`/ipd/${occupant.admission.id}`}
                        className="flex-1 rounded-lg bg-[var(--p-blue)] px-3 py-2 text-center text-[13px] font-semibold text-white hover:bg-[var(--p-blue-deep)]">
                        Open sheet
                      </Link>
                      <Link href="/ipd/inpatients"
                        className="flex-1 rounded-lg border border-[var(--p-border)] px-3 py-2 text-center text-[13px] font-medium text-[var(--p-text)] hover:border-[var(--p-blue)]">
                        Discharge
                      </Link>
                    </div>
                  </div>
                </>
              )}
            </section>
          )}

          {/* ADMIT */}
          <section data-rise className="surface overflow-hidden">
            <div className="border-b border-[var(--p-border)] px-5 py-3.5">
              <h2 className="text-[14px] font-semibold text-[var(--p-ink)]">Admit a patient</h2>
              <p className="mt-0.5 text-[13px] leading-relaxed text-[var(--p-muted)]">
                Move an outpatient into a bed. Only <b>empty</b> beds are offered — you can&apos;t double-book one.
              </p>
            </div>

            {doneIp ? (
              <div className="flex flex-col items-center px-6 py-10 text-center">
                <span className="grid h-13 w-13 place-items-center rounded-full bg-[var(--p-cyan-soft)] p-3 text-[var(--p-cyan-deep)]"><Icon name="check" size={24} /></span>
                <h3 className="mt-3 font-serif-p text-[19px] font-semibold text-[var(--p-ink)]">Admitted</h3>
                <p className="mt-1 text-[14px] text-[var(--p-muted)]">
                  <span className="font-mono font-semibold text-[var(--p-ink)]">{doneIp.ipNumber}</span><br />
                  {doneIp.ward} · {doneIp.bedNo}
                </p>
                <p className="mt-2 text-[12px] leading-relaxed text-[var(--p-muted)]">
                  Bed charges start today. Add procedures and prescriptions on the sheet.
                </p>
                <button onClick={() => setDoneIp(null)}
                  className="mt-5 w-full rounded-lg bg-[var(--p-blue)] px-4 py-2.5 text-sm font-semibold text-white">
                  Admit someone else
                </button>
              </div>
            ) : (
              <div className="space-y-4 p-5">
                {/* patient */}
                <div>
                  <label className={lbl}>Patient <span className="text-[var(--p-rose)]">*</span></label>
                  {patient ? (
                    <div className="flex items-center justify-between rounded-lg border border-[var(--p-blue)]/30 bg-[var(--p-blue-soft)] px-3 py-2.5">
                      <div className="min-w-0">
                        <div className="truncate text-[14px] font-semibold text-[var(--p-ink)]">{patient.fullName}</div>
                        <div className="font-mono text-[12px] text-[var(--p-muted)]">{patient.displayId}</div>
                      </div>
                      <button onClick={() => { setPatient(null); setPq(""); }} className="text-[13px] font-medium text-[var(--p-blue-deep)] underline underline-offset-2">Change</button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 rounded-lg border border-[var(--p-border)] px-3 py-2">
                        <Icon name="search" size={15} />
                        <input value={pq} onChange={(e) => setPq(e.target.value)} placeholder="Patient ID, name or phone…" className="w-full bg-transparent text-sm outline-none" />
                      </div>
                      {pResults.length > 0 && (
                        <div className="mt-1.5 divide-y divide-[var(--p-border)] rounded-lg border border-[var(--p-border)]">
                          {pResults.map((p) => (
                            <button key={p.id} onClick={() => { setPatient(p); setPq(""); }}
                              className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-[var(--p-bg)]">
                              <span className="truncate text-[14px] text-[var(--p-ink)]">{p.fullName}</span>
                              <span className="ml-2 shrink-0 font-mono text-[12px] text-[var(--p-muted)]">{p.displayId}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* ward + bed */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>Ward <span className="text-[var(--p-rose)]">*</span></label>
                    <select className={fld} value={wardId} onChange={(e) => setWardId(e.target.value)}>
                      {freeWards.length === 0 && <option value="">No beds free</option>}
                      {freeWards.map((w) => <option key={w.id} value={w.id}>{w.name} ({w.beds.length} free)</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Bed <span className="text-[var(--p-rose)]">*</span></label>
                    <select className={fld} value={bedId} onChange={(e) => setBedId(e.target.value)} disabled={!selectedWard}>
                      {!selectedWard && <option value="">—</option>}
                      {selectedWard?.beds.map((b) => <option key={b.id} value={b.id}>{b.bedNo}</option>)}
                    </select>
                  </div>
                </div>
                {selectedWard && (
                  <p className="-mt-2 text-[12px] text-[var(--p-muted)]">
                    ₹{money(selectedWard.dailyCharge)}/day{Number(selectedWard.gstRatePct) > 0 && ` + ${selectedWard.gstRatePct}% GST`} — locked at admission.
                  </p>
                )}

                <div>
                  <label className={lbl}>Attending doctor <span className="text-[var(--p-rose)]">*</span></label>
                  <select className={fld} value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
                    <option value="">Choose a doctor…</option>
                    {doctors.map((d) => <option key={d.id} value={d.id}>{d.name} — {d.department}</option>)}
                  </select>
                </div>

                <div>
                  <label className={lbl}>Reason for admission</label>
                  <input className={fld} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Post-op observation…" />
                </div>

                <div className="rounded-lg border border-[var(--p-border)] bg-[var(--p-bg)] p-3">
                  <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--p-muted)]">Caring person</p>
                  <div className="space-y-2">
                    <input className={fld} value={form.attendantName} onChange={(e) => setForm({ ...form, attendantName: e.target.value })} placeholder="Name" />
                    <div className="grid grid-cols-2 gap-2">
                      <input className={fld} value={form.attendantPhone} inputMode="numeric" onChange={(e) => setForm({ ...form, attendantPhone: e.target.value.replace(/\D/g, "").slice(0, 10) })} placeholder="Phone" />
                      <input className={fld} value={form.attendantRelation} onChange={(e) => setForm({ ...form, attendantRelation: e.target.value })} placeholder="Relation" />
                    </div>
                  </div>
                  <p className="mt-1.5 text-[12px] text-[var(--p-muted)]">Who the hospital rings at 3am.</p>
                </div>

                <button onClick={admit} disabled={busy || !patient || !bedId || !doctorId}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--p-blue)] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--p-blue-deep)] disabled:opacity-40">
                  {busy ? <><Spinner /> Admitting…</> : <><Icon name="bed" size={16} /> Admit &amp; assign bed</>}
                </button>
                {!patient && <p className="text-center text-[12px] text-[var(--p-muted)]">Find the patient first.</p>}
              </div>
            )}
          </section>
        </div>
      </div>
    </PortalScroll>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 py-2.5">
      <dt className="shrink-0 text-[13px] text-[var(--p-muted)]">{k}</dt>
      <dd className="text-right text-[14px] text-[var(--p-text)]">{v}</dd>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "ink" | "ok" | "busy" | "off" }) {
  const c = { ink: "var(--p-ink)", ok: "var(--p-cyan-deep)", busy: "var(--p-blue)", off: "var(--p-muted)" }[tone];
  return (
    <div className="surface px-4 py-3.5">
      <div className="text-[12px] font-semibold uppercase tracking-wide text-[var(--p-muted)]">{label}</div>
      <div className="mt-0.5 font-mono text-[24px] font-bold" style={{ color: c }}>{value}</div>
    </div>
  );
}

const CSS = `
.bed-card { position: relative; display: flex; flex-direction: column; align-items: center;
  gap: 2px; border-radius: 12px; border: 1px solid var(--p-border); background: #fff;
  padding: 12px 8px 10px; text-align: center; transition: border-color .16s ease, transform .12s ease, box-shadow .16s ease; }
.bed-card:not(:disabled):hover { transform: translateY(-2px); box-shadow: 0 6px 18px rgba(9,26,52,.08); }
.bed-svg { width: 100%; max-width: 76px; height: auto; margin-bottom: 4px; }
.bed-no { font-family: var(--font-mono); font-size: 12px; font-weight: 700; color: var(--p-ink); letter-spacing: .04em; }
.bed-who { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-size: 12px; font-weight: 600; color: var(--p-ink); }
.bed-ip { font-family: var(--font-mono); font-size: 10px; color: var(--p-muted); }
.bed-free { font-size: 11px; color: var(--p-muted); }

/* the bed itself */
.bd-frame    { fill: var(--p-border-strong); }
.bd-mattress { fill: #fff; stroke: var(--p-border-strong); stroke-width: 1.4; }
.bd-pillow   { fill: var(--p-bg); stroke: var(--p-border-strong); stroke-width: 1.2; }
.bd-blanket  { fill: var(--p-blue); opacity: .85; }
.bd-head     { fill: var(--p-ink); }
.bd-slash    { stroke: var(--p-muted); stroke-width: 3; stroke-linecap: round; opacity: .5; }

/* EMPTY — quiet, clickable, inviting */
.bed-available { border-color: rgba(0,188,199,.35); background: rgba(0,188,199,.05); cursor: pointer; }
.bed-available:hover { border-color: var(--p-cyan); }
.bed-available .bd-frame    { fill: var(--p-cyan-deep); opacity: .55; }
.bed-available .bd-mattress { stroke: var(--p-cyan-deep); stroke-opacity: .45; }
.bed-available .bd-pillow   { fill: rgba(0,188,199,.12); stroke: var(--p-cyan-deep); stroke-opacity: .4; }

/* OCCUPIED — there is a person in it, and you can see that */
.bed-occupied { border-color: rgba(11,92,255,.3); background: rgba(11,92,255,.05); cursor: pointer; }
.bed-occupied:hover { border-color: var(--p-blue); }
.bed-occupied .bd-frame    { fill: var(--p-blue-deep); opacity: .5; }
.bed-occupied .bd-mattress { fill: #fff; stroke: var(--p-blue-deep); stroke-opacity: .35; }
.bed-occupied .bd-pillow   { fill: rgba(11,92,255,.1); stroke: var(--p-blue-deep); stroke-opacity: .35; }

/* OUT OF SERVICE — visibly not a choice */
.bed-maintenance { border-style: dashed; background: var(--p-bg); cursor: not-allowed; opacity: .7; }
.bed-maintenance .bd-frame    { fill: var(--p-border-strong); }
.bed-maintenance .bd-mattress { stroke: var(--p-border-strong); }

/* selected in the admit panel */
.is-picked { border-color: var(--p-blue) !important; background: var(--p-blue-soft) !important;
  box-shadow: 0 0 0 3px var(--p-blue-glow); }
.bed-tick { position: absolute; top: 6px; right: 6px; display: grid; place-items: center;
  height: 18px; width: 18px; border-radius: 999px; background: var(--p-blue); color: #fff; }

/* whose details are open on the right */
.is-shown { border-color: var(--p-blue) !important; box-shadow: 0 0 0 3px var(--p-blue-glow); }

@media (prefers-reduced-motion: reduce) { .bed-card:hover { transform: none; } }
`;
