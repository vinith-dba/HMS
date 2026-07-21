"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Kpi, Pill, statusTone } from "@/components/portal/ui/primitives";
import { Icon } from "@/components/portal/ui/icons";
import { Spinner } from "@/components/portal/ui/form-atoms";
import { PortalScroll } from "@/components/portal/portal-scroll";
import { api, ApiClientError } from "@/lib/api-client";

interface Q {
  appointmentId: string; opNumber: string; time: string; status: string;
  patient: { displayId: string; fullName: string; age: number | null; gender: string | null; phone: string; bloodGroup: string | null };
}
interface Today { doctor: { name: string; department: string }; stats: { booked: number; checkedIn: number; completed: number }; queue: Q[]; }

const LABEL: Record<string, string> = { BOOKED: "Booked", CHECKED_IN: "Checked-in", COMPLETED: "Completed" };
const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

export default function DoctorToday() {
  const [d, setD] = useState<Today | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setD(await api.get<Today>("/doctor/today")); }
    catch (e) { setError(e instanceof ApiClientError ? e.message : "Couldn't load today's list."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function complete(id: string) {
    setBusy(id); setError(null);
    try { await api.post("/doctor/today", { appointmentId: id }); await load(); }
    catch (e) { setError(e instanceof ApiClientError ? e.message : "Could not update."); }
    finally { setBusy(null); }
  }

  if (loading) return <div className="flex items-center justify-center gap-2 py-20 text-[13px] text-[var(--p-muted)]"><Spinner /> Loading…</div>;

  return (
    <PortalScroll>
      <div data-rise className="surface dotgrid mb-6 px-6 py-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--p-cyan-deep)]">{today}</p>
        <h1 className="mt-1 font-serif-p text-[24px] font-semibold text-[var(--p-ink)]">{d?.doctor.name ?? "Today"}</h1>
        <p className="mt-1 text-[13px] text-[var(--p-muted)]">{d?.doctor.department} · your clinic list for today</p>
      </div>

      {error && <div data-rise className="mb-4 rounded-lg border border-[var(--p-rose)]/25 bg-[var(--p-rose-soft)] px-4 py-3 text-[13px] text-[var(--p-rose)]">{error}</div>}

      <div data-rise className="mb-6 grid grid-cols-3 gap-4">
        <Kpi icon="calendar" label="Booked" value={d?.stats.booked ?? 0} sub="yet to arrive" delay={0} />
        <Kpi icon="clock" label="Waiting" value={d?.stats.checkedIn ?? 0} sub="checked in" delay={60} />
        <Kpi icon="check" label="Seen" value={d?.stats.completed ?? 0} sub="completed" delay={120} />
      </div>

      <section data-rise className="surface overflow-hidden">
        <div className="border-b border-[var(--p-border)] px-6 py-4">
          <h3 className="text-[14px] font-semibold text-[var(--p-ink)]">Patient queue</h3>
          <p className="mt-0.5 text-[12px] text-[var(--p-muted)]">Open a chart to see history, lab results, and past prescriptions.</p>
        </div>
        {!d?.queue.length ? (
          <div className="dotgrid flex flex-col items-center py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--p-border)] bg-white text-[var(--p-muted)]"><Icon name="calendar" size={20} /></span>
            <p className="mt-3 text-[13px] text-[var(--p-muted)]">No appointments today.</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--p-border)]">
            {d.queue.map((q) => (
              <div key={q.appointmentId} className="flex flex-wrap items-center justify-between gap-3 px-6 py-3.5 transition-colors hover:bg-[var(--p-bg)]">
                <div className="flex items-center gap-3">
                  <div className="w-16 font-mono text-[12px] font-semibold text-[var(--p-blue)]">{q.time}</div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--p-cyan-soft)] font-serif-p text-[12px] font-semibold text-[var(--p-cyan-deep)]">
                    {q.patient.fullName.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                  </div>
                  <div>
                    <div className="text-[14px] font-medium text-[var(--p-ink)]">{q.patient.fullName}</div>
                    <div className="text-[12px] text-[var(--p-muted)]">
                      <span className="tabular">{q.patient.displayId}</span>
                      {q.patient.age != null && ` · ${q.patient.age}y`}
                      {q.patient.gender && ` · ${q.patient.gender[0]}`}
                      {q.patient.bloodGroup && ` · ${q.patient.bloodGroup}`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Pill tone={statusTone(LABEL[q.status] ?? q.status)}>{LABEL[q.status] ?? q.status}</Pill>
                  <Link href={`/patients?id=${q.patient.displayId}`}
                    className="rounded-lg border border-[var(--p-border)] px-3 py-1.5 text-[12px] font-medium text-[var(--p-blue)] hover:border-[var(--p-blue)]">
                    Chart
                  </Link>
                  {q.status !== "COMPLETED" && (
                    <button onClick={() => complete(q.appointmentId)} disabled={busy === q.appointmentId}
                      className="btn-primary inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-60">
                      {busy === q.appointmentId ? <Spinner size={12} /> : <Icon name="check" size={13} />} Seen
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </PortalScroll>
  );
}
