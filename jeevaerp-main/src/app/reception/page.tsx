"use client";

import { useEffect, useState } from "react";
import { Kpi, Pill, statusTone } from "@/components/portal/ui/primitives";
import { Icon } from "@/components/portal/ui/icons";
import { Spinner } from "@/components/portal/ui/form-atoms";
import { PortalScroll } from "@/components/portal/portal-scroll";
import { FlowRail } from "@/components/portal/shell/flow-rail";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiClientError } from "@/lib/api-client";

interface Appt {
  id: string; opNumber: string; time: string; status: string; type: string; price: string;
  checkedInAt?: string | null;
  patient: { id: string; displayId: string; name: string };
  doctor: { id: string; name: string; department: string };
}
interface Stats { total: number; expected: number; waiting: number; checkedIn: number; completed: number; newPatients: number; }
interface Slot { id: string; startTime: string; endTime: string; }

// BOOKED used to be labelled "Waiting" — but a booked patient hasn't walked in yet.
// Waiting means they're sitting in the lobby. That's the whole point of check-in.
const LABEL: Record<string, string> = { BOOKED: "Expected", CHECKED_IN: "Waiting", COMPLETED: "Completed", CANCELLED: "Cancelled" };
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

export default function ReceptionTodayPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [unpaid, setUnpaid] = useState(0);
  const [acting, setActing] = useState<string | null>(null);   // appointment id mid-flight
  const [err, setErr] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<Appt | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelDone, setCancelDone] = useState<{ opNumber: string; paidInvoice: { receiptNo: string; amountPaid: string } | null } | null>(null);
  const [resched, setResched] = useState<Appt | null>(null);
  const [rsDate, setRsDate] = useState("");
  const [rsSlots, setRsSlots] = useState<Slot[]>([]);
  const [rsSlotId, setRsSlotId] = useState("");
  const [appts, setAppts] = useState<Appt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([
      api.get<{ stats: Stats }>("/reception/stats"),
      api.get<{ appointments: Appt[] }>("/reception/appointments"),
      // how much money is still owed — step 6 of the rail needs to be honest
      api.get<{ invoices: { totalAmount: string; amountPaid: string; status: string }[] }>("/reception/billing")
        .catch(() => ({ invoices: [] })),
    ]).then(([s, a, b]) => {
      if (!active) return;
      setStats(s.stats);
      setAppts(a.appointments);
      setUnpaid(b.invoices.filter((i) =>
        i.status !== "CANCELLED" && Number(i.totalAmount) - Number(i.amountPaid) > 0).length);
    }).catch(() => { }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  // revenue booked today (sum of appointment fees)

  const refresh = async () => {
    const [s2, a2] = await Promise.all([
      api.get<{ stats: Stats }>("/reception/stats"),
      api.get<{ appointments: Appt[] }>("/reception/appointments"),
    ]);
    setStats(s2.stats); setAppts(a2.appointments);
  };

  /** The core front-desk verb: the patient physically walked in. */
  async function checkIn(a: Appt, undo = false) {
    setActing(a.id); setErr(null);
    try {
      if (undo) await api.del(`/reception/appointments/${a.id}/check-in`);
      else await api.post(`/reception/appointments/${a.id}/check-in`, {});
      await refresh();
    } catch (e) { setErr(e instanceof ApiClientError ? e.message : "Could not update arrival."); }
    finally { setActing(null); }
  }

  async function doCancel() {
    if (!cancelling || cancelReason.trim().length < 3) return;
    setActing(cancelling.id); setErr(null);
    try {
      const r = await api.post<{ opNumber: string; paidInvoice: { receiptNo: string; amountPaid: string } | null }>(
        `/reception/appointments/${cancelling.id}/cancel`, { reason: cancelReason.trim() });
      setCancelling(null); setCancelReason("");
      setCancelDone(r);
      await refresh();
    } catch (e) { setErr(e instanceof ApiClientError ? e.message : "Could not cancel."); }
    finally { setActing(null); }
  }

  async function loadRsSlots(a: Appt, date: string) {
    setRsDate(date); setRsSlotId(""); setRsSlots([]);
    if (!date) return;
    try {
      const r = await api.get<{ slots: Slot[] }>(`/reception/slots?doctorId=${a.doctor.id}&date=${date}`);
      setRsSlots(r.slots);
    } catch { setRsSlots([]); }
  }

  async function doReschedule() {
    if (!resched || !rsSlotId) return;
    setActing(resched.id); setErr(null);
    try {
      await api.post(`/reception/appointments/${resched.id}/reschedule`, { newSlotId: rsSlotId });
      setResched(null); setRsDate(""); setRsSlots([]); setRsSlotId("");
      await refresh();
    } catch (e) { setErr(e instanceof ApiClientError ? e.message : "Could not reschedule."); }
    finally { setActing(null); }
  }

  const revenue = appts.reduce((sum, a) => sum + Number(a.price || 0), 0);
  const nextUp = appts.find((a) => a.status === "BOOKED");

  return (
    <PortalScroll>
      {/* ---- header shell: dark pine (matches admin's hero exactly), live chips, booking docked in the scoop ---- */}
      <div data-rise className="relative surface dotgrid mb-6 rounded-[28px]  px-7 py-7 pb-16 text-black sm:px-9">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-[#252525]">Front desk · {today}</p>
        <h1 className="mt-2 font-serif-p text-[clamp(24px,3vw,32px)] font-semibold">Today at Jeeva</h1>
        <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-black/60">
          Everyone who walks in today passes this desk — check them in as they arrive,
          and the doctor&apos;s queue, the billing counter and the pharmacy all stay in step.
        </p>

        {stats && (
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="rounded-full bg-black/10 px-3.5 py-1.5 font-mono text-[11.5px] text-black/85">{stats.waiting} in the lobby</span>
            <span className="rounded-full bg-black/10 px-3.5 py-1.5 font-mono text-[11.5px] text-black/85">{stats.expected} yet to arrive</span>
            <span className="rounded-full bg-black/10 px-3.5 py-1.5 font-mono text-[11.5px] text-black/85">{stats.completed} completed</span>
            {unpaid > 0 && (
              <span className="rounded-full bg-[#f59e0b]/20 px-3.5 py-1.5 font-mono text-[11.5px] text-[#ffd08a]">{unpaid} bills unpaid</span>
            )}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/register" className="rounded-full border border-black/15 px-3.5 py-1.5 text-[12px] font-medium text-black/80 transition-colors hover:bg-black/10 hover:text-black/90">Register patient</Link>
          <Link href="/prescriptions" className="rounded-full border border-black/15 px-3.5 py-1.5 text-[12px] font-medium text-black/80 transition-colors hover:bg-black/10 hover:text-black/90">Prescriptions</Link>
          <Link href="/ipd" className="rounded-full border border-black/15 px-3.5 py-1.5 text-[12px] font-medium text-black/80 transition-colors hover:bg-black/10 hover:text-black/90">Bed board</Link>
          <Link href="/billing" className="rounded-full border border-black/15 px-3.5 py-1.5 text-[12px] font-medium text-black/80 transition-colors hover:bg-black/10 hover:text-black/90">Billing</Link>
          <a href="/print/opd/blank" target="_blank" rel="noopener noreferrer" title="Print a pad of empty case sheets — the power-cut fallback"
            className="rounded-full border border-black/15 px-3.5 py-1.5 text-[12px] font-medium text-black/80 transition-colors hover:bg-black/10 hover:text-black/90">Blank sheet</a>
        </div>

        <div className="scoop scoop-br">
          <Link href="/book" className="btn-primary rounded-lg inline-flex items-center gap-2 px-6 py-3 text-[13px] font-semibold text-white">
            <Icon name="plus" size={13} /> Book appointment →
          </Link>
        </div>
      </div>

      {/* The flow, drawn. New staff read it; old staff fold it away. */}
      <SectionHead index="01 · How the desk flows" title="A visit, start to finish"
        desc="The six steps every patient moves through — the counts update live as the day runs." />
      <FlowRail counts={{
        expected: stats?.expected ?? 0,
        waiting: stats?.waiting ?? 0,
        completed: stats?.completed ?? 0,
        unpaid,
      }} />

      {/* KPI band */}
      <SectionHead index="02 · Today in numbers" title="The day at a glance"
        desc="Booked, waiting and completed visits, plus the consultation money booked against today's list." />
      <div data-rise className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi icon="calendar" label="Appointments" value={stats?.total ?? 0} sub={`${stats?.completed ?? 0} already completed`} delay={0} />
        <Kpi icon="clock" label="Waiting" value={stats?.waiting ?? 0} sub="checked in, sitting in the lobby" delay={60} />
        <Kpi icon="users" label="Yet to arrive" value={stats?.expected ?? 0} sub="booked today, not here yet" delay={120} />
        <Kpi icon="rupee" label="Booked revenue" value={revenue} prefix="₹" sub="consultation fees on today's list" delay={180} />
      </div>

      <SectionHead index="03 · The queue" title="Everyone on today's list"
        desc="Check patients in as they walk through the door — that one tap is what keeps every other counter honest." />
      <div className="grid items-start gap-6 lg:grid-cols-[1.9fr_1fr]">
        {/* queue */}
        <section data-rise className="surface overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--p-border)] px-6 py-4">
            <div>
              <h3 className="text-[14px] font-semibold text-[var(--p-ink)]">Appointment queue</h3>
              <p className="mt-0.5 text-[13px] text-[var(--p-muted)]">Tap a row to open the patient&apos;s file. Completed visits can take the paper Rx straight from here.</p>
            </div>
            <span className="badge">{appts.length} total</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-[14px] text-[var(--p-muted)]"><Spinner /> Loading queue…</div>
          ) : appts.length === 0 ? (
            <div className="dotgrid flex flex-col items-center py-16 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--p-border)] bg-white text-[var(--p-muted)]"><Icon name="calendar" size={20} /></span>
              <p className="mt-3 text-[14px] text-[var(--p-muted)]">No appointments booked for today yet.</p>
              <Link href="/book" className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[var(--p-teal)] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[var(--p-teal-deep)]"><Icon name="plus" size={13} /> Book the first one</Link>
            </div>
          ) : (
            <div className="divide-y divide-[var(--p-border)]">
              {appts.map((a) => (
                <div key={a.id} role="link" tabIndex={0}
                  onClick={() => router.push(`/patients/${a.patient.displayId}`)}
                  onKeyDown={(e) => e.key === "Enter" && router.push(`/patients/${a.patient.displayId}`)}
                  className="flex cursor-pointer items-center justify-between gap-3 px-6 py-3.5 transition-colors hover:bg-[var(--p-bg)]">
                  <div className="flex items-center gap-4">
                    <div className="flex w-14 flex-col items-center">
                      <span className="font-mono text-[14px] font-semibold text-[var(--p-ink)]">{a.time}</span>
                      <span className="mt-0.5 rounded bg-[var(--p-teal-soft)] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-[var(--p-teal)]">{a.type}</span>
                    </div>
                    <div className="h-9 w-px bg-[var(--p-border)]" />
                    <div>
                      <div className="text-[14px] font-medium text-[var(--p-ink)]">{a.patient.name}</div>
                      <div className="text-[13px] text-[var(--p-muted)]"><span className="tabular">{a.patient.displayId}</span> · {a.doctor.name} · {a.doctor.department}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {/* THE front-desk verb: mark the patient as physically here */}
                    {a.status === "BOOKED" && (
                      <button onClick={() => checkIn(a)} disabled={acting === a.id}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--p-teal)] px-3 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-[var(--p-teal-deep)] disabled:opacity-50">
                        {acting === a.id ? <Spinner size={12} /> : <Icon name="check" size={13} />} Check in
                      </button>
                    )}
                    {(a.status === "BOOKED" || a.status === "CHECKED_IN") && (
                      <a href={`/print/opd/${a.id}`} target="_blank" rel="noopener noreferrer"
                        title="Print the OPD case sheet — the doctor writes on this"
                        className="hidden items-center gap-1 rounded-lg border border-[var(--p-border)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--p-teal)] transition-colors hover:border-[var(--p-teal)] sm:inline-flex">
                        <Icon name="file" size={12} /> Sheet
                      </a>
                    )}
                    {a.status === "CHECKED_IN" && (
                      <span className="hidden items-center gap-1.5 text-[12px] text-[var(--p-muted)] sm:inline-flex">
                        <Icon name="clock" size={12} />
                        {a.checkedInAt ? `Arrived ${hhmm(a.checkedInAt)}` : "Arrived"}
                        <button onClick={() => checkIn(a, true)} disabled={acting === a.id}
                          className="ml-1 underline underline-offset-2 hover:text-[var(--p-rose)]">undo</button>
                      </span>
                    )}
                    {a.status === "COMPLETED" && (
                      <Link href={`/prescriptions?patient=${a.patient.displayId}`}
                        className="hidden items-center gap-1.5 rounded-lg border border-[var(--p-teal)]/35 bg-[var(--p-teal-soft)] px-2.5 py-1 text-[12px] font-semibold text-[var(--p-teal-deep)] transition-colors hover:bg-[var(--p-teal)] hover:text-white sm:inline-flex">
                        <Icon name="file" size={12} /> Upload Rx →
                      </Link>
                    )}

                    {/* a visit that hasn't happened yet can still be moved or called off */}
                    {(a.status === "BOOKED" || a.status === "CHECKED_IN") && (
                      <>
                        <button onClick={() => { setResched(a); setRsDate(""); setRsSlots([]); setRsSlotId(""); }}
                          className="hidden rounded-lg border border-[var(--p-border)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--p-text)] transition-colors hover:border-[var(--p-teal)] hover:text-[var(--p-teal)] md:inline-flex">
                          Reschedule
                        </button>
                        <button onClick={() => { setCancelling(a); setCancelReason(""); }}
                          className="hidden rounded-lg border border-[var(--p-border)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--p-muted)] transition-colors hover:border-[var(--p-rose)] hover:text-[var(--p-rose)] md:inline-flex">
                          Cancel
                        </button>
                      </>
                    )}

                    <span className="hidden font-mono text-[13px] text-[var(--p-muted)] lg:block">₹{a.price}</span>
                    <Pill tone={statusTone(LABEL[a.status] ?? a.status)}>{LABEL[a.status] ?? a.status}</Pill>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* side column */}
        <div className="space-y-6">
        {/* next up */}
        <section data-rise className="surface overflow-hidden">
          <div className="border-b border-[var(--p-border)] px-5 py-4">
            <h3 className="text-[14px] font-semibold text-[var(--p-ink)]">Next up</h3>
            <p className="mt-0.5 text-[12px] text-[var(--p-muted)]">The first booked patient who hasn&apos;t arrived yet.</p>
          </div>
          {nextUp ? (
            <div className="p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--p-teal-soft)] font-serif-p text-[14px] font-semibold text-[var(--p-teal)]">{nextUp.patient.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}</div>
                <div>
                  <div className="text-[14px] font-semibold text-[var(--p-ink)]">{nextUp.patient.name}</div>
                  <div className="text-[13px] text-[var(--p-muted)]">{nextUp.time} · {nextUp.doctor.name}</div>
                </div>
              </div>
            </div>
          ) : (
            <p className="px-5 py-6 text-center text-[13px] text-[var(--p-muted)]">No one waiting right now.</p>
          )}
        </section>

        {/* quick actions */}
        <section data-rise className="surface overflow-hidden">
          <div className="border-b border-[var(--p-border)] px-5 py-4">
            <h3 className="text-[14px] font-semibold text-[var(--p-ink)]">Quick actions</h3>
            <p className="mt-0.5 text-[12px] text-[var(--p-muted)]">Everything the desk does, one tap away.</p>
          </div>
          <div className="divide-y divide-[var(--p-border)]">
            <ActionRow href="/register" icon="users" title="Register patient" sub="New walk-in — issues their permanent Jeeva ID in two minutes" />
            <ActionRow href="/book" icon="calendar" title="Book appointment" sub="Picks the doctor and slot, books and bills in one step" />
            <ActionRow href="/prescriptions" icon="file" title="Prescriptions & OPD sheet" sub="Type medicines, labs and vitals — the PDF goes to pharmacy" />
            <ActionRow href="/ipd" icon="bed" title="Admit a patient" sub="Bed board, wards, transfers and discharge" />
            <ActionRow href="/patients" icon="search" title="Find a patient" sub="The full register — history, reports and bills by Jeeva ID" />
          </div>
        </section>
        </div>
      </div>

      {err && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-[var(--p-rose)]/30 bg-[var(--p-rose-soft)] px-4 py-2.5 text-[14px] text-[var(--p-rose)] shadow-lg">
          {err} <button onClick={() => setErr(null)} className="ml-2 font-semibold">✕</button>
        </div>
      )}

      {/* CANCEL — releases the slot so someone else can take it */}
      {cancelling && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="surface w-full max-w-sm bg-white">
            <div className="border-b border-[var(--p-border)] px-6 py-4">
              <h3 className="text-[14px] font-semibold text-[var(--p-ink)]">Cancel this visit?</h3>
              <p className="mt-0.5 text-[13px] text-[var(--p-muted)]">
                {cancelling.patient.name} · <span className="font-mono">{cancelling.opNumber}</span> · {cancelling.time} with {cancelling.doctor.name}
              </p>
            </div>
            <div className="space-y-3 p-6">
              <label className="block text-[13px] font-medium text-[var(--p-text)]">Why?</label>
              <input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} autoFocus
                placeholder="Patient couldn't come / doctor unavailable…"
                className="w-full rounded-lg border border-[var(--p-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--p-teal)]" />
              <p className="rounded-lg bg-[var(--p-teal-soft)] px-3 py-2 text-[12px] leading-relaxed text-[var(--p-teal-deep)]">
                The <b>{cancelling.time} slot goes back on sale</b> immediately — another patient can book it. The visit record is kept, not deleted.
              </p>
            </div>
            <div className="flex justify-end gap-3 border-t border-[var(--p-border)] p-5">
              <button onClick={() => setCancelling(null)} className="rounded-lg border border-[var(--p-border)] px-4 py-2 text-sm text-[var(--p-text)]">Keep it</button>
              <button onClick={doCancel} disabled={acting === cancelling.id || cancelReason.trim().length < 3}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--p-rose)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
                {acting === cancelling.id ? <><Spinner /> Cancelling…</> : "Cancel visit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* cancelled, but money had already changed hands — say so, don't silently refund */}
      {cancelDone && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="surface w-full max-w-sm bg-white p-6 text-center">
            <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-[var(--p-teal-soft)] text-[var(--p-teal)]"><Icon name="check" size={20} /></span>
            <h3 className="mt-3 text-[15px] font-semibold text-[var(--p-ink)]">{cancelDone.opNumber} cancelled</h3>
            <p className="mt-1 text-[13px] text-[var(--p-muted)]">The slot is free for another patient.</p>
            {cancelDone.paidInvoice && (
              <p className="mt-4 rounded-lg bg-[var(--p-amber-soft)] px-3 py-2.5 text-left text-[13px] leading-relaxed text-[#8a6414]">
                <b>This visit was already paid.</b> Receipt <span className="font-mono">{cancelDone.paidInvoice.receiptNo}</span> holds ₹{cancelDone.paidInvoice.amountPaid}.
                I have <b>not</b> refunded it — refunds are a deliberate act. Void the bill from <b>Billing</b> if you&apos;re returning the money.
              </p>
            )}
            <button onClick={() => setCancelDone(null)} className="mt-5 w-full rounded-lg bg-[var(--p-teal)] px-4 py-2.5 text-sm font-semibold text-white">Done</button>
          </div>
        </div>
      )}

      {/* RESCHEDULE — same doctor, different slot */}
      {resched && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="surface w-full max-w-md bg-white">
            <div className="border-b border-[var(--p-border)] px-6 py-4">
              <h3 className="text-[14px] font-semibold text-[var(--p-ink)]">Move this visit</h3>
              <p className="mt-0.5 text-[13px] text-[var(--p-muted)]">
                {resched.patient.name} · currently {resched.time} with {resched.doctor.name}
              </p>
            </div>
            <div className="space-y-4 p-6">
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-[var(--p-text)]">New date</label>
                <input type="date" value={rsDate} onChange={(e) => loadRsSlots(resched, e.target.value)}
                  className="w-full rounded-lg border border-[var(--p-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--p-teal)]" />
              </div>
              {rsDate && (
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-[var(--p-text)]">Free slots</label>
                  {rsSlots.length === 0 ? (
                    <p className="rounded-lg bg-[var(--p-bg)] px-3 py-3 text-center text-[13px] text-[var(--p-muted)]">
                      {resched.doctor.name} has no free slots that day.
                    </p>
                  ) : (
                    <div className="grid max-h-40 grid-cols-3 gap-2 overflow-y-auto">
                      {rsSlots.map((sl) => (
                        <button key={sl.id} onClick={() => setRsSlotId(sl.id)}
                          className={`rounded-lg border px-2 py-2 font-mono text-[13px] transition-colors ${rsSlotId === sl.id ? "border-[var(--p-teal)] bg-[var(--p-teal)] text-white"
                            : "border-[var(--p-border)] text-[var(--p-text)] hover:border-[var(--p-teal)]"}`}>
                          {sl.startTime}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <p className="rounded-lg bg-[var(--p-bg)] px-3 py-2 text-[12px] leading-relaxed text-[var(--p-muted)]">
                Same doctor only — the fee was locked when this was booked, and may already be billed.
                To change doctor, cancel and book fresh so the money decision is explicit.
              </p>
            </div>
            <div className="flex justify-end gap-3 border-t border-[var(--p-border)] p-5">
              <button onClick={() => setResched(null)} className="rounded-lg border border-[var(--p-border)] px-4 py-2 text-sm text-[var(--p-text)]">Cancel</button>
              <button onClick={doReschedule} disabled={acting === resched.id || !rsSlotId}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--p-teal)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
                {acting === resched.id ? <><Spinner /> Moving…</> : "Move visit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </PortalScroll>
  );
}

/** Numbered section header with a one-line explanation — the dashboard teaches. */
function SectionHead({ index, title, desc }: { index: string; title: string; desc?: string }) {
  return (
    <div className="mb-4 mt-8 first:mt-0">
      <p className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-[var(--p-muted)]">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--p-blue)]" aria-hidden />
        {index}
      </p>
      <h2 className="mt-1.5 font-serif-p text-[19px] font-semibold text-[var(--p-ink)]">{title}</h2>
      {desc && <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-[var(--p-muted)]">{desc}</p>}
    </div>
  );
}

function ActionRow({ href, icon, title, sub }: { href: string; icon: "users" | "calendar" | "file" | "search" | "bed"; title: string; sub: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-[var(--p-bg)]">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--p-teal-soft)] text-[var(--p-teal)]"><Icon name={icon} size={17} /></span>
      <div className="flex-1"><div className="text-[14px] font-medium text-[var(--p-ink)]">{title}</div><div className="text-[12px] text-[var(--p-muted)]">{sub}</div></div>
      <Icon name="chevron" size={15} />
    </Link>
  );
}