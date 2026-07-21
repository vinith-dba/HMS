"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PrimaryButton } from "@/components/portal/ui/primitives";
import { Icon } from "@/components/portal/ui/icons";
import { DoctorAvatar } from "@/components/marketing/doctor-avatar";
import { Spinner, SuccessCheck, Field } from "@/components/portal/ui/form-atoms";
import { DiscountInput, PaymentSection, type Tender } from "@/components/portal/ui/bill-fields";
import { PortalScroll } from "@/components/portal/portal-scroll";
import { api, ApiClientError } from "@/lib/api-client";
import PortalDatePicker from "@/components/portal/ui/datepicker";

interface Patient { id: string; displayId: string; fullName: string; age: number | null; phone: string; gender?: string | null; bloodGroup?: string | null; }
interface Doctor { id: string; name: string; specialization: string; department: string; fee: string; qualification: string | null; experienceYears: number | null; age: number | null; languages: string | null; photoUrl: string | null; bio: string | null; }
interface Slot { id: string; startTime: string; endTime: string; }
interface Booked {
  id: string; opNumber: string; time: string; price: string;
  patient: { name: string; displayId: string };
  doctor: { name: string; department: string };
  invoice?: { id: string; receiptNo: string; totalAmount: string; status: string };
}

const todayISO = () => new Date().toISOString().slice(0, 10);
const inits = (n: string) => n.split(" ").map((x) => x[0]).slice(0, 2).join("");
const prettyDate = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });

/**
 * Reads ?patient=JMH... and hands the resolved patient up. Lets Register,
 * the patient file, and the Today queue drop straight into this form with the
 * patient already chosen — reception never searches the same person twice.
 * (Own component so useSearchParams sits under <Suspense>; Next 15 requires it.)
 */
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

