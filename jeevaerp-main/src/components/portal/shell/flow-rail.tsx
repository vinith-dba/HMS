"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon, type IconName } from "@/components/portal/ui/icons";

/**
 * THE FLOW RAIL
 *
 * The single hardest thing about handing an ERP to a front desk isn't the
 * buttons — it's that the software never says what happens NEXT. Staff learn the
 * order by being told once, forget it, and then avoid the parts they're unsure
 * of. (That's how you end up with a hospital that bought an ERP and still keeps
 * a paper register.)
 *
 * So the flow is drawn, in order, on the screen they stare at all day. Each step
 * links to the page that does it, carries a live count where one exists, and says
 * in one plain line what the receptionist is supposed to do there.
 *
 * Collapsible: a new hire keeps it open for a fortnight, then folds it away. The
 * software teaches itself out of a job.
 */

export interface FlowCounts {
  expected: number;   // BOOKED — not here yet
  waiting: number;    // CHECKED_IN — sitting outside the doctor's room
  completed: number;  // doctor's done with them
  unpaid: number;     // bills with a balance
}

interface Step {
  n: number;
  label: string;
  what: string;
  href: string;
  icon: IconName;
  count?: number;
  countLabel?: string;
  tone?: "live" | "warn";
}

export function FlowRail({ counts }: { counts: FlowCounts }) {
  const [open, setOpen] = useState(true);

  const steps: Step[] = [
    { n: 1, label: "Register", what: "New face? Give them a UHID.", href: "/register", icon: "users" },
    { n: 2, label: "Book", what: "Pick a doctor & slot. Take the fee.", href: "/book", icon: "calendar",
      count: counts.expected, countLabel: "expected", tone: "live" },
    { n: 3, label: "Check in", what: "They've arrived. Tap it on Today.", href: "/", icon: "check",
      count: counts.waiting, countLabel: "waiting", tone: "live" },
    { n: 4, label: "Doctor", what: "They go up. You do nothing.", href: "/", icon: "activity",
      count: counts.completed, countLabel: "seen" },
    { n: 5, label: "Rx & tests", what: "Scan the chit. Order the tests.", href: "/prescriptions", icon: "file" },
    { n: 6, label: "Bill", what: "Settle anything still owed.", href: "/billing", icon: "receipt",
      count: counts.unpaid, countLabel: "unpaid", tone: counts.unpaid > 0 ? "warn" : undefined },
  ];

  return (
    <section data-rise className="surface mb-5 overflow-hidden">
      <button onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-3 text-left transition-colors hover:bg-[var(--p-bg)]">
        <span className="flex items-center gap-2.5">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-[var(--p-blue-soft)] text-[var(--p-blue)]">
            <Icon name="activity" size={13} />
          </span>
          <span className="text-[13px] font-semibold text-[var(--p-ink)]">How a patient moves through the day</span>
          <span className="hidden text-[12px] text-[var(--p-muted)] sm:inline">
            — every step is a page. Tap one to go there.
          </span>
        </span>
        {/* the icon set's chevron points RIGHT — 90deg makes it point down when open */}
        <span className={`text-[12px] font-medium text-[var(--p-muted)] transition-transform duration-200 ${open ? "rotate-90" : ""}`}>
          <Icon name="chevron" size={14} />
        </span>
      </button>

      {open && (
        <div className="border-t border-[var(--p-border)] p-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {steps.map((s, i) => (
              <Link key={s.n} href={s.href} className="flow-step group" style={{ animationDelay: `${i * 45}ms` }}>
                <span className="flow-step__n">{s.n}</span>

                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex items-center gap-1.5">
                    <Icon name={s.icon} size={13} />
                    <span className="text-[13.5px] font-semibold text-[var(--p-ink)]">{s.label}</span>
                  </span>
                  <span className="mt-0.5 text-[11.5px] leading-snug text-[var(--p-muted)]">{s.what}</span>

                  {s.count !== undefined && s.count > 0 && (
                    <span className={`mt-1.5 inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      s.tone === "warn"
                        ? "bg-[var(--p-rose-soft)] text-[var(--p-rose)]"
                        : s.tone === "live"
                          ? "bg-[var(--p-blue-soft)] text-[var(--p-blue)]"
                          : "bg-[var(--p-bg)] text-[var(--p-muted)]"
                    }`}>
                      <span className="font-mono">{s.count}</span> {s.countLabel}
                    </span>
                  )}
                </span>

                {/* the arrow that says "and then…" — hidden on the last one */}
                {i < steps.length - 1 && <span className="flow-step__arrow" aria-hidden>→</span>}
              </Link>
            ))}
          </div>

          <p className="mt-3 px-1 text-[11.5px] leading-relaxed text-[var(--p-muted)]">
            Stuck? Press <kbd className="rounded border border-[var(--p-border)] bg-[var(--p-bg)] px-1 py-0.5 font-mono text-[10px] font-semibold">⌘K</kbd> anywhere,
            type the patient&apos;s name, and the software will offer you every action you can take for them.
          </p>
        </div>
      )}

    </section>
  );
}

