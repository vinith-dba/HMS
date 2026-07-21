"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon, type IconName } from "@/components/portal/ui/icons";
import { Spinner } from "@/components/portal/ui/form-atoms";
import { PortalScroll } from "@/components/portal/portal-scroll";
import { api } from "@/lib/api-client";
import { type CollectionMode } from "@/components/portal/ui/collections-card";

interface Overview {
  today: { appointments: number; completed: number; newPatients: number; revenue: string; labTests: number };
  totals: { patients: number; doctors: number; staff: number; invoices: number };
  revenueToday: string; revenueMtd: string; revenueYtd: string; revenueLastMonthToDate: string;
  bedOccupancy: { total: number; occupied: number; free: number };
  pharmacyAlerts: number;
  revenueBySource: { source: string; total: string }[];
  revenueByDoctor: { doctor: string; department: string; revenue: string; visits: number }[];
  pharmacyProfit: { profitToday: string; marginPct: number; stockValueCost: string; stockValueMrp: string; potentialProfit: string };
  collectionsByMode: CollectionMode[];
  last7Days: { date: string; appointments: number; revenue: number }[];
  last14Days: { date: string; appointments: number; revenue: number }[];
  last6Months: { label: string; revenue: number }[];
  todayAppointments: { time: string; patient: string; doctor: string; dept: string; status: string }[];
  recentBills: { receiptNo: string; date: string; total: string; status: string; discountPct: number }[];
  outstanding: string;
}

const nowLabel = new Date().toLocaleString("en-IN", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
const inr0 = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const inr2 = (n: number) => "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const compact = (n: number) => n >= 1e7 ? `₹${(n / 1e7).toFixed(2)}Cr` : n >= 1e5 ? `₹${(n / 1e5).toFixed(2)}L` : n >= 1e3 ? `₹${(n / 1e3).toFixed(1)}k` : `₹${Math.round(n)}`;
const pctChange = (cur: number, prev: number): number | null => (prev <= 0 ? null : ((cur - prev) / prev) * 100);
const sum = (a: number[]) => a.reduce((s, x) => s + x, 0);

const SRC_LABEL: Record<string, string> = { CONSULTATION: "Consultation", LAB: "Laboratory", PHARMACY: "Pharmacy", IPD: "Inpatient", OTHER: "Other" };
const SRC_COLOR: Record<string, string> = { CONSULTATION: "#0b5f55", LAB: "#2f6df6", PHARMACY: "#c77d33", IPD: "#7c5cbf", OTHER: "#94a3b8" };

/** Up/down delta pill. goodWhenUp flips the colour meaning (e.g. outstanding rising is bad). */
function Delta({ pct, goodWhenUp = true, suffix = "vs yesterday", onDark = false }: {
  pct: number | null; goodWhenUp?: boolean; suffix?: string; onDark?: boolean;
}) {
  if (pct === null) return <span className={`text-[11px] ${onDark ? "text-white/45" : "text-[var(--p-muted)]"}`}>no prior data</span>;
  const up = pct >= 0;
  const good = up === goodWhenUp;
  const cls = onDark
    ? good ? "bg-white/12 text-[#9fe3cd]" : "bg-white/10 text-[#ffb3a5]"
    : good ? "bg-[var(--p-teal-soft)] text-[var(--p-teal-deep)]" : "bg-[var(--p-rose-soft)] text-[var(--p-rose)]";
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] ${onDark ? "text-white/45" : "text-[var(--p-muted)]"}`}>
      <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold ${cls}`}>
        <svg width="8" height="8" viewBox="0 0 10 10" aria-hidden>{up ? <path d="M5 1l4 7H1z" fill="currentColor" /> : <path d="M5 9L1 3h8z" fill="currentColor" />}</svg>
        {Math.abs(pct).toFixed(0)}%
      </span>
      {suffix}
    </span>
  );
}

