"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Kpi, Pill } from "@/components/portal/ui/primitives";
import { Icon } from "@/components/portal/ui/icons";
import { Spinner } from "@/components/portal/ui/form-atoms";
import { PortalScroll } from "@/components/portal/portal-scroll";
import { api } from "@/lib/api-client";
import { PharmacyFlow } from "@/components/portal/pharmacy/pharmacy-flow";
import { CollectionsCard, type CollectionMode } from "@/components/portal/ui/collections-card";

interface Stats { pendingRx: number; dispensedToday: number; revenueToday: string; lowStock: number; expiringSoon: number; expired: number; profitToday: string; marginPct: number; stockValueCost: string; stockValueMrp: string; potentialProfit: string; collections: CollectionMode[]; }
const inr = (n: number) => "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
interface Rx {
  id: string; fileUrl: string; title: string | null; doctorName: string | null; sentToPharmacyAt: string | null;
  patient: { displayId: string; fullName: string; age: number | null };
}

const nowLabel = new Date().toLocaleString("en-IN", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

const QUICK_LINKS: { href: string; label: string }[] = [
  { href: "/queue", label: "Prescription queue" },
  { href: "/dispense", label: "Dispense" },
  { href: "/stock", label: "Stock & batches" },
  { href: "/alerts", label: "Alerts" },
];

/** Numbered section header with a one-line explanation — the dashboard teaches. */
function SectionHead({ index, title, desc, right }: { index: string; title: string; desc?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-4 mt-8 flex flex-wrap items-end justify-between gap-3 first:mt-0">
      <div>
        <p className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-[var(--p-muted)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--p-cyan)]" aria-hidden />
          {index}
        </p>
        <h2 className="mt-1.5 font-serif-p text-[19px] font-semibold text-[var(--p-ink)]">{title}</h2>
        {desc && <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-[var(--p-muted)]">{desc}</p>}
      </div>
      {right}
    </div>
  );
}

export default function PharmacyDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [queue, setQueue] = useState<Rx[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<{ stats: Stats }>("/pharmacy/stats"),
      api.get<{ queue: Rx[] }>("/pharmacy/queue"),
    ]).then(([s, q]) => { setStats(s.stats); setQueue(q.queue.slice(0, 6)); })
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  const alerts = (stats?.lowStock ?? 0) + (stats?.expiringSoon ?? 0);

  return (
    <PortalScroll>
      {/* ---- header shell: dark pine (matches admin's hero exactly), live chips, dispense docked in the scoop ---- */}
      <div data-rise className="surface dotgrid relative mb-6 rounded-[28px] bg-[#0b201d] px-7 py-7 pb-16 text-[#252525] sm:px-9">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-[#252525]">Pharmacy · as of {nowLabel}</p>
        <h1 className="mt-2 font-serif-p text-[clamp(24px,3vw,32px)] font-semibold">Dispensing counter</h1>
        <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-black/60">
          Reception scans the doctor&apos;s handwritten prescription and it lands here.
          Dispense against the scan — the system picks the earliest-expiry batch,
          checks stock, and prints a GST bill against the patient&apos;s Jeeva ID.
        </p>

        {stats && (
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="rounded-full bg-black/10 px-3.5 py-1.5 font-mono text-[11.5px] text-black/85">
              {stats.pendingRx} waiting
            </span>
            <span className="rounded-full bg-black/10 px-3.5 py-1.5 font-mono text-[11.5px] text-black/85">
              {stats.dispensedToday} dispensed today
            </span>
            <span className={`rounded-full px-3.5 py-1.5 font-mono text-[11.5px] ${alerts > 0 ? "bg-[#f2711c]/20 text-[#ffb98a]" : "bg-black/10 text-black/85"}`}>
              {alerts} stock alerts
            </span>
            {stats.expired > 0 && (
              <span className="rounded-full bg-[#e5484d]/20 px-3.5 py-1.5 font-mono text-[11.5px] text-[#ffa8ab]">
                {stats.expired} expired — quarantine
              </span>
            )}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {QUICK_LINKS.map((q) => (
            <Link key={q.href} href={q.href}
              className="rounded-full border border-black/15 px-3.5 py-1.5 text-[12px] font-medium text-black/80 transition-colors hover:bg-black/10 hover:text-black/90">
              {q.label}
            </Link>
          ))}
        </div>

        <div className="scoop scoop-br">
          <Link href="/dispense" className="btn-primary inline-flex items-center gap-2 rounded-lg px-6 py-3 text-[13px] font-semibold text-white">
            <Icon name="pill" size={15} /> Dispense now →
          </Link>
        </div>
      </div>

      {/* ---- 01 · the counter right now ---- */}
      <SectionHead index="01 · The counter right now" title="Work waiting and work done"
        desc="Prescriptions appear the moment reception sends a scan through. Alerts count every batch that is low on stock or close to its expiry date." />
      <div data-rise className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi icon="file" label="Prescriptions waiting" value={stats?.pendingRx ?? 0} sub="sent by reception, oldest first" delay={0} />
        <Kpi icon="check" label="Dispensed today" value={stats?.dispensedToday ?? 0} sub="bills completed at this counter" delay={60} />
        <Kpi icon="rupee" label="Revenue today" value={Number(stats?.revenueToday ?? 0)} prefix="₹" sub="pharmacy sales, GST included" delay={120} />
        <Kpi icon="alert" label="Stock alerts" value={alerts} sub={`${stats?.lowStock ?? 0} below reorder · ${stats?.expiringSoon ?? 0} expiring soon`} delay={180} />
      </div>

      {/* ---- 02 · money at this counter ---- */}
      <SectionHead index="02 · Money at this counter" title="What the pharmacy earns"
        desc="Realized profit is MRP minus purchase rate on today's sales. Potential profit is the same margin still sitting on the shelves, valued at MRP." />
      <div data-rise className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="grid grid-cols-2 gap-4">
          <div className="surface px-5 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--p-muted)]">Profit today</div>
            <div className="mt-1 font-mono text-[21px] font-bold text-[var(--p-teal)]">{inr(Number(stats?.profitToday ?? 0))}</div>
            <div className="mt-0.5 text-[12px] text-[var(--p-muted)]">MRP − purchase rate on today&apos;s sales</div>
          </div>
          <div className="surface px-5 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--p-muted)]">Margin today</div>
            <div className="mt-1 font-mono text-[21px] font-bold text-[var(--p-ink)]">{(stats?.marginPct ?? 0).toFixed(1)}%</div>
            <div className="mt-0.5 text-[12px] text-[var(--p-muted)]">realized on costed lines</div>
          </div>
          <div className="surface px-5 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--p-muted)]">Stock value (MRP)</div>
            <div className="mt-1 font-mono text-[21px] font-bold text-[var(--p-ink)]">{inr(Number(stats?.stockValueMrp ?? 0))}</div>
            <div className="mt-0.5 text-[12px] text-[var(--p-muted)]">bought at {inr(Number(stats?.stockValueCost ?? 0))}</div>
          </div>
          <div className="surface px-5 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--p-muted)]">Potential profit</div>
            <div className="mt-1 font-mono text-[21px] font-bold text-[var(--p-teal)]">{inr(Number(stats?.potentialProfit ?? 0))}</div>
            <div className="mt-0.5 text-[12px] text-[var(--p-muted)]">margin waiting in current stock</div>
          </div>
        </div>
        <CollectionsCard modes={stats?.collections ?? []} accent="blue" subtitle="Collected at the pharmacy today, by payment mode" />
      </div>

      {/* ---- 03 · how the counter works ---- */}
      <SectionHead index="03 · How this counter works" title="The pharmacist's day, drawn"
        desc="The flow below names the two things that go wrong at pharmacy counters — dispensing from the wrong batch, and billing without checking expiry. The system blocks both." />
      <PharmacyFlow counts={{
        waiting: stats?.pendingRx ?? 0,
        low: stats?.lowStock ?? 0,
        expiring: stats?.expiringSoon ?? 0,
        expired: stats?.expired ?? 0,
      }} />

      {/* ---- 04 · work waiting ---- */}
      <SectionHead index="04 · Work waiting" title="The prescription queue"
        desc="The same list reception sees — open the scan beside the dispensing form so the doctor's handwriting is never retyped from memory." />
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section data-rise className="surface overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--p-border)] px-6 py-4">
            <div>
              <h3 className="text-[14px] font-semibold text-[var(--p-ink)]">Prescription queue</h3>
              <p className="mt-0.5 text-[12px] text-[var(--p-muted)]">Open the scan, then dispense against it.</p>
            </div>
            <Link href="/queue" className="text-[12px] font-medium text-[var(--p-blue)] hover:underline">View all →</Link>
          </div>
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-[var(--p-muted)]"><Spinner /> Loading…</div>
          ) : queue.length === 0 ? (
            <div className="dotgrid flex flex-col items-center py-16 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--p-border)] bg-white text-[var(--p-muted)]"><Icon name="file" size={20} /></span>
              <p className="mt-3 text-[13px] text-[var(--p-muted)]">No prescriptions waiting. Reception hasn&apos;t sent any through.</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--p-border)]">
              {queue.map((r) => (
                <Link key={r.id} href="/queue" className="flex items-center justify-between gap-3 px-6 py-3.5 transition-colors hover:bg-[var(--p-bg)]">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--p-cyan-soft)] text-[var(--p-cyan-deep)]"><Icon name="file" size={16} /></span>
                    <div>
                      <div className="text-[14px] font-medium text-[var(--p-ink)]">{r.patient.fullName}</div>
                      <div className="text-[12px] text-[var(--p-muted)]">
                        <span className="tabular">{r.patient.displayId}</span>
                        {r.doctorName && ` · ${r.doctorName}`}
                      </div>
                    </div>
                  </div>
                  <Pill tone="waiting">Waiting</Pill>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section data-rise className="surface h-fit overflow-hidden">
          <div className="border-b border-[var(--p-border)] px-5 py-4">
            <h3 className="text-[13px] font-semibold text-[var(--p-ink)]">Quick actions</h3>
            <p className="mt-0.5 text-[12px] text-[var(--p-muted)]">Everything this counter does, one tap away.</p>
          </div>
          <div className="divide-y divide-[var(--p-border)]">
            <A href="/queue" icon="file" title="Prescription queue" sub="Scans sent by reception, oldest first" />
            <A href="/dispense" icon="pill" title="Dispense medicines" sub="Earliest-expiry batch picked automatically, GST bill printed" />
            <A href="/stock" icon="bed" title="Stock & batches" sub="Receive purchases, adjust counts, track every expiry" />
            <A href="/alerts" icon="alert" title="Alerts" sub="Low stock and expiring batches, before they become a problem" />
          </div>
        </section>
      </div>
    </PortalScroll>
  );
}

function A({ href, icon, title, sub }: { href: string; icon: "file" | "pill" | "bed" | "alert"; title: string; sub: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-[var(--p-bg)]">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--p-blue-soft)] text-[var(--p-blue)]"><Icon name={icon} size={17} /></span>
      <div className="flex-1"><div className="text-[13px] font-medium text-[var(--p-ink)]">{title}</div><div className="text-[11px] leading-snug text-[var(--p-muted)]">{sub}</div></div>
      <Icon name="chevron" size={15} />
    </Link>
  );
}