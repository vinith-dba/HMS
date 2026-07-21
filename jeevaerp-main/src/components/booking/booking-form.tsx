"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DoctorAvatar } from "@/components/marketing/doctor-avatar";
import { Scoop } from "@/components/ui/scoop";
import { DEPARTMENTS, DOCTORS, type Doctor } from "@/lib/data";

/* ---- timings, derived from the doctor's real OPD window ------------------- */

/** "9:00 – 13:00" → ["09:00","09:30",…] in 30-minute steps. */
function slotsFor(opd: string): string[] {
  const m = opd.match(/(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/);
  if (!m) return [];
  let t = +m[1] * 60 + +m[2];
  const end = +m[3] * 60 + +m[4];
  const out: string[] = [];
  for (; t < end; t += 30) out.push(`${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`);
  return out;
}

const DAY_IDX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** "Mon–Sat" / "Daily" / "Tue–Sat" → set of allowed weekday indices. */
function allowedDays(days: string): Set<number> {
  if (/daily/i.test(days)) return new Set([0, 1, 2, 3, 4, 5, 6]);
  const m = days.match(/([A-Za-z]{3})\s*[–-]\s*([A-Za-z]{3})/);
  if (!m || DAY_IDX[m[1]] === undefined || DAY_IDX[m[2]] === undefined) return new Set([1, 2, 3, 4, 5, 6]);
  const s = new Set<number>();
  for (let i = DAY_IDX[m[1]]; i <= DAY_IDX[m[2]]; i++) s.add(i);
  return s;
}

/** Demo availability until GET /api/v1/public/slots lands — deterministic, so it looks real. */
function isBooked(doctorId: string, date: string, slot: string) {
  let h = 0;
  for (const ch of doctorId + date + slot) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 4 === 0;
}

const label = "font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]";
const field =
  "mt-2.5 w-full rounded-[14px] border border-[var(--line-strong)] bg-white px-4 py-3 text-sm text-[var(--ink)] outline-none transition-colors focus:border-[var(--teal)]";

/* ---- the sticky profile rail — everything about the chosen doctor --------- */

function DoctorProfile({ doctor, date, slot, name }: { doctor?: Doctor; date: string; slot: string; name: string }) {
  if (!doctor) {
    return (
      <aside className="flex h-full min-h-[320px] flex-col items-center justify-center rounded-[var(--r-lg)] border-2 border-dashed border-[var(--line-strong)] p-8 text-center lg:sticky lg:top-28">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-[var(--teal-soft)] text-[var(--teal)]" aria-hidden>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <circle cx="12" cy="8" r="4" /><path d="M4 20c0-3.3 3.6-5.5 8-5.5s8 2.2 8 5.5" />
          </svg>
        </span>
        <p className="mt-4 text-[14.5px] font-semibold text-[var(--ink)]">No doctor selected yet</p>
        <p className="mt-1.5 max-w-[240px] text-[13px] leading-[1.65] text-[var(--muted)]">
          Choose a doctor and their full profile and timings will appear here.
        </p>
      </aside>
    );
  }

  const rows: [string, string][] = [
    ["Department", doctor.department],
    ["Qualification", doctor.qualification],
    ["Experience", `${doctor.experience} years`],
    ["Age", `${doctor.age}`],
    ["OPD hours", doctor.opd],
    ["Days", doctor.days],
  ];

  return (
    <aside className="card h-fit rounded-[var(--r-lg)] p-3 lg:sticky lg:top-28">
      {/* photo with the fee docked in the scooped corner */}
      <div className="relative">
        <DoctorAvatar name={doctor.name} image={doctor.image} className="aspect-[4/3] w-full rounded-[calc(var(--r-lg)-10px)] text-[34px]" />
        <span className="chip chip-glass absolute left-3.5 top-3.5 !py-1.5 !text-[10.5px]">{doctor.experience}+ yrs experience</span>
        <Scoop corner="br" bg="var(--paper)" r={16} inner={20}>
          <span className="btn btn-solid pointer-events-none !px-5 !py-2.5 font-mono !text-[13.5px]">₹{doctor.fee}</span>
        </Scoop>
      </div>

      <div className="px-3 pb-3 pt-4">
        <h3 className="display text-[22px] text-[var(--ink)]">{doctor.name}</h3>
        <p className="mt-1 text-[13.5px] font-medium text-[var(--teal)]">{doctor.specialization}</p>

        <dl className="mt-4 space-y-2.5 border-t border-[var(--line)] pt-4">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-4">
              <dt className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-[var(--muted)]">{k}</dt>
              <dd className="text-right text-[13px] font-medium text-[var(--ink)]">{v}</dd>
            </div>
          ))}
        </dl>

        <dl className="mt-4 space-y-2.5 rounded-[var(--r-sm)] bg-[var(--teal-soft)] p-4">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-[var(--teal)]">Date</dt>
            <dd className="font-mono text-[13px] text-[var(--ink)]">{date || "—"}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-[var(--teal)]">Time</dt>
            <dd className="font-mono text-[13px] text-[var(--ink)]">{slot || "—"}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-[var(--teal)]">Patient</dt>
            <dd className="truncate text-[13px] font-medium text-[var(--ink)]">{name.trim() || "—"}</dd>
          </div>
        </dl>

        <p className="mt-4 text-[11px] font-medium uppercase leading-relaxed tracking-[0.12em] text-[var(--muted)]">
          Consultation fee paid at hospital · Cancellations by phone
        </p>
      </div>
    </aside>
  );
}

