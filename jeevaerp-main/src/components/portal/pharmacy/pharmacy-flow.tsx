"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon, type IconName } from "@/components/portal/ui/icons";

/**
 * The pharmacist's day, drawn.
 *
 * Reception's rail follows a PATIENT through the building. The pharmacy's follows
 * a PRESCRIPTION across the counter — different job, different verbs. Where the
 * receptionist asks "who's next?", the pharmacist asks "do we have it, is it
 * still good, and can they afford it?"
 *
 * The last two steps are the ones people get wrong, so they're spelled out:
 * an admitted patient does NOT pay at the counter, and a short-supplied
 * antibiotic is a clinical decision, not a discount.
 */

export interface PharmacyCounts {
  waiting: number;    // prescriptions sent up by reception, not yet dispensed
  low: number;        // below reorder level
  expiring: number;   // dies within 60 days
  expired: number;    // already dead, still on the shelf
}

interface Step {
  n: number;
  label: string;
  what: string;
  href: string;
  icon: IconName;
  count?: number;
  countLabel?: string;
  tone?: "live" | "warn" | "danger";
}

export function PharmacyFlow({ counts }: { counts: PharmacyCounts }) {
  const [open, setOpen] = useState(true);

  const steps: Step[] = [
    { n: 1, label: "Chit arrives", what: "Reception sends the doctor's Rx up.", href: "/queue", icon: "file",
      count: counts.waiting, countLabel: "waiting", tone: "live" },
    { n: 2, label: "Check the shelf", what: "In stock? Which rack? Still in date?", href: "/stock", icon: "grid",
      count: counts.low, countLabel: "low", tone: counts.low > 0 ? "warn" : undefined },
    { n: 3, label: "Scratchpad", what: "Fewer days, or fit it to their budget.", href: "/queue", icon: "activity" },
    { n: 4, label: "Dispense", what: "Oldest batch leaves first (FEFO).", href: "/dispense", icon: "pill" },
    { n: 5, label: "Money", what: "Admitted? Charge the room, take nothing.", href: "/queue", icon: "receipt" },
    { n: 6, label: "Pull the dead", what: "Expired stock off the rack, today.", href: "/alerts", icon: "alert",
      count: counts.expired, countLabel: "expired", tone: counts.expired > 0 ? "danger" : undefined },
  ];

  return (
    <section data-rise className="surface mb-5 overflow-hidden">
      <button onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-3 text-left transition-colors hover:bg-[var(--p-blue-soft)]">
        <span className="flex items-center gap-2.5">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-[var(--p-blue-soft)] text-[var(--p-blue)]">
            <Icon name="pill" size={13} />
          </span>
          <span className="text-[13px] font-semibold text-[var(--p-ink)]">How a prescription crosses the counter</span>
          <span className="hidden text-[12px] text-[var(--p-muted)] sm:inline">— every step is a page. Tap one.</span>
        </span>
        <span className={`text-[12px] text-[var(--p-muted)] transition-transform duration-200 ${open ? "rotate-90" : ""}`}>
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
                      s.tone === "danger" ? "bg-[var(--p-rose-soft)] text-[var(--p-rose)]"
                        : s.tone === "warn" ? "bg-[var(--p-amber-soft)] text-[var(--p-amber)]"
                        : "bg-[var(--p-blue-soft)] text-[var(--p-blue)]"
                    }`}>
                      <span className="font-mono">{s.count}</span> {s.countLabel}
                    </span>
                  )}
                </span>
                {i < steps.length - 1 && <span className="flow-step__arrow" aria-hidden>→</span>}
              </Link>
            ))}
          </div>

          {counts.expired > 0 && (
            <p className="mt-3 rounded-lg bg-[var(--p-rose-soft)] px-3 py-2 text-[12px] leading-relaxed text-[var(--p-rose)]">
              <b>{counts.expired} medicine{counts.expired === 1 ? "" : "s"} on the rack {counts.expired === 1 ? "is" : "are"} past expiry.</b>{" "}
              Expired stock sitting where someone can reach for it is the one thing on this
              board that can hurt a patient today. <Link href="/alerts" className="underline underline-offset-2">Pull it now →</Link>
            </p>
          )}

          <p className="mt-3 px-1 text-[11.5px] leading-relaxed text-[var(--p-muted)]">
            Press <kbd className="rounded border border-[var(--p-border)] bg-[var(--p-bg)] px-1 py-0.5 font-mono text-[10px] font-semibold">⌘K</kbd> anywhere
            and type a medicine name — it tells you the rack, what&apos;s left, and how long it&apos;s good for.
          </p>
        </div>
      )}
    </section>
  );
}