function Spark({ data, color }: { data: number[]; color: string }) {
  const W = 130, H = 36;
  if (data.length < 2) return <div className="h-9" />;
  const max = Math.max(...data), min = Math.min(...data), range = max - min || 1;
  const x = (i: number) => (i * W) / (data.length - 1);
  const y = (v: number) => H - 3 - ((v - min) / range) * (H - 6);
  const pts = data.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const area = `${x(0)},${H} ${pts} ${x(data.length - 1)},${H}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-9 w-full" preserveAspectRatio="none" aria-hidden>
      <polygon points={area} fill={color} opacity="0.1" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(data.length - 1)} cy={y(data[data.length - 1])} r="2" fill={color} />
    </svg>
  );
}

/** Numbered section header with a one-line explanation — the dashboard teaches. */
function SectionHead({ index, title, desc, right }: { index: string; title: string; desc?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-4 mt-8 flex flex-wrap items-end justify-between gap-3 first:mt-0">
      <div>
        <p className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-[var(--p-muted)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--p-blue)]" aria-hidden />
          {index}
        </p>
        <h2 className="mt-1.5 font-serif-p text-[19px] font-semibold text-[var(--p-ink)]">{title}</h2>
        {desc && <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-[var(--p-muted)]">{desc}</p>}
      </div>
      {right}
    </div>
  );
}

function HeroKpi({ icon, tint, label, value, right, footer, spark, dark = false }: {
  icon: IconName; tint: string; label: string; value: string; right?: React.ReactNode; footer?: React.ReactNode; spark?: React.ReactNode; dark?: boolean;
}) {
  return (
    <div className={`flex flex-col p-2 ${dark ? "rounded-[22px] bg-[#ffffff] text-white shadow-[var(--p-shadow)]" : "bg-[#ffffff]  surface"}`}>
      <div className={`flex flex-1 flex-col justify-between   rounded-[16px] p-4 ${dark ? "bg-[#0b201d]" : "bg-[#f0eee9]" } `}>
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full"
            style={dark ? { background: "rgba(255,255,255,0.1)", color: "#7fcab8" } : { background: `${tint}14`, color: tint }}>
            <Icon name={icon} size={16} />
          </span>
          <span className={`text-[12px] font-semibold ${dark ? "text-white/60" : "text-[var(--p-muted)]"}`}>{label}</span>
        </div>
        <div className={`mt-3 font-mono text-[26px] font-bold leading-none ${dark ? "text-white" : "text-[var(--p-ink)]"}`}>{value}</div>
        <div className="mt-1.5">{right}</div>
        {spark && <div className="mt-3">{spark}</div>}
        {footer && <div className={`mt-2 text-[11px] ${dark ? "text-white/45" : "text-[var(--p-muted)]"}`}>{footer}</div>}
      </div>
    </div>
  );
}

function Stat({ icon, label, value, sub, delta }: { icon: IconName; label: string; value: string; sub?: string; delta?: React.ReactNode }) {
  return (
    <div className="surface px-4 py-3.5">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--p-muted)]"><Icon name={icon} size={12} /> {label}</div>
      <div className="mt-1 font-mono text-[18px] font-bold text-[var(--p-ink)]">{value}</div>
      {delta ?? (sub && <div className="mt-0.5 text-[11px] leading-snug text-[var(--p-muted)]">{sub}</div>)}
    </div>
  );
}

function CardHead({ title, hint, right }: { title: string; hint?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--p-border)] px-6 py-4">
      <div>
        <h3 className="text-[14px] font-semibold text-[var(--p-ink)]">{title}</h3>
        {hint && <p className="mt-0.5 text-[12px] text-[var(--p-muted)]">{hint}</p>}
      </div>
      {right}
    </div>
  );
}

function statusChip(status: string) {
  const map: Record<string, string> = {
    COMPLETED: "bg-[var(--p-teal-soft)] text-[var(--p-teal-deep)]",
    CHECKED_IN: "bg-[var(--p-cyan-soft)] text-[var(--p-cyan-deep)]",
    BOOKED: "bg-[var(--p-border)]/40 text-[var(--p-muted)]",
    PAID: "bg-[var(--p-teal-soft)] text-[var(--p-teal-deep)]",
    PARTIALLY_PAID: "bg-[#fdf0dd] text-[#8a5a1a]",
    PENDING: "bg-[var(--p-border)]/40 text-[var(--p-muted)]",
    REFUNDED: "bg-[var(--p-rose-soft)] text-[var(--p-rose)]",
    CANCELLED: "bg-[var(--p-rose-soft)] text-[var(--p-rose)]",
  };
  const label: Record<string, string> = { CHECKED_IN: "Checked in", PARTIALLY_PAID: "Part paid" };
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${map[status] ?? "bg-[var(--p-border)]/40 text-[var(--p-muted)]"}`}>{label[status] ?? status[0] + status.slice(1).toLowerCase()}</span>;
}

