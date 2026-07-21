"use client";

import { useEffect, useMemo, useState } from "react";
import { Spinner } from "@/components/portal/ui/form-atoms";
import { Icon } from "@/components/portal/ui/icons";
import { PortalScroll } from "@/components/portal/portal-scroll";
import { api } from "@/lib/api-client";

interface Row {
  id: string; opNumber: string; time: string; status: string; price: string; visitDate: string;
  referredByName: string | null; referralSource: string | null;
  patient: { id: string; displayId: string; name: string };
  doctor: { id: string; name: string; department: string };
  bill: { total: string; status: string; paymentModes: string[] } | null;
}

const inr2 = (n: number) => "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function apptChip(status: string) {
  const map: Record<string, string> = {
    COMPLETED: "bg-[var(--p-teal-soft)] text-[var(--p-teal-deep)]",
    CHECKED_IN: "bg-[var(--p-cyan-soft)] text-[var(--p-cyan-deep)]",
    BOOKED: "bg-[var(--p-border)]/40 text-[var(--p-muted)]",
    CANCELLED: "bg-[var(--p-rose-soft)] text-[var(--p-rose)]",
  };
  const label: Record<string, string> = { BOOKED: "Waiting", CHECKED_IN: "Checked in", COMPLETED: "Completed", CANCELLED: "Cancelled" };
  return <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${map[status] ?? "bg-[var(--p-border)]/40 text-[var(--p-muted)]"}`}>{label[status] ?? status}</span>;
}

function billChip(status: string) {
  const map: Record<string, string> = {
    PAID: "bg-[var(--p-teal-soft)] text-[var(--p-teal-deep)]",
    PARTIALLY_PAID: "bg-[#fdf0dd] text-[#8a5a1a]",
    PENDING: "bg-[var(--p-border)]/40 text-[var(--p-muted)]",
    REFUNDED: "bg-[var(--p-rose-soft)] text-[var(--p-rose)]",
    CANCELLED: "bg-[var(--p-rose-soft)] text-[var(--p-rose)]",
  };
  const label: Record<string, string> = { PARTIALLY_PAID: "Part paid" };
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${map[status] ?? "bg-[var(--p-border)]/40 text-[var(--p-muted)]"}`}>{label[status] ?? status[0] + status.slice(1).toLowerCase()}</span>;
}

