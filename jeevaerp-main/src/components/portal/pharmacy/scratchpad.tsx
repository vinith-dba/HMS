"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/portal/ui/icons";
import { perDayFromDosage, billTotal, shortedCourseCritical, type PadLine } from "@/lib/pharmacy/course-math";

// re-exported so the pages that already import from here keep working
export { perDayFromDosage, billTotal, type PadLine };

/**
 * THE SCRATCHPAD
 *
 * Real counter behaviour, not a nice-to-have:
 *   - "Doctor wrote 5 days, I only want 3."
 *   - "The bill says ₹5,000. I have ₹3,000. Give me what fits."
 *
 * Both are the same operation — shorten the course — so the pad does one thing
 * two ways: set the days directly, or name a budget and let it find the days.
 *
 * It never silently changes a bill. Every number the pharmacist sees here is the
 * number the patient will pay, computed with the same subtotal − discount + GST
 * formula the invoice uses.
 *
 * ANTIBIOTICS ARE DIFFERENT. Cutting a paracetamol course short leaves someone
 * with a headache. Cutting an antibiotic course short breeds resistant bacteria —
 * it is worse than not starting. So a short-supplied `courseCritical` medicine
 * raises a blocking warning that has to be acknowledged, and the reason lands on
 * the invoice. The pad makes the trade-off visible instead of easy.
 */

const money = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 });