/** Big gridded revenue chart — area for daily, bars for monthly, with a max reference line. */
function RevenueChart({ mode, daily, monthly }: {
  mode: "daily" | "monthly";
  daily: { date: string; revenue: number }[];
  monthly: { label: string; revenue: number }[];
}) {
  const W = 720, H = 240, L = 52, R = 12, T = 16, B = 26;
  const plotW = W - L - R, plotH = H - T - B;
  const data = mode === "daily" ? daily.map((d) => ({ label: `${d.date.slice(8)}/${d.date.slice(5, 7)}`, v: d.revenue })) : monthly.map((d) => ({ label: d.label, v: d.revenue }));
  const max = Math.max(1, ...data.map((d) => d.v));
  const ticks = 4;
  const gridY = Array.from({ length: ticks + 1 }, (_, i) => (max * i) / ticks);
  const yPix = (v: number) => T + plotH - (v / max) * plotH;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      <defs>
        <linearGradient id="revfill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0b5f55" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#0b5f55" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {/* gridlines + y labels */}
      {gridY.map((g, i) => (
        <g key={i}>
          <line x1={L} y1={yPix(g)} x2={W - R} y2={yPix(g)} stroke="var(--p-border)" strokeWidth="1" opacity="0.6" />
          <text x={L - 8} y={yPix(g) + 3} textAnchor="end" fontSize="9.5" fill="var(--p-muted)">{compact(g)}</text>
        </g>
      ))}
      {mode === "daily" ? (
        (() => {
          const x = (i: number) => L + (i * plotW) / Math.max(1, data.length - 1);
          const pts = data.map((d, i) => `${x(i)},${yPix(d.v)}`).join(" ");
          const area = `${x(0)},${T + plotH} ${pts} ${x(data.length - 1)},${T + plotH}`;
          return (
            <>
              <polygon points={area} fill="url(#revfill)" />
              <polyline points={pts} fill="none" stroke="#0b5f55" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              {data.map((d, i) => <circle key={i} cx={x(i)} cy={yPix(d.v)} r="2.4" fill="#0b5f55" />)}
              {data.map((d, i) => (i % 2 === 0 || i === data.length - 1) && <text key={`l${i}`} x={x(i)} y={H - 8} textAnchor="middle" fontSize="9" fill="var(--p-muted)">{d.label}</text>)}
            </>
          );
        })()
      ) : (
        (() => {
          const gap = plotW / data.length, bw = gap * 0.5;
          return data.map((d, i) => {
            const bx = L + i * gap + (gap - bw) / 2, by = yPix(d.v);
            return (
              <g key={i}>
                <rect x={bx} y={by} width={bw} height={Math.max(1, T + plotH - by)} rx="4" fill="#0b5f55" opacity="0.85" />
                <text x={bx + bw / 2} y={by - 5} textAnchor="middle" fontSize="9" fill="var(--p-muted)">{d.v > 0 ? compact(d.v) : ""}</text>
                <text x={bx + bw / 2} y={H - 8} textAnchor="middle" fontSize="9.5" fill="var(--p-muted)">{d.label}</text>
              </g>
            );
          });
        })()
      )}
    </svg>
  );
}