function modeChip(m: string) {
  const c: Record<string, string> = {
    CASH: "bg-[var(--p-teal-soft)] text-[var(--p-teal-deep)]",
    UPI: "bg-[var(--p-cyan-soft)] text-[var(--p-cyan-deep)]",
    CARD: "bg-[#efe9fb] text-[#5b3fa0]",
    NETBANKING: "bg-[#e7effb] text-[#2f6df6]",
    OTHER: "bg-[var(--p-border)]/40 text-[var(--p-muted)]",
  };
  const label: Record<string, string> = { NETBANKING: "Netbank", UPI: "UPI" };
  return <span key={m} className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${c[m] ?? "bg-[var(--p-border)]/40 text-[var(--p-muted)]"}`}>{label[m] ?? m[0] + m.slice(1).toLowerCase()}</span>;
}

export default function AdminAppointmentsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [referrer, setReferrer] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ appointments: Row[] }>("/admin/appointments")
      .then((r) => setRows(r.appointments)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // Referred count by person — ranked.
  const referrers = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) { const n = r.referredByName?.trim(); if (n) m.set(n, (m.get(n) ?? 0) + 1); }
    return [...m.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [rows]);

  const shown = useMemo(() => rows.filter((r) => {
    if (referrer && (r.referredByName?.trim() ?? "") !== referrer) return false;
    if (q.trim()) {
      const t = q.toLowerCase();
      return r.patient.name.toLowerCase().includes(t)
        || r.patient.displayId.toLowerCase().includes(t)
        || r.doctor.name.toLowerCase().includes(t)
        || (r.referredByName ?? "").toLowerCase().includes(t);
    }
    return true;
  }), [rows, q, referrer]);

  return (
    <PortalScroll>
      <div data-rise className="surface dotgrid mb-6 px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--p-teal)]">Admin console</p>
            <h1 className="mt-1 font-serif-p text-[24px] font-semibold text-[var(--p-ink)]">Appointment history</h1>
            <p className="mt-1 text-[13px] text-[var(--p-muted)]">Every booking with referral attribution and how the visit was billed.</p>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-[#fdf0dd] px-3 py-1 text-[11px] font-semibold text-[#8a6414]"><Icon name="alert" size={12} /> Admin-only</span>
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-[var(--p-border)] bg-white px-3 py-2">
          <Icon name="search" size={15} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search patient, UHID, doctor or referral name" className="w-full bg-transparent text-[13px] text-[var(--p-ink)] outline-none" />
          {q && <button onClick={() => setQ("")} className="text-[12px] text-[var(--p-muted)]">clear</button>}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-[13px] text-[var(--p-muted)]"><Spinner /> Loading history…</div>
      ) : (
        <>
          {/* Referred count by person */}
          {referrers.length > 0 && (
            <section data-rise className="surface mb-6 overflow-hidden">
              <div className="border-b border-[var(--p-border)] px-6 py-4">
                <h3 className="text-[14px] font-semibold text-[var(--p-ink)]">Referrals by person</h3>
                <p className="mt-0.5 text-[12px] text-[var(--p-muted)]">How many visits each referrer sent in. Tap to filter.</p>
              </div>
              <div className="flex flex-wrap gap-2 p-5">
                <button onClick={() => setReferrer(null)}
                  className={`rounded-lg border px-3 py-1.5 text-[12px] font-semibold ${!referrer ? "border-[var(--p-teal)] bg-[var(--p-teal)] text-white" : "border-[var(--p-border)] text-[var(--p-muted)]"}`}>All</button>
                {referrers.map((r) => (
                  <button key={r.name} onClick={() => setReferrer(referrer === r.name ? null : r.name)}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[12px] font-semibold ${referrer === r.name ? "border-[var(--p-teal)] bg-[var(--p-teal)] text-white" : "border-[var(--p-border)] text-[var(--p-ink)]"}`}>
                    {r.name}
                    <span className={`rounded-full px-1.5 text-[11px] ${referrer === r.name ? "bg-white/25" : "bg-[var(--p-teal-soft)] text-[var(--p-teal-deep)]"}`}>{r.count}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* History */}
          <section data-rise className="surface overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--p-border)] px-6 py-4">
              <h3 className="text-[14px] font-semibold text-[var(--p-ink)]">{referrer ? `Referred by ${referrer}` : "All appointments"}</h3>
              <span className="text-[12px] text-[var(--p-muted)]">{shown.length} shown</span>
            </div>
            <div className="divide-y divide-[var(--p-border)]">
              {shown.length === 0 ? (
                <p className="px-6 py-12 text-center text-[13px] text-[var(--p-muted)]">No appointments match.</p>
              ) : shown.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-6 py-3.5">
                  <div className="min-w-[140px]   flex-1">
                    <div className="text-[14px] font-medium text-[var(--p-ink)]">{r.patient.name}</div>
                    <div className="font-mono text-[12px] text-[var(--p-muted)]">{r.patient.displayId} · {r.opNumber}</div>
                  </div>
                  <div className="min-w-[150px]">
                    <div className="text-[13px] text-[var(--p-ink)]">{r.doctor.name}</div>
                    <div className="text-[12px] text-[var(--p-muted)]">{r.doctor.department}</div>
                  </div>
                  <div className="min-w-[110px] text-[12px] text-[var(--p-muted)]">
                    <div className="text-[var(--p-ink)]">{r.visitDate}</div>
                    <div>{r.time}</div>
                  </div>
                  <div className="min-w-[130px]">
                    {r.referredByName ? (
                      <>
                        <div className="text-[12px] text-[var(--p-muted)]">Referred by</div>
                        <div className="text-[13px] text-[var(--p-ink)]">{r.referredByName}</div>
                        {r.referralSource && <div className="text-[11px] text-[var(--p-muted)]">{r.referralSource}</div>}
                      </>
                    ) : <span className="text-[12px] text-[var(--p-muted)]">Walk-in</span>}
                  </div>
                  <div className="min-w-[150px]">
                    {r.bill ? (
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[13px] text-[var(--p-ink)]">{inr2(Number(r.bill.total))}</span>
                          {billChip(r.bill.status)}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {r.bill.paymentModes.length > 0 ? r.bill.paymentModes.map(modeChip) : <span className="text-[11px] text-[var(--p-muted)]">unpaid</span>}
                        </div>
                      </div>
                    ) : <span className="text-[12px] text-[var(--p-muted)]">No bill</span>}
                  </div>
                  {apptChip(r.status)}
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </PortalScroll>
  );
}