export function DispenseScratchpad({
  lines, discount, onChange, onReasonChange, reason,
}: {
  lines: PadLine[];
  discount: number;
  onChange: (next: PadLine[]) => void;
  reason: string;
  onReasonChange: (r: string) => void;
}) {
  const [budget, setBudget] = useState("");
  const [note, setNote] = useState<string | null>(null);

  const scalable = lines.filter((l) => l.perDay > 0);

  /** The course the doctor wrote, in days. */
  const prescribedDays = useMemo(() => {
    const d = scalable
      .filter((l) => l.prescribedQty > 0)
      .map((l) => Math.round(l.prescribedQty / l.perDay))
      .filter((n) => n > 0);
    return d.length ? Math.max(...d) : 0;
  }, [scalable]);

  /** What we're actually about to hand over, in days. */
  const givingDays = useMemo(() => {
    const d = scalable.map((l) => Math.round(l.qty / l.perDay)).filter((n) => n > 0);
    return d.length ? Math.max(...d) : 0;
  }, [scalable]);

  const asPrescribed = useMemo(
    () => billTotal(lines.map((l) => ({ ...l, qty: l.prescribedQty || l.qty })), 0),
    [lines]
  );
  const giving = useMemo(() => billTotal(lines, discount), [lines, discount]);

  /** Anything course-critical being cut short — the one case that isn't just money. */
  const shorted = lines.filter((l) => l.prescribedQty > 0 && l.qty < l.prescribedQty);
  const abxShorted = shortedCourseCritical(lines);
  const isShort = shorted.length > 0;

  function setDays(days: number) {
    if (days < 1) return;
    onChange(lines.map((l) => {
      if (l.perDay <= 0) return l;                       // ointments, inhalers — days mean nothing
      const want = Math.ceil(l.perDay * days);
      return { ...l, qty: Math.max(1, Math.min(want, l.inStock)) };
    }));
    setNote(null);
  }

  /**
   * Work backwards from money: what's the longest course that fits?
   * Walks days down from the prescription rather than shaving random quantities —
   * 3 days of everything is a real (if short) course; 5 days of one drug and none
   * of another is just a mess.
   */
  function fitBudget() {
    const target = Number(budget);
    if (!target || target <= 0) return;

    // No dosage patterns at all (walk-in counter): there are no "days" to shorten,
    // so scale the quantities down proportionally instead. Same idea — everyone
    // gets less of everything — just without a course to reason about.
    if (scalable.length === 0) {
      for (let f = 100; f >= 1; f--) {
        const trial = lines.map((l) => ({ ...l, qty: Math.max(1, Math.floor((l.qty * f) / 100)) }));
        if (billTotal(trial, discount) <= target) {
          onChange(trial);
          setNote(f >= 100
            ? `Already within ₹${money(target)}.`
            : `Trimmed to ₹${money(billTotal(trial, discount))}. Adjust any line by hand from here.`);
          return;
        }
      }
      setNote(`Even one of each comes to more than ₹${money(target)}. Something has to come off the list.`);
      return;
    }

    const ceiling = prescribedDays || givingDays || 30;
    for (let d = ceiling; d >= 1; d--) {
      const trial = lines.map((l) => {
        if (l.perDay <= 0) return l;
        const want = Math.ceil(l.perDay * d);
        return { ...l, qty: Math.max(1, Math.min(want, l.inStock)) };
      });
      if (billTotal(trial, discount) <= target) {
        onChange(trial);
        setNote(
          d >= ceiling
            ? `The full ${ceiling}-day course already fits ₹${money(target)}.`
            : `${d} day${d === 1 ? "" : "s"} fits — ₹${money(billTotal(trial, discount))}. The full ${ceiling} days would be ₹${money(asPrescribed)}.`
        );
        return;
      }
    }
    // Even one day is over budget — say so plainly instead of silently doing nothing.
    setNote(`Even a single day comes to more than ₹${money(target)}. Remove a medicine, or the patient needs to spend more.`);
  }

  return (
    <div className="rounded-xl border border-[var(--p-border)] bg-[var(--p-bg)] p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon name="activity" size={14} />
        <h4 className="text-[12px] font-bold uppercase tracking-wide text-[var(--p-ink)]">Scratchpad</h4>
        <span className="text-[11px] text-[var(--p-muted)]">shorten the course, or work backwards from money</span>
      </div>

      {/* DAYS */}
      {scalable.length > 0 && (
        <div className="mb-3 rounded-lg border border-[var(--p-border)] bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[12px] font-semibold text-[var(--p-ink)]">Days of medicine</p>
              <p className="text-[11px] text-[var(--p-muted)]">
                {prescribedDays > 0
                  ? <>Doctor wrote <b className="text-[var(--p-ink)]">{prescribedDays} days</b>. Giving <b className="text-[var(--p-ink)]">{givingDays || "—"}</b>.</>
                  : <>Set a course length — quantities follow the dosage pattern.</>}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setDays(givingDays - 1)} disabled={givingDays <= 1}
                className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--p-border)] text-[16px] font-bold text-[var(--p-ink)] hover:border-[var(--p-blue)] disabled:opacity-30">−</button>
              <span className="w-10 text-center font-mono text-[16px] font-bold text-[var(--p-ink)]">{givingDays || 0}</span>
              <button onClick={() => setDays(givingDays + 1)}
                className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--p-border)] text-[16px] font-bold text-[var(--p-ink)] hover:border-[var(--p-blue)]">+</button>
              {prescribedDays > 0 && givingDays !== prescribedDays && (
                <button onClick={() => setDays(prescribedDays)}
                  className="ml-1 rounded-lg border border-[var(--p-border)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--p-blue)] hover:border-[var(--p-blue)]">
                  Full {prescribedDays}d
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* BUDGET */}
      <div className="mb-3 rounded-lg border border-[var(--p-border)] bg-white p-3">
        <p className="text-[12px] font-semibold text-[var(--p-ink)]">&ldquo;I only have this much&rdquo;</p>
        <p className="mb-2 text-[11px] text-[var(--p-muted)]">Name the amount — it finds the longest course that fits.</p>
        <div className="flex gap-2">
          <div className="flex flex-1 items-center gap-1.5 rounded-lg border border-[var(--p-border)] px-3 py-2">
            <span className="text-[13px] font-semibold text-[var(--p-muted)]">₹</span>
            <input value={budget} inputMode="decimal" placeholder="3000"
              onChange={(e) => setBudget(e.target.value.replace(/[^\d.]/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && fitBudget()}
              className="w-full bg-transparent font-mono text-[14px] outline-none" />
          </div>
          <button onClick={fitBudget} disabled={!budget}
            className="rounded-lg bg-[var(--p-blue)] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-40">
            Fit
          </button>
        </div>
        {note && <p className="mt-2 rounded-lg bg-[var(--p-blue-soft)] px-2.5 py-1.5 text-[11px] leading-relaxed text-[var(--p-blue-deep)]">{note}</p>}
      </div>

      {/* MONEY */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg border border-[var(--p-border)] bg-white px-2 py-2">
          <div className="text-[9px] font-semibold uppercase tracking-wide text-[var(--p-muted)]">As prescribed</div>
          <div className="font-mono text-[13px] font-semibold text-[var(--p-muted)]">₹{money(asPrescribed)}</div>
        </div>
        <div className="rounded-lg border border-[var(--p-blue)]/30 bg-[var(--p-blue-soft)] px-2 py-2">
          <div className="text-[9px] font-semibold uppercase tracking-wide text-[var(--p-blue-deep)]">Patient pays</div>
          <div className="font-mono text-[13px] font-bold text-[var(--p-blue-deep)]">₹{money(giving)}</div>
        </div>
        <div className="rounded-lg border border-[var(--p-border)] bg-white px-2 py-2">
          <div className="text-[9px] font-semibold uppercase tracking-wide text-[var(--p-muted)]">Difference</div>
          <div className="font-mono text-[13px] font-semibold text-[var(--p-ink)]">₹{money(Math.max(0, asPrescribed - giving))}</div>
        </div>
      </div>

      {/* THE ONE THAT ISN'T ABOUT MONEY */}
      {abxShorted.length > 0 && (
        <div className="mt-3 rounded-lg border-2 border-[var(--p-rose)] bg-[var(--p-rose-soft)] p-3">
          <p className="flex items-center gap-1.5 text-[12px] font-bold text-[var(--p-rose)]">
            <Icon name="alert" size={14} /> Stop — this is an antibiotic
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-[var(--p-rose)]">
            {abxShorted.map((l) => l.name).join(", ")} {abxShorted.length === 1 ? "is" : "are"} being cut short.
            <b> A half-finished antibiotic course is worse than none</b> — the infection survives and comes back resistant.
            Give the full course, or talk to the doctor about a cheaper one. Don&apos;t just give fewer days.
          </p>
          <p className="mt-1.5 text-[11px] text-[var(--p-rose)]">
            The other medicines can safely be trimmed instead — try the days control above with the antibiotic left at full.
          </p>
        </div>
      )}

      {/* WHY — goes on the bill */}
      {isShort && (
        <div className="mt-3">
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--p-muted)]">
            Why is the patient taking less? <span className="text-[var(--p-rose)]">*</span>
          </label>
          <input value={reason} onChange={(e) => onReasonChange(e.target.value)}
            placeholder="Couldn't afford the full course / already has some at home…"
            className="w-full rounded-lg border border-[var(--p-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--p-blue)]" />
          <p className="mt-1 text-[11px] text-[var(--p-muted)]">
            Printed on the bill, so the doctor can see the patient didn&apos;t get the full course.
          </p>
        </div>
      )}
    </div>
  );
}