function Donut({ data }: { data: { source: string; total: number }[] }) {
  const total = Math.max(1, data.reduce((s, d) => s + d.total, 0));
  const R = 52, C = 2 * Math.PI * R;
  let off = 0;
  return (
    <svg viewBox="0 0 140 140" className="h-[128px] w-[128px] shrink-0">
      <g transform="translate(70,70) rotate(-90)">
        <circle r={R} fill="none" stroke="var(--p-border)" strokeWidth="16" opacity="0.35" />
        {data.map((d, i) => {
          const len = (d.total / total) * C;
          const seg = <circle key={i} r={R} fill="none" stroke={SRC_COLOR[d.source] ?? "#94a3b8"} strokeWidth="16" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-off} strokeLinecap="butt" />;
          off += len;
          return seg;
        })}
      </g>
      <text x="70" y="66" textAnchor="middle" fontSize="10" fill="var(--p-muted)">total</text>
      <text x="70" y="80" textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--p-ink)">{compact(total)}</text>
    </svg>
  );
}

const QUICK_LINKS: { href: string; label: string }[] = [
  { href: "/appointments", label: "Appointments" },
  { href: "/bills", label: "Bills" },
  { href: "/wards", label: "Wards & beds" },
  { href: "/staff", label: "Staff" },
  { href: "/audit", label: "Audit log" },
];

