"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/portal/ui/icons";
import { Spinner } from "@/components/portal/ui/form-atoms";
import { PortalScroll } from "@/components/portal/portal-scroll";
import { api, ApiClientError } from "@/lib/api-client";

interface Doctor { id: string; name: string; department: string; }
interface Slot {
  id: string; startTime: string; endTime: string;
  state: "FREE" | "BOOKED" | "BLOCKED"; blockReason: string | null;
  appointment: { id: string; opNumber: string; status: string; patient: { displayId: string; fullName: string; phone: string } } | null;
}
interface Day { doctor: Doctor; onLeave: boolean; slots: Slot[]; }
interface Affected { id: string; opNumber: string; time: string; patient: { displayId: string; fullName: string; phone: string } }

const to12h = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  if (isNaN(h)) return t;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m ?? 0).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
};
const todayIso = () => new Date().toISOString().slice(0, 10);

export default function SchedulePage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [doctorId, setDoctorId] = useState("");
  const [date, setDate] = useState(todayIso());
  const [day, setDay] = useState<Day | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveReason, setLeaveReason] = useState("");
  const [callList, setCallList] = useState<Affected[] | null>(null);

  useEffect(() => {
    api.get<{ doctors: Doctor[] }>("/reception/doctors")
      .then((r) => { setDoctors(r.doctors); if (r.doctors[0]) setDoctorId(r.doctors[0].id); })
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    if (!doctorId || !date) { setDay(null); return; }
    setLoading(true); setErr(null);
    try { setDay(await api.get<Day>(`/reception/schedule?doctorId=${doctorId}&date=${date}`)); }
    catch (e) { setErr(e instanceof ApiClientError ? e.message : "Couldn't load the schedule."); setDay(null); }
    finally { setLoading(false); }
  }, [doctorId, date]);
  useEffect(() => { load(); }, [load]);

  async function markLeave() {
    if (leaveReason.trim().length < 3) return;
    setBusy(true); setErr(null);
    try {
      const r = await api.post<{ blocked: number; affected: Affected[] }>("/reception/schedule/leave", {
        doctorId, date, reason: leaveReason.trim(),
      });
      setLeaveOpen(false); setLeaveReason("");
      await load();
      // The whole point: these patients think they still have an appointment.
      if (r.affected.length > 0) setCallList(r.affected);
    } catch (e) { setErr(e instanceof ApiClientError ? e.message : "Could not mark leave."); }
    finally { setBusy(false); }
  }

  async function clearLeave() {
    setBusy(true); setErr(null);
    try { await api.del("/reception/schedule/leave", { doctorId, date }); await load(); }
    catch (e) { setErr(e instanceof ApiClientError ? e.message : "Could not reopen the day."); }
    finally { setBusy(false); }
  }

  async function toggleSlot(s: Slot) {
    setBusy(true); setErr(null);
    try {
      await api.post("/reception/schedule/slot", {
        slotId: s.id, blocked: s.state !== "BLOCKED", reason: "Doctor unavailable",
      });
      await load();
    } catch (e) { setErr(e instanceof ApiClientError ? e.message : "Could not update that slot."); }
    finally { setBusy(false); }
  }

  const free = day?.slots.filter((s) => s.state === "FREE").length ?? 0;
  const booked = day?.slots.filter((s) => s.state === "BOOKED").length ?? 0;
  const blocked = day?.slots.filter((s) => s.state === "BLOCKED").length ?? 0;
  const anyBlocked = blocked > 0;

  return (
    <PortalScroll>
      <div data-rise className="surface dotgrid mb-5 px-6 py-5">
        <h1 className="font-serif-p text-[22px] font-semibold text-[var(--p-ink)]">Doctor schedule</h1>
        <p className="mt-1 max-w-[600px] text-[14px] leading-relaxed text-[var(--p-muted)]">
          See a doctor&apos;s whole day, and close it when they&apos;re away — so reception stops selling slots
          for a doctor who isn&apos;t coming in.
        </p>
      </div>

      <div data-rise className="surface mb-5 flex flex-wrap items-end gap-4 px-5 py-4">
        <div className="min-w-[220px] flex-1">
          <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-[var(--p-muted)]">Doctor</label>
          <select value={doctorId} onChange={(e) => setDoctorId(e.target.value)}
            className="w-full rounded-lg border border-[var(--p-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--p-teal)]">
            {doctors.map((d) => <option key={d.id} value={d.id}>{d.name} · {d.department}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-[var(--p-muted)]">Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-[var(--p-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--p-teal)]" />
        </div>
        <div className="ml-auto flex gap-2">
          {anyBlocked ? (
            <button onClick={clearLeave} disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--p-teal)] px-4 py-2 text-[14px] font-semibold text-[var(--p-teal)] transition-colors hover:bg-[var(--p-teal-soft)] disabled:opacity-50">
              {busy ? <Spinner size={13} /> : <Icon name="check" size={14} />} Doctor is back — reopen day
            </button>
          ) : (
            <button onClick={() => { setLeaveOpen(true); setLeaveReason(""); }} disabled={busy || !day?.slots.length}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--p-rose)] px-4 py-2 text-[14px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40">
              <Icon name="alert" size={14} /> Mark doctor away
            </button>
          )}
        </div>
      </div>

      {err && <div data-rise className="mb-4 rounded-lg border border-[var(--p-rose)]/25 bg-[var(--p-rose-soft)] px-4 py-3 text-[14px] text-[var(--p-rose)]">{err}</div>}

      {loading ? (
        <div className="surface flex items-center justify-center gap-2 py-16 text-[14px] text-[var(--p-muted)]"><Spinner /> Loading…</div>
      ) : !day?.slots.length ? (
        <section data-rise className="surface grid place-items-center px-6 py-16 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-full border border-[var(--p-border)] text-[var(--p-muted)]"><Icon name="calendar" size={20} /></span>
          <p className="mt-3 text-[14px] font-medium text-[var(--p-ink)]">No slots on this day.</p>
          <p className="mt-1 max-w-sm text-[13px] text-[var(--p-muted)]">
            This doctor has no sitting hours configured for {new Date(date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}.
          </p>
        </section>
      ) : (
        <>
          <div data-rise className="mb-4 flex flex-wrap gap-3 text-[13px]">
            <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded bg-[var(--p-teal)]" /> {free} free</span>
            <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded bg-[var(--p-blue)]" /> {booked} booked</span>
            <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded bg-[var(--p-border-strong)]" /> {blocked} blocked</span>
          </div>

          <section data-rise className="surface overflow-hidden">
            <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
              {day.slots.map((s) => {
                if (s.state === "BOOKED" && s.appointment) {
                  return (
                    <div key={s.id} className="rounded-lg border border-[var(--p-blue)]/30 bg-[var(--p-blue-soft)] px-3.5 py-3">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[14px] font-bold text-[var(--p-blue-deep)]">{to12h(s.startTime)}</span>
                        <span className="rounded bg-[var(--p-blue)] px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">Booked</span>
                      </div>
                      <div className="mt-1.5 truncate text-[14px] font-semibold text-[var(--p-ink)]">{s.appointment.patient.fullName}</div>
                      <div className="truncate text-[12px] text-[var(--p-muted)]">
                        <span className="font-mono">{s.appointment.opNumber}</span> · {s.appointment.patient.phone}
                      </div>
                    </div>
                  );
                }
                const isBlocked = s.state === "BLOCKED";
                return (
                  <button key={s.id} onClick={() => toggleSlot(s)} disabled={busy}
                    className={`rounded-lg border px-3.5 py-3 text-left transition-colors disabled:opacity-60 ${
                      isBlocked
                        ? "border-[var(--p-border-strong)] bg-[var(--p-bg)] hover:border-[var(--p-teal)]"
                        : "border-[var(--p-teal)]/30 bg-[var(--p-teal-soft)] hover:border-[var(--p-rose)]"}`}>
                    <div className="flex items-center justify-between">
                      <span className={`font-mono text-[14px] font-bold ${isBlocked ? "text-[var(--p-muted)] line-through" : "text-[var(--p-teal-deep)]"}`}>
                        {to12h(s.startTime)}
                      </span>
                      <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                        isBlocked ? "bg-[var(--p-border-strong)] text-white" : "bg-[var(--p-teal)] text-white"}`}>
                        {isBlocked ? "Blocked" : "Free"}
                      </span>
                    </div>
                    <div className="mt-1.5 text-[12px] text-[var(--p-muted)]">
                      {isBlocked ? (s.blockReason ?? "Unavailable") + " — tap to reopen" : "Tap to block this hour"}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </>
      )}

      {/* MARK AWAY */}
      {leaveOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="surface w-full max-w-sm bg-white">
            <div className="border-b border-[var(--p-border)] px-6 py-4">
              <h3 className="text-[14px] font-semibold text-[var(--p-ink)]">Mark {day?.doctor.name} away</h3>
              <p className="mt-0.5 text-[13px] text-[var(--p-muted)]">
                {new Date(date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
              </p>
            </div>
            <div className="space-y-3 p-6">
              <label className="block text-[13px] font-medium text-[var(--p-text)]">Reason</label>
              <input value={leaveReason} onChange={(e) => setLeaveReason(e.target.value)} autoFocus
                placeholder="On leave / in surgery / emergency…"
                className="w-full rounded-lg border border-[var(--p-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--p-teal)]" />
              <p className="rounded-lg bg-[var(--p-teal-soft)] px-3 py-2 text-[12px] leading-relaxed text-[var(--p-teal-deep)]">
                {free} free slot{free === 1 ? "" : "s"} will stop being sold.
              </p>
              {booked > 0 && (
                <p className="rounded-lg bg-[var(--p-amber-soft)] px-3 py-2 text-[12px] leading-relaxed text-[#8a6414]">
                  <b>{booked} patient{booked === 1 ? " has" : "s have"} already booked today.</b> I will <b>not</b> cancel them
                  behind their back — you&apos;ll get their phone numbers so you can ring them and reschedule properly.
                </p>
              )}
            </div>
            <div className="flex justify-end gap-3 border-t border-[var(--p-border)] p-5">
              <button onClick={() => setLeaveOpen(false)} className="rounded-lg border border-[var(--p-border)] px-4 py-2 text-sm text-[var(--p-text)]">Cancel</button>
              <button onClick={markLeave} disabled={busy || leaveReason.trim().length < 3}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--p-rose)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
                {busy ? <><Spinner /> Closing…</> : "Close the day"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* THE CALL LIST — patients who still think they have an appointment */}
      {callList && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="surface w-full max-w-lg bg-white">
            <div className="border-b border-[var(--p-border)] px-6 py-4">
              <h3 className="text-[14px] font-semibold text-[var(--p-ink)]">Ring these {callList.length} patient{callList.length === 1 ? "" : "s"}</h3>
              <p className="mt-0.5 text-[13px] text-[var(--p-muted)]">
                They&apos;re still booked with {day?.doctor.name} today and don&apos;t know yet. Their visits are untouched — reschedule or cancel each one deliberately.
              </p>
            </div>
            <div className="max-h-72 divide-y divide-[var(--p-border)] overflow-y-auto">
              {callList.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-3 px-6 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-medium text-[var(--p-ink)]">{a.patient.fullName}</div>
                    <div className="text-[12px] text-[var(--p-muted)]">
                      <span className="font-mono">{to12h(a.time)}</span> · <span className="font-mono">{a.opNumber}</span>
                    </div>
                  </div>
                  <a href={`tel:${a.patient.phone}`}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--p-teal)] px-3 py-1.5 font-mono text-[13px] font-semibold text-[var(--p-teal)] transition-colors hover:bg-[var(--p-teal)] hover:text-white">
                    <Icon name="activity" size={12} /> {a.patient.phone}
                  </a>
                </div>
              ))}
            </div>
            <div className="flex justify-between gap-3 border-t border-[var(--p-border)] p-5">
              <a href="/" className="rounded-lg border border-[var(--p-border)] px-4 py-2 text-sm text-[var(--p-text)]">
                Go to Today (reschedule there)
              </a>
              <button onClick={() => setCallList(null)} className="rounded-lg bg-[var(--p-teal)] px-4 py-2 text-sm font-semibold text-white">
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </PortalScroll>
  );
}