export default function BookAppointmentPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Patient[]>([]);
  const [recent, setRecent] = useState<Patient[]>([]);
  const [searching, setSearching] = useState(false);
  const [patient, setPatient] = useState<Patient | null>(null);

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [doctorId, setDoctorId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotId, setSlotId] = useState("");
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const [referredBy, setReferredBy] = useState("");
  const [referralSource, setReferralSource] = useState("");

  const [booking, setBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booked, setBooked] = useState<Booked | null>(null);
  const [prefilled, setPrefilled] = useState(false);

  useEffect(() => {
    api.get<{ doctors: Doctor[] }>("/reception/doctors").then((r) => setDoctors(r.doctors)).catch(() => { });
    api.get<{ patients: Patient[] }>("/reception/patients/recent").then((r) => setRecent(r.patients)).catch(() => { });
  }, []);

  useEffect(() => {
    if (patient || !query.trim()) { setResults([]); return; }
    let active = true; setSearching(true);
    const t = setTimeout(async () => {
      try { const { patients } = await api.get<{ patients: Patient[] }>(`/reception/patients?q=${encodeURIComponent(query)}&limit=6`); if (active) setResults(patients); }
      catch { if (active) setResults([]); } finally { if (active) setSearching(false); }
    }, 250);
    return () => { active = false; clearTimeout(t); };
  }, [query, patient]);

  useEffect(() => {
    if (!doctorId) { setSlots([]); return; }
    let active = true; setLoadingSlots(true); setSlotId("");
    api.get<{ slots: Slot[] }>(`/reception/slots?doctorId=${doctorId}&date=${date}`)
      .then((r) => { if (active) setSlots(r.slots); }).catch(() => { if (active) setSlots([]); }).finally(() => { if (active) setLoadingSlots(false); });
    return () => { active = false; };
  }, [doctorId, date]);

  // Rebuild the whole future grid at a 10-minute cadence, then refresh this view.
  async function regenerateSlots() {
    setRegenerating(true);
    try {
      await api.post("/reception/slots/regenerate");
      if (doctorId) {
        const { slots } = await api.get<{ slots: Slot[] }>(`/reception/slots?doctorId=${doctorId}&date=${date}`);
        setSlots(slots); setSlotId("");
      }
    } catch { /* ignore */ } finally { setRegenerating(false); }
  }

  const [billNow, setBillNow] = useState(true);
  const [bookDisc, setBookDisc] = useState(0);
  const [payments, setPayments] = useState<Tender[]>([]);
  const [payValid, setPayValid] = useState(true);

  async function book() {
    if (!patient || !slotId) return;
    setError(null); setBooking(true);
    try {
      const fee = Number(doctors.find((d) => d.id === doctorId)?.fee ?? 0);
      const { appointment } = await api.post<{ appointment: Booked }>("/reception/appointments", {
        patientId: patient.id, slotId, type: "WALKIN", referredByName: referredBy || undefined, referralSource: referralSource || undefined,
        ...(billNow ? { billNow: { discountAmount: bookDisc || undefined, payments: payments.length ? payments : undefined } } : {}),
      });
      setBooked(appointment);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not book. Please try again.");
      if (doctorId) { const { slots } = await api.get<{ slots: Slot[] }>(`/reception/slots?doctorId=${doctorId}&date=${date}`); setSlots(slots); setSlotId(""); }
    } finally { setBooking(false); }
  }

  function reset() {
    setBooked(null); setPatient(null); setQuery(""); setResults([]); setDoctorId(""); setSlotId(""); setSlots([]); setError(null); setReferredBy(""); setReferralSource(""); setBookDisc(0); setPayments([]); setPayValid(true);
  }

  const doctor = doctors.find((d) => d.id === doctorId);
  const slot = slots.find((s) => s.id === slotId);
  const bookFee = Number(doctor?.fee ?? 0);
  const bookTotal = Math.max(0, bookFee - bookDisc);
  const fld = "w-full rounded-lg border border-[var(--p-border)] bg-white px-3.5 py-2.5 text-sm text-[var(--p-ink)] ring";

  const step1Done = !!patient;
  const step2Done = !!patient && !!doctor && !!slotId;

  if (booked) {
    return (
      <div className="mx-auto max-w-lg">
        <div className="surface overflow-hidden">
          <div className="dotgrid flex flex-col items-center border-b border-[var(--p-border)] px-8 py-10 text-center">
            <SuccessCheck size={52} />
            <h3 className="mt-4 font-serif-p text-[24px] font-semibold text-[var(--p-ink)]">Appointment confirmed</h3>
            <p className="mt-1 text-[14px] text-[var(--p-muted)]">Added to {booked.doctor.name}&apos;s queue.</p>
          </div>
          <div className="grid grid-cols-2 gap-px bg-[var(--p-border)]">
            <Cell k="OP number" v={booked.opNumber} mono />
            <Cell k="Consultation fee" v={`₹${booked.price}`} mono />
            <Cell k="Patient" v={booked.patient.name} />
            <Cell k="Jeeva ID" v={booked.patient.displayId} mono />
            <Cell k="Doctor" v={booked.doctor.name} />
            <Cell k="Time" v={booked.time} mono />
            {booked.invoice && <Cell k="Receipt" v={booked.invoice.receiptNo} mono />}
            {booked.invoice && <Cell k="Paid" v={`₹${booked.invoice.totalAmount}`} mono />}
          </div>
          {booked.invoice && (
            <p className="border-t border-[var(--p-border)] bg-[var(--p-cyan-soft)] px-5 py-2.5 text-[13px] font-medium text-[var(--p-cyan-deep)]">
              Booked and billed in one go — the patient walks straight to the doctor. ✓
            </p>
          )}
          <div className="border-t border-[var(--p-border)] bg-[var(--p-bg)] px-5 py-3 text-[13px] leading-relaxed text-[var(--p-muted)]">
            <span className="font-semibold text-[var(--p-ink)]">What happens next:</span> the patient sees the doctor → the doctor hands them a paper prescription → they come back to you → upload it from the button below or the Today queue.
          </div>
          <div className="flex flex-wrap gap-3 p-5">
            <a href={`/print/opd/${booked.id}`} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--p-teal)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--p-teal-deep)]">
              <Icon name="file" size={15} /> Print OPD sheet
            </a>
            {booked.invoice && (
              <a href={`/print/invoice/${booked.invoice.id}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--p-border)] px-4 py-2.5 text-sm font-medium text-[var(--p-text)] transition-colors hover:border-[var(--p-teal)] hover:text-[var(--p-teal)]">
                <Icon name="receipt" size={14} /> Print bill
              </a>
            )}
            <PrimaryButton onClick={reset}><Icon name="plus" size={15} /> Book another</PrimaryButton>
            <a href={`/prescriptions?patient=${booked.patient.displayId}`} className="inline-flex items-center gap-2 rounded-lg border border-[var(--p-border)] px-4 py-2.5 text-sm font-medium text-[var(--p-text)] transition-colors hover:border-[var(--p-teal)] hover:text-[var(--p-teal)]">
              <Icon name="file" size={14} /> Upload Rx (after consult)
            </a>
            <a href="/" className="inline-flex items-center gap-2 rounded-lg border border-[var(--p-border)] px-4 py-2.5 text-sm font-medium text-[var(--p-text)] transition-colors hover:border-[var(--p-teal)] hover:text-[var(--p-teal)]">
              Back to today
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <PortalScroll>
      <Suspense fallback={null}>
        <PatientFromUrl onFound={(p) => { setPatient(p); setPrefilled(true); }} />
      </Suspense>
      {/* page header band */}
      <div data-rise className="surface dotgrid mb-6 flex flex-wrap items-center justify-between gap-4 px-6 py-5">
        <div>
          <h1 className="font-serif-p text-[22px] font-semibold text-[var(--p-ink)]">Book an appointment</h1>
          <p className="mt-1 max-w-lg text-[14px] leading-relaxed text-[var(--p-muted)]">
            Find a patient, choose a doctor and an open slot. Booked visits appear in the doctor&apos;s queue instantly.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="badge"><Icon name="users" size={12} /> {recent.length} recent</span>
          <span className="badge"><Icon name="stethoscope" size={12} /> {doctors.length} doctors</span>
        </div>
      </div>

      {prefilled && patient && !booked && (
        <div data-rise className="mb-4 flex items-center gap-2 rounded-lg border border-[var(--p-teal)]/25 bg-[var(--p-teal-soft)] px-4 py-2.5 text-[14px] text-[var(--p-teal-deep)]">
          <Icon name="check" size={14} />
          <span><span className="font-semibold">{patient.fullName}</span> carried over — go straight to choosing the doctor.</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <div className="space-y-6">
          {/* STEP 1 */}
          <section data-rise className="surface surface-hover overflow-hidden">
            <Head n={1} done={step1Done} title="Patient" hint="Search by name or Jeeva ID, or pick a recent registration." />
            <div className="p-6 pt-5">
              {!patient ? (
                <>
                  <div className="flex items-center gap-2 rounded-md border border-[var(--p-border)] px-3 py-2 ">
                    <span className="text-[var(--p-muted)]"><Icon name="search" size={16} /></span>
                    <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name or JMH2026OP00123…" className="w-full bg-transparent text-sm text-[var(--p-ink)] outline-none" autoFocus />
                    {searching && <Spinner size={14} />}
                  </div>
                  {query && results.length > 0 && <div className="mt-3 space-y-2">{results.map((p) => <PRow key={p.id} p={p} onPick={() => { setPatient(p); setQuery(""); }} />)}</div>}
                  {query && !searching && results.length === 0 && <p className="mt-3 text-[13px] text-[var(--p-muted)]">No patient found. Register them first.</p>}
                  {!query && recent.length > 0 && (
                    <div className="mt-4">
                      <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--p-muted)]">Recently registered</p>
                      <div className="space-y-2">{recent.map((p) => <PRow key={p.id} p={p} onPick={() => setPatient(p)} />)}</div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center justify-between rounded-xl border border-[var(--p-teal)] bg-[var(--p-teal-soft)]/40 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--p-teal)] font-serif-p text-[14px] font-semibold text-white">{inits(patient.fullName)}</div>
                    <div>
                      <div className="text-[14px] font-semibold text-[var(--p-ink)]">{patient.fullName}</div>
                      <div className="text-[12px] text-[var(--p-muted)]"><span className="tabular">{patient.displayId}</span> · {patient.phone}{patient.age != null && ` · ${patient.age}y`}</div>
                    </div>
                  </div>
                  <button onClick={() => setPatient(null)} className="rounded-lg border border-[var(--p-border)] px-3 py-1.5 text-[13px] font-medium text-[var(--p-teal)] transition-colors hover:border-[var(--p-teal)]">Change</button>
                </div>
              )}
            </div>
          </section>

          {/* STEP 2 */}
          <section data-rise className={`surface overflow-hidden transition-opacity ${patient ? "surface-hover" : "pointer-events-none opacity-55"}`}>
            <Head n={2} done={step2Done} title="Doctor & time" hint="Pick a doctor and an available slot for the day." />
            <div className="p-6 pt-5">
              <div>
                <label className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.05em] text-[var(--p-muted)]">Doctor</label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {doctors.map((d) => {
                    const active = doctorId === d.id;
                    return (
                      <button key={d.id} type="button" onClick={() => setDoctorId(active ? "" : d.id)} aria-pressed={active}
                        className={`flex items-center gap-3 rounded-[10px] border p-2.5 text-left transition-colors ${active ? "border-[var(--p-teal)] bg-[var(--p-teal-soft)]" : "border-[var(--p-border)] hover:border-[var(--p-border-strong)] hover:bg-[var(--p-bg)]"}`}>
                        <DoctorAvatar name={d.name} image={d.photoUrl ?? undefined} className="h-11 w-11 flex-none rounded-full text-[12px]" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] font-semibold text-[var(--p-ink)]">{d.name}</span>
                          <span className="block truncate text-[11.5px] text-[var(--p-teal-deep)]">{d.specialization}</span>
                          <span className="mt-0.5 block font-mono text-[10.5px] text-[var(--p-muted)]">{d.department} · ₹{d.fee}</span>
                        </span>
                        {active && <span className="shrink-0 text-[var(--p-teal)]"><Icon name="check" size={16} /></span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 max-w-[240px]">
                <label className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.05em] text-[var(--p-muted)]">Date</label>
                <PortalDatePicker value={date} min={todayISO()} onChange={setDate} accent="teal" />
              </div>

              {/* selected doctor info card */}
              {doctor && (
                <div className="mt-4 rounded-xl border border-[var(--p-border)] bg-[var(--p-bg)] p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <span className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[var(--p-teal)] to-[var(--p-cyan)] text-[15px] font-bold text-white">
                        {doctor.name.replace(/^Dr\.?\s*/i, "").split(" ").map((n) => n[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()}
                        {doctor.photoUrl && <img src={doctor.photoUrl} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} className="absolute inset-0 h-full w-full object-cover" />}
                      </span>
                      <div className="min-w-0">
                        <div className="text-[15px] font-semibold text-[var(--p-ink)]">{doctor.name}</div>
                        <div className="text-[13px] font-medium text-[var(--p-teal-deep)]">{doctor.specialization}</div>
                        {doctor.qualification && <div className="text-[12px] text-[var(--p-muted)]">{doctor.qualification}</div>}
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {doctor.experienceYears != null && <span className="rounded-full border border-[var(--p-border)] bg-white px-2 py-0.5 text-[11px] font-medium text-[var(--p-muted)]">{doctor.experienceYears}+ yrs exp</span>}
                          {doctor.age != null && <span className="rounded-full border border-[var(--p-border)] bg-white px-2 py-0.5 text-[11px] font-medium text-[var(--p-muted)]">Age {doctor.age}</span>}
                          <span className="rounded-full border border-[var(--p-border)] bg-white px-2 py-0.5 text-[11px] font-medium text-[var(--p-muted)]">{doctor.department}</span>
                          {doctor.languages && <span className="rounded-full border border-[var(--p-border)] bg-white px-2 py-0.5 text-[11px] font-medium text-[var(--p-muted)]">{doctor.languages}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-mono text-[15px] font-semibold text-[var(--p-ink)]">₹{doctor.fee}</div>
                      <div className="text-[11px] uppercase tracking-wide text-[var(--p-muted)]">consultation</div>
                    </div>
                  </div>
                  {doctor.bio && <p className="mt-3 border-t border-[var(--p-border)] pt-3 text-[12px] leading-relaxed text-[var(--p-muted)]">{doctor.bio}</p>}
                </div>
              )}

              {doctorId && (
                <div className="mt-5">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[12px] font-semibold uppercase tracking-[0.05em] text-[var(--p-muted)]">Available slots · {prettyDate(date)}</p>
                    <div className="flex items-center gap-3">
                      {!loadingSlots && <span className="text-[12px] text-[var(--p-muted)]">{slots.length} open</span>}
                      <button type="button" onClick={regenerateSlots} disabled={regenerating} title="Rebuild the booking grid at 10-minute gaps" className="text-[11px] font-semibold text-[var(--p-teal)] hover:underline disabled:opacity-50">{regenerating ? "Regenerating…" : "Regenerate 10-min"}</button>
                    </div>
                  </div>
                  {loadingSlots ? (
                    <div className="flex items-center gap-2 py-4 text-[13px] text-[var(--p-muted)]"><Spinner size={14} /> Loading slots…</div>
                  ) : slots.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-[var(--p-border)] py-6 text-center text-[13px] text-[var(--p-muted)]">No free slots for this day. Try another date.</div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                      {slots.map((s) => (
                        <button key={s.id} onClick={() => setSlotId(s.id)}
                          className={`rounded-lg border px-2 py-2.5 font-mono text-[13px] transition-all ${slotId === s.id ? "border-[var(--p-teal)] bg-[var(--p-teal)] text-white shadow-[0_4px_12px_-4px_rgba(13,125,130,.5)]" : "border-[var(--p-border)] text-[var(--p-ink)] hover:border-[var(--p-teal)] hover:text-[var(--p-teal)]"}`}>
                          {s.startTime}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="my-5 rule" />

              <p className="mb-3 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--p-muted)]">
                Referral <span className="badge !py-0.5 !text-[11px]"><Icon name="alert" size={10} /> admin-only</span>
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Referred by"><input className={fld} value={referredBy} onChange={(e) => setReferredBy(e.target.value)} placeholder="Dr. Anil, City Clinic" /></Field>
                <Field label="Source"><input className={fld} value={referralSource} onChange={(e) => setReferralSource(e.target.value)} placeholder="Camp / online / walk-in" /></Field>
              </div>

              {error && (
                <div data-rise className="mt-4 flex items-start gap-2 rounded-lg border border-[var(--p-rose)]/25 bg-[var(--p-rose-soft)] px-4 py-3 text-[14px] text-[var(--p-rose)]">
                  <Icon name="alert" size={15} /> <span>{error}</span>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* SUMMARY rail (sticky) */}
        <aside data-rise className="lg:sticky lg:top-24 lg:self-start">
          <div className="surface overflow-hidden">
            <div className="border-b border-[var(--p-border)] px-5 py-4">
              <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--p-ink)]">Booking summary</p>
            </div>
            <div className="divide-y divide-[var(--p-border)]">
              <SumRow k="Patient" v={patient?.fullName} />
              <SumRow k="Jeeva ID" v={patient?.displayId} mono />
              <SumRow k="Doctor" v={doctor?.name} />
              <SumRow k="Department" v={doctor?.department} />
              <SumRow k="Date" v={prettyDate(date)} />
              <SumRow k="Time" v={slot?.startTime} mono />
              <div className="flex items-center justify-between px-5 py-3.5">
                <span className="text-[14px] font-semibold text-[var(--p-ink)]">Fee</span>
                <span className="font-mono text-[15px] font-semibold text-[var(--p-teal)]">{doctor ? `₹${doctor.fee}` : "—"}</span>
              </div>
            </div>
            <div className="space-y-3 border-t border-[var(--p-border)] px-5 pt-4">
              <label className="flex items-center gap-2.5 text-[14px] font-medium text-[var(--p-ink)]">
                <input type="checkbox" checked={billNow} onChange={(e) => setBillNow(e.target.checked)} className="h-4 w-4 accent-[var(--p-blue)]" />
                Generate bill &amp; collect fee now
              </label>
              {billNow && (
                <div className="space-y-3">
                  <DiscountInput subtotal={bookFee} accent="blue" onChange={(d) => setBookDisc(d.amount)} />
                  <div className="flex justify-between text-[13px]">
                    <span className="text-[var(--p-muted)]">To collect</span>
                    <span className="font-mono font-semibold text-[var(--p-blue)]">₹{bookTotal.toFixed(2)}</span>
                  </div>
                  <PaymentSection total={bookTotal} accent="blue" onChange={(r) => { setPayments(r.payments); setPayValid(r.valid); }} />
                </div>
              )}
              <p className="text-[12px] leading-relaxed text-[var(--p-muted)]">
                {billNow ? "One motion: OP number + GST receipt together. No second queue at billing." : "Booking only — bill later from the patient's page."}
              </p>
            </div>
            <div className="p-5 pt-3">
              <PrimaryButton onClick={book} disabled={!step2Done || booking || (billNow && bookTotal > 0 && !payValid)} full>
                {booking ? <><Spinner /> Booking…</> : <><Icon name="calendar" size={15} /> {billNow ? "Confirm & bill" : "Confirm booking"}</>}
              </PrimaryButton>
              <p className="mt-3 text-center text-[12px] leading-relaxed text-[var(--p-muted)]">
                {step2Done ? "Ready — this books instantly into the doctor's queue." : "Complete both steps to confirm."}
              </p>
            </div>
          </div>
        </aside>
      </div>
    </PortalScroll>
  );
}

function Head({ n, title, hint, done }: { n: number; title: string; hint: string; done: boolean }) {
  return (
    <div className="flex items-start gap-3 border-b border-[var(--p-border)] px-6 py-4">
      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold transition-colors ${done ? "bg-[var(--p-teal)] text-white" : "border border-[var(--p-border)] text-[var(--p-muted)]"}`}>
        {done ? <Icon name="check" size={14} /> : n}
      </div>
      <div>
        <h3 className="text-[14px] font-semibold text-[var(--p-ink)]">{title}</h3>
        <p className="mt-0.5 text-[13px] text-[var(--p-muted)]">{hint}</p>
      </div>
    </div>
  );
}
function PRow({ p, onPick }: { p: Patient; onPick: () => void }) {
  return (
    <button onClick={onPick} className="surface-hover flex w-full items-center justify-between rounded-lg border border-[var(--p-border)] p-3 text-left">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--p-teal-soft)] font-serif-p text-[13px] font-semibold text-[var(--p-teal)]">{inits(p.fullName)}</div>
        <div><div className="text-[14px] font-medium text-[var(--p-ink)]">{p.fullName}</div><div className="text-[12px] text-[var(--p-muted)]"><span className="tabular">{p.displayId}</span> · {p.phone}</div></div>
      </div>
      <Icon name="chevron" size={16} />
    </button>
  );
}
function SumRow({ k, v, mono }: { k: string; v?: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between px-5 py-3">
      <span className="text-[13px] text-[var(--p-muted)]">{k}</span>
      <span className={`text-right text-[14px] ${v ? "text-[var(--p-ink)]" : "text-[var(--p-muted)]"} ${mono ? "font-mono text-[13px]" : ""}`}>{v ?? "—"}</span>
    </div>
  );
}
function Cell({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="bg-white px-5 py-4">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--p-muted)]">{k}</p>
      <p className={`mt-1 text-[14px] text-[var(--p-ink)] ${mono ? "font-mono text-[14px]" : ""}`}>{v}</p>
    </div>
  );
}