export default function AdminOverview() {
  const [o, setO] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<"daily" | "monthly">("daily");

  useEffect(() => {
    api.get<{ overview: Overview }>("/admin/overview").then((r) => setO(r.overview)).catch(() => { }).finally(() => setLoading(false));
  }, []);

  return (
    <PortalScroll>
      {/* ---- header shell: dark pine, quick links, day-close docked in the scoop ---- */}
      <div data-rise className="relative mb-6 rounded-[28px] bg-[#0b201d] px-7 py-7 pb-16 text-white sm:px-9">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.016em] text-[#7fcab8]">Admin console · as of {nowLabel}</p>
        <h1 className="mt-2 font-serif-p text-[clamp(24px,3vw,32px)] font-semibold">Hospital overview</h1>
        <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-white/60">
          The live financial and operational picture across OPD, IPD, laboratory and pharmacy —
          every number updates as bills post and patients move.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {QUICK_LINKS.map((q) => (
            <Link key={q.href} href={q.href}
              className="rounded-full border border-white/15 px-3.5 py-1.5 text-[12px] font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white">
              {q.label}
            </Link>
          ))}
        </div>

        <div className="scoop scoop-br">
          <Link href="/day-close" className="btn-primary rounded-lg px-6 py-3 text-[13px] font-semibold text-white">
            Run day close →
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-[13px] text-[var(--p-muted)]"><Spinner /> Loading…</div>
      ) : !o ? (
        <p className="surface p-10 text-center text-[13px] text-[var(--p-muted)]">Couldn&apos;t load the overview.</p>
      ) : (() => {
        const s = o.last14Days;
        const revSeries = s.map((d) => d.revenue);
        const apptSeries = s.map((d) => d.appointments);
        const revToday = s[s.length - 1]?.revenue ?? 0, revYest = s[s.length - 2]?.revenue ?? 0;
        const apToday = s[s.length - 1]?.appointments ?? 0, apYest = s[s.length - 2]?.appointments ?? 0;
        const thisWeekRev = sum(s.slice(7).map((d) => d.revenue)), lastWeekRev = sum(s.slice(0, 7).map((d) => d.revenue));
        const collectedToday = (o.collectionsByMode ?? []).reduce((a, m) => a + m.collected, 0);
        const cash = (o.collectionsByMode ?? []).find((m) => m.mode === "CASH")?.collected ?? 0;
        const upi = (o.collectionsByMode ?? []).find((m) => m.mode === "UPI")?.collected ?? 0;
        const card = (o.collectionsByMode ?? []).find((m) => m.mode === "CARD")?.collected ?? 0;
        const occPct = o.bedOccupancy.total > 0 ? Math.round((o.bedOccupancy.occupied / o.bedOccupancy.total) * 100) : 0;

        return (
          <>
            <SectionHead index="01 · Today at the counters" title="Money and movement, right now"
              desc="What was billed and collected today against yesterday, with the last 14 days drawn behind each number." />
            <div data-rise className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <HeroKpi dark icon="rupee" tint="#0b5f55" label="Revenue today" value={inr0(Number(o.revenueToday))}
                right={<Delta onDark pct={pctChange(revToday, revYest)} />}
                spark={<Spark data={revSeries} color="#7fcab8" />} footer="Billed value across every counter, last 14 days behind it" />
              <HeroKpi icon="calendar" tint="#2f6df6" label="Appointments today" value={String(o.today.appointments)}
                right={<Delta pct={pctChange(apToday, apYest)} />}
                spark={<Spark data={apptSeries} color="#2f6df6" />} footer={`${o.today.completed} completed · ${o.today.labTests} lab tests ordered`} />
              <HeroKpi icon="trend" tint="#7c5cbf" label="Revenue this week" value={compact(thisWeekRev)}
                right={<Delta pct={pctChange(thisWeekRev, lastWeekRev)} suffix="vs last week" />}
                spark={<Spark data={revSeries} color="#7c5cbf" />} footer="Rolling 7 days of billed value" />
              <HeroKpi icon="receipt" tint="#c77d33" label="Collected today" value={inr0(collectedToday)}
                right={<span className="text-[11px] text-[var(--p-muted)]">actually received, all counters</span>}
                footer={<span className="flex gap-2"><span>Cash {compact(cash)}</span>·<span>UPI {compact(upi)}</span>·<span>Card {compact(card)}</span></span>} />
            </div>

            <SectionHead index="02 · The month in numbers" title="Where the books stand"
              desc="Month-to-date and year-to-date billing, unpaid balances, and the state of beds, pharmacy stock and the patient register." />
            <div data-rise className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
              <Stat icon="trend" label="Revenue MTD" value={compact(Number(o.revenueMtd))}
                delta={<div className="mt-0.5"><Delta pct={pctChange(Number(o.revenueMtd), Number(o.revenueLastMonthToDate))} suffix="vs last month" /></div>} />
              <Stat icon="building" label="Revenue YTD" value={compact(Number(o.revenueYtd))} sub="billed since the year began" />
              <Stat icon="receipt" label="Outstanding" value={compact(Number(o.outstanding))} sub="unpaid patient balances to chase" />
              <Stat icon="bed" label="Bed occupancy" value={`${o.bedOccupancy.occupied}/${o.bedOccupancy.total}`} sub={`${occPct}% full · ${o.bedOccupancy.free} beds free right now`} />
              <Stat icon="pill" label="Pharmacy alerts" value={String(o.pharmacyAlerts)} sub={o.pharmacyAlerts > 0 ? "batches at or below reorder level" : "every batch above reorder level"} />
              <Stat icon="search" label="Patients" value={o.totals.patients.toLocaleString("en-IN")} sub={`${o.totals.doctors} doctors · ${o.totals.staff} staff on rolls`} />
            </div>

            <SectionHead index="03 · Revenue trend" title="Billed value over time"
              desc="Flip between the daily pulse of the last two weeks and the six-month picture. The area is billed value, not collections." />
            <section data-rise className="surface overflow-hidden">
              <CardHead title="Revenue trend"
                hint={range === "daily" ? "Last 14 days of billed value" : "Last 6 months of billed value"}
                right={
                  <div className="flex items-center gap-3">
                    <div className="hidden text-right sm:block">
                      <div className="font-mono text-[15px] font-bold text-[var(--p-ink)]">{range === "daily" ? compact(thisWeekRev) : compact(sum(o.last6Months.map((m) => m.revenue)))}</div>
                      <div className="text-[11px] text-[var(--p-muted)]">{range === "daily" ? "last 7 days" : "6-month total"}</div>
                    </div>
                    <div className="flex gap-1 rounded-[9px] border border-[var(--p-border)] p-0.5">
                      {(["daily", "monthly"] as const).map((r) => (
                        <button key={r} onClick={() => setRange(r)}
                          className={`rounded px-3.5 py-1 text-[12px] font-semibold capitalize transition-colors ${range === r ? "bg-[var(--p-teal)] text-white" : "text-[var(--p-muted)] hover:text-[var(--p-ink)]"}`}>{r}</button>
                      ))}
                    </div>
                  </div>
                } />
              <div className="p-5"><RevenueChart mode={range} daily={o.last14Days} monthly={o.last6Months} /></div>
            </section>

            <SectionHead index="04 · Where the money comes from" title="Departments and doctors"
              desc="Billing split by source counter, and the consultants whose OPD and inpatient work generates it." />
            <div className="grid gap-6 lg:grid-cols-2">
              <section data-rise className="surface overflow-hidden">
                <CardHead title="Revenue by department" hint="Share of billed value by source counter" />
                <div className="flex items-center gap-5 p-6">
                  {o.revenueBySource.length === 0 ? <p className="text-[13px] text-[var(--p-muted)]">No billing yet.</p> : (
                    <>
                      <Donut data={o.revenueBySource.map((r) => ({ source: r.source, total: Number(r.total) }))} />
                      <div className="flex-1 space-y-2.5">
                        {o.revenueBySource.map((r) => {
                          const totalAll = o.revenueBySource.reduce((a, x) => a + Number(x.total), 0) || 1;
                          return (
                            <div key={r.source} className="flex items-center justify-between text-[13px]">
                              <span className="flex items-center gap-2">
                                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: SRC_COLOR[r.source] ?? "#94a3b8" }} />
                                <span className="text-[var(--p-ink)]">{SRC_LABEL[r.source] ?? r.source}</span>
                              </span>
                              <span className="font-mono text-[var(--p-muted)]">{compact(Number(r.total))} · {Math.round((Number(r.total) / totalAll) * 100)}%</span>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </section>

              <section data-rise className="surface overflow-hidden">
                <CardHead title="Revenue by doctor" hint="Consultation + inpatient billing per doctor, most first" />
                <div className="space-y-3 p-6">
                  {o.revenueByDoctor.length === 0 ? <p className="text-[13px] text-[var(--p-muted)]">No doctor-attributed billing yet.</p> : o.revenueByDoctor.slice(0, 6).map((d, i) => {
                    const max = Number(o.revenueByDoctor[0].revenue) || 1;
                    const pctW = Math.max(4, (Number(d.revenue) / max) * 100);
                    return (
                      <div key={d.doctor + i}>
                        <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
                          <span className="truncate"><span className="font-medium text-[var(--p-ink)]">{d.doctor}</span> <span className="text-[var(--p-muted)]">· {d.department}</span></span>
                          <span className="shrink-0 font-mono text-[var(--p-ink)]">{compact(Number(d.revenue))} <span className="text-[var(--p-muted)]">· {d.visits} visits</span></span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-[var(--p-border)]/40"><div className="h-full rounded-full bg-[var(--p-teal)]" style={{ width: `${pctW}%` }} /></div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>

            <SectionHead index="05 · Pharmacy margin" title="What the counter earns"
              desc="Realized profit on today's sales (MRP minus purchase rate), and the margin still sitting in current stock." />
            <section data-rise className="surface overflow-hidden">
              <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--p-muted)]">Profit today</div>
                  <div className="mt-1 font-mono text-[20px] font-bold text-[var(--p-teal)]">{inr0(Number(o.pharmacyProfit.profitToday))}</div>
                  <div className="mt-0.5 text-[11px] text-[var(--p-muted)]">{o.pharmacyProfit.marginPct.toFixed(1)}% margin on costed sales</div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--p-muted)]">Stock value (MRP)</div>
                  <div className="mt-1 font-mono text-[20px] font-bold text-[var(--p-ink)]">{inr0(Number(o.pharmacyProfit.stockValueMrp))}</div>
                  <div className="mt-0.5 text-[11px] text-[var(--p-muted)]">bought at {inr0(Number(o.pharmacyProfit.stockValueCost))}</div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--p-muted)]">Potential profit</div>
                  <div className="mt-1 font-mono text-[20px] font-bold text-[var(--p-teal)]">{inr0(Number(o.pharmacyProfit.potentialProfit))}</div>
                  <div className="mt-0.5 text-[11px] text-[var(--p-muted)]">margin waiting in current stock</div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--p-muted)]">Margin today</div>
                  <div className="mt-1 font-mono text-[20px] font-bold text-[var(--p-ink)]">{o.pharmacyProfit.marginPct.toFixed(1)}%</div>
                  <div className="mt-0.5 text-[11px] text-[var(--p-muted)]">realized sell-through</div>
                </div>
              </div>
            </section>

            <SectionHead index="06 · Today's movement" title="Appointments and bills as they land"
              desc="The same live lists the reception and billing desks are working from — statuses update as patients move." />
            <div className="grid gap-6 lg:grid-cols-2">
              <section data-rise className="surface overflow-hidden">
                <CardHead title="Today's appointments" hint="Every booking on today's list, with its live status"
                  right={<span className="rounded-full bg-[var(--p-teal-soft)] px-2.5 py-0.5 font-mono text-[12px] font-semibold text-[var(--p-teal-deep)]">{o.todayAppointments.length}</span>} />
                <div className="max-h-[340px] divide-y divide-[var(--p-border)] overflow-auto">
                  {o.todayAppointments.length === 0 ? <p className="px-6 py-8 text-center text-[13px] text-[var(--p-muted)]">Nothing on the books today.</p> : o.todayAppointments.map((a, i) => (
                    <div key={i} className="flex items-center justify-between px-6 py-3">
                      <div className="flex items-center gap-3">
                        <span className="w-11 font-mono text-[12px] text-[var(--p-muted)]">{a.time}</span>
                        <div><div className="text-[13px] font-medium text-[var(--p-ink)]">{a.patient}</div><div className="text-[12px] text-[var(--p-muted)]">{a.doctor} · {a.dept}</div></div>
                      </div>
                      {statusChip(a.status)}
                    </div>
                  ))}
                </div>
              </section>

              <section data-rise className="surface overflow-hidden">
                <CardHead title="Recent bills" hint="Latest receipts across every counter, newest first"
                  right={<span className="rounded-full bg-[var(--p-teal-soft)] px-2.5 py-0.5 font-mono text-[12px] font-semibold text-[var(--p-teal-deep)]">{o.recentBills.length}</span>} />
                <div className="max-h-[340px] divide-y divide-[var(--p-border)] overflow-auto">
                  {o.recentBills.length === 0 ? <p className="px-6 py-8 text-center text-[13px] text-[var(--p-muted)]">No bills yet.</p> : o.recentBills.map((b) => (
                    <div key={b.receiptNo} className="flex items-center justify-between px-6 py-3">
                      <div><div className="font-mono text-[13px] font-medium text-[var(--p-ink)]">{b.receiptNo}</div><div className="text-[12px] text-[var(--p-muted)]">{b.date}{b.discountPct > 0 ? ` · ${b.discountPct}% off` : ""}</div></div>
                      <div className="text-right"><div className="font-mono text-[13px] text-[var(--p-ink)]">{inr2(Number(b.total))}</div><div className="mt-0.5">{statusChip(b.status)}</div></div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </>
        );
      })()}
    </PortalScroll>
  );
}
