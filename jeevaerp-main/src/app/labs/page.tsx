"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Kpi, Pill, statusTone } from "@/components/portal/ui/primitives";
import { Icon } from "@/components/portal/ui/icons";
import { Spinner } from "@/components/portal/ui/form-atoms";
import { PortalScroll } from "@/components/portal/portal-scroll";
import { api } from "@/lib/api-client";
import { CollectionsCard, type CollectionMode } from "@/components/portal/ui/collections-card";

interface Stats { pending: number; completedToday: number; totalToday: number; revenueToday: string; unbilled: number; collections: CollectionMode[]; }
interface Test {
  id: string; testName: string; status: string; price: string | null; createdAt: string;
  patient: { id: string; displayId: string; fullName: string; phone: string } | null;
  appointment: { opNumber: string; doctorName: string; visitDate: string } | null;
  billed: boolean;
}

const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

export default function LabsDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([
      api.get<{ stats: Stats }>("/labs/stats"),
      api.get<{ tests: Test[] }>("/labs/tests?status=PENDING"),
    ]).then(([s, t]) => { if (active) { setStats(s.stats); setTests(t.tests.slice(0, 8)); } })
      .catch(() => {}).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return (
    <PortalScroll>
      <div data-rise className="surface dotgrid mb-6 flex flex-wrap items-center justify-between gap-4 px-6 py-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--p-teal)]">Laboratory · {today}</p>
          <h1 className="mt-1 font-serif-p text-[24px] font-semibold text-[var(--p-ink)]">Lab overview</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/order" className="badge surface-hover"><Icon name="plus" size={12} /> Order tests</Link>
          <Link href="/queue" className="inline-flex items-center gap-2 rounded-full bg-[var(--p-teal)] px-4 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-[var(--p-teal-deep)]"><Icon name="flask" size={13} /> Test queue</Link>
        </div>
      </div>

      <div data-rise className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi icon="flask" label="Pending tests" value={stats?.pending ?? 0} sub="awaiting results" delay={0} />
        <Kpi icon="check" label="Completed today" value={stats?.completedToday ?? 0} sub={`of ${stats?.totalToday ?? 0} ordered`} delay={60} />
        <Kpi icon="rupee" label="Revenue today" value={Number(stats?.revenueToday ?? 0)} prefix="₹" sub="lab billing" delay={120} />
        <Kpi icon="receipt" label="Unbilled tests" value={stats?.unbilled ?? 0} sub="ready to bill" delay={180} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section data-rise className="surface overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--p-border)] px-6 py-4">
            <div>
              <h3 className="text-[14px] font-semibold text-[var(--p-ink)]">Pending tests</h3>
              <p className="mt-0.5 text-[12px] text-[var(--p-muted)]">Samples awaiting results.</p>
            </div>
            <Link href="/queue" className="text-[12px] font-medium text-[var(--p-teal)] hover:underline">View all →</Link>
          </div>
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-[var(--p-muted)]"><Spinner /> Loading…</div>
          ) : tests.length === 0 ? (
            <div className="dotgrid flex flex-col items-center py-16 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--p-border)] bg-white text-[var(--p-muted)]"><Icon name="flask" size={20} /></span>
              <p className="mt-3 text-[13px] text-[var(--p-muted)]">No pending tests. All caught up.</p>
              <Link href="/order" className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[var(--p-teal)] px-4 py-2 text-[12px] font-semibold text-white"><Icon name="plus" size={13} /> Order a test</Link>
            </div>
          ) : (
            <div className="divide-y divide-[var(--p-border)]">
              {tests.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-3 px-6 py-3.5 transition-colors hover:bg-[var(--p-bg)]">
                  <div>
                    <div className="text-[14px] font-medium text-[var(--p-ink)]">{t.testName}</div>
                    <div className="text-[12px] text-[var(--p-muted)]">
                      {t.patient?.fullName ?? "—"} · <span className="tabular">{t.patient?.displayId}</span>
                      {t.appointment && ` · ${t.appointment.doctorName}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {t.price && <span className="font-mono text-[12px] text-[var(--p-muted)]">₹{t.price}</span>}
                    <Pill tone={statusTone("Waiting")}>Pending</Pill>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section data-rise className="surface h-fit overflow-hidden">
          <div className="border-b border-[var(--p-border)] px-5 py-4"><h3 className="text-[13px] font-semibold text-[var(--p-ink)]">Quick actions</h3></div>
          <div className="divide-y divide-[var(--p-border)]">
            <Action href="/order" icon="plus" title="Order tests" sub="Walk-in or from a visit" />
            <Action href="/queue" icon="flask" title="Test queue" sub="Upload reports, complete tests" />
            <Action href="/billing" icon="rupee" title="Generate bill" sub="GST invoice for lab tests" />
            <Action href="/patients" icon="search" title="Patient history" sub="Last visit, tests, invoices" />
          </div>
        </section>

        <CollectionsCard modes={stats?.collections ?? []} accent="teal" subtitle="Collected at the lab today" />
      </div>
    </PortalScroll>
  );
}

function Action({ href, icon, title, sub }: { href: string; icon: "plus" | "flask" | "rupee" | "search"; title: string; sub: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-[var(--p-bg)]">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--p-teal-soft)] text-[var(--p-teal)]"><Icon name={icon} size={17} /></span>
      <div className="flex-1"><div className="text-[13px] font-medium text-[var(--p-ink)]">{title}</div><div className="text-[11px] text-[var(--p-muted)]">{sub}</div></div>
      <Icon name="chevron" size={15} />
    </Link>
  );
}