/* ---- the form -------------------------------------------------------------- */

export function BookingForm() {
  const params = useSearchParams();
  const preselected = DOCTORS.find((d) => d.id === params.get("doctor"));
  const deptParam = params.get("dept");

  const [dept, setDept] = useState(preselected?.department ?? (DEPARTMENTS.some((d) => d.name === deptParam) ? deptParam! : ""));
  const [doctorId, setDoctorId] = useState(preselected?.id ?? "");
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const doctors = useMemo(() => DOCTORS.filter((d) => !dept || d.department === dept), [dept]);
  const doctor = DOCTORS.find((d) => d.id === doctorId);

  const slots = doctor ? slotsFor(doctor.opd) : [];
  const dayOk = !doctor || !date || allowedDays(doctor.days).has(new Date(`${date}T00:00:00`).getDay());
  const ready = doctor && date && dayOk && slot && name.trim() && phone.trim();
  const today = new Date().toISOString().slice(0, 10);

  function submit() {
    if (!ready) return;
    // Wire-up point: POST /api/v1/reception/appointments
    setSubmitted(true);
  }

  if (submitted && doctor) {
    return (
      <div className="card relative mx-auto max-w-lg rounded-[var(--r-lg)] p-8 pb-20">
        <p className="eyebrow">Request received</p>
        <h3 className="display mt-4 text-[26px] text-[var(--ink)]">
          See you soon, {name.split(" ")[0]}.
        </h3>
        <div className="mt-6 flex items-center gap-4 rounded-[var(--r-sm)] bg-[var(--teal-soft)] p-4">
          <DoctorAvatar name={doctor.name} image={doctor.image} className="h-14 w-14 flex-none rounded-full text-[15px]" />
          <div className="min-w-0">
            <p className="truncate text-[14.5px] font-semibold text-[var(--ink)]">{doctor.name}</p>
            <p className="truncate text-[12.5px] text-[var(--teal)]">{doctor.specialization}</p>
          </div>
        </div>
        <dl className="mt-6 space-y-3 border-t border-[var(--line)] pt-5 text-sm">
          <div className="flex justify-between"><dt className="text-[var(--muted)]">Department</dt><dd className="text-[var(--ink)]">{doctor.department}</dd></div>
          <div className="flex justify-between"><dt className="text-[var(--muted)]">Date</dt><dd className="font-mono text-[13px] text-[var(--ink)]">{date}</dd></div>
          <div className="flex justify-between"><dt className="text-[var(--muted)]">Time</dt><dd className="font-mono text-[13px] text-[var(--ink)]">{slot}</dd></div>
          <div className="flex justify-between"><dt className="text-[var(--muted)]">Fee</dt><dd className="font-mono text-[13px] text-[var(--ink)]">₹{doctor.fee}</dd></div>
        </dl>
        <p className="mt-5 text-[13px] leading-relaxed text-[var(--muted)]">
          Our front desk will confirm on {phone}. First visit? Your permanent
          Jeeva ID is issued at registration.
        </p>
        <Scoop corner="br" r={18} inner={22}>
          <a href="/" className="btn btn-ghost !bg-white !px-6 !py-3 !text-[13px]">Back to home</a>
        </Scoop>
      </div>
    );
  }

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[7fr_5fr]">
      <div className="card rounded-[var(--r-lg)] p-6 sm:p-8">
        {/* 01 — department */}
        <div>
          <p className={label}>01 — Department</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {DEPARTMENTS.map((d) => {
              const active = dept === d.name;
              return (
                <button key={d.name} type="button"
                  onClick={() => { const next = active ? "" : d.name; setDept(next); if (doctor && next && doctor.department !== next) { setDoctorId(""); setSlot(""); } }}
                  aria-pressed={active}
                  className={`chip transition-colors ${active ? "!border-transparent !bg-[var(--teal)] !text-white" : "hover:!border-[var(--teal)] hover:!text-[var(--teal)]"}`}>
                  {d.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* 02 — doctor */}
        <div className="mt-8 border-t border-[var(--line)] pt-7">
          <p className={label}>02 — Doctor</p>
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            {doctors.map((d) => {
              const active = doctorId === d.id;
              return (
                <button key={d.id} type="button"
                  onClick={() => { setDoctorId(active ? "" : d.id); setSlot(""); }}
                  aria-pressed={active}
                  className={`flex items-center gap-3.5 rounded-[var(--r-md)] border p-3.5 text-left transition-all ${
                    active
                      ? "border-[var(--teal)] bg-[var(--teal-soft)] shadow-[var(--shadow-sm)]"
                      : "border-[var(--line)] hover:border-[var(--teal-tint)] hover:bg-[var(--bone)]"
                  }`}>
                  <DoctorAvatar name={d.name} image={d.image} className="h-13 w-13 flex-none rounded-full text-[14px]" />
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-semibold text-[var(--ink)]">{d.name}</span>
                    <span className="block truncate text-[11.5px] text-[var(--teal)]">{d.specialization}</span>
                    <span className="mt-0.5 block font-mono text-[10px] text-[var(--muted)]">{d.days} · {d.opd} · ₹{d.fee}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 03 — date & time, generated from the doctor's OPD window */}
        <div className="mt-8 border-t border-[var(--line)] pt-7">
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label className={label} htmlFor="date">03 — Date</label>
              <input id="date" type="date" min={today} value={date}
                onChange={(e) => { setDate(e.target.value); setSlot(""); }} className={field} />
              {doctor && !dayOk && (
                <p className="mt-2 text-[12.5px] font-medium text-[var(--alert)]">
                  {doctor.name} consults {doctor.days}. Please pick another date.
                </p>
              )}
            </div>
            <div className="sm:pt-[26px]">
              {doctor ? (
                <p className="rounded-[14px] bg-[var(--teal-soft)] px-4 py-3 font-mono text-[11.5px] leading-relaxed text-[var(--teal-deep)]">
                  {doctor.name.replace(/^Dr\.?\s*/, "Dr ")} · OPD {doctor.opd} · {doctor.days}
                </p>
              ) : (
                <p className="rounded-[14px] bg-[var(--bone)] px-4 py-3 text-[12.5px] text-[var(--muted)]">
                  Pick a doctor to see their available timings.
                </p>
              )}
            </div>
          </div>

          <p className={`${label} mt-6`}>04 — Time slot {doctor ? <span className="normal-case tracking-normal">· {doctor.opd}</span> : ""}</p>
          {doctor && date && dayOk ? (
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
              {slots.map((s) => {
                const booked = isBooked(doctor.id, date, s);
                return (
                  <button key={s} type="button" disabled={booked} onClick={() => setSlot(s)}
                    aria-pressed={slot === s}
                    className={`rounded-full border px-2 py-2.5 font-mono text-[12px] transition-colors ${
                      booked
                        ? "cursor-not-allowed border-[var(--line)] text-[var(--muted)]/40 line-through"
                        : slot === s
                          ? "border-[var(--teal)] bg-[var(--teal)] text-white"
                          : "border-[var(--line-strong)] text-[var(--ink)] hover:border-[var(--teal)] hover:text-[var(--teal)]"
                    }`}>
                    {s}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="mt-3 rounded-[14px] border border-dashed border-[var(--line-strong)] px-4 py-5 text-center text-[12.5px] text-[var(--muted)]">
              {doctor ? (dayOk ? "Choose a date to see the open slots." : "No slots on that day.") : "Slots appear once you choose a doctor and a date."}
            </p>
          )}
        </div>

        {/* 05 — patient */}
        <div className="mt-8 grid gap-6 border-t border-[var(--line)] pt-7 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="name">05 — Patient name</label>
            <input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className={field} />
          </div>
          <div>
            <label className={label} htmlFor="phone">06 — Mobile number</label>
            <input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile" className={field} inputMode="numeric" />
          </div>
        </div>

        <button onClick={submit} disabled={!ready}
          className="btn btn-solid mt-8 disabled:cursor-not-allowed disabled:bg-[var(--line-strong)] disabled:text-[var(--muted)] disabled:shadow-none">
          Request appointment <span aria-hidden>→</span>
        </button>
      </div>

      <DoctorProfile doctor={doctor} date={date} slot={slot} name={name} />
    </div>
  );
}
