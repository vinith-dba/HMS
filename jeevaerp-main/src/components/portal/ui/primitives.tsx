"use client";

import { useCountUp } from "@/lib/portal/use-count-up";
import { Icon, type IconName } from "./icons";

/** Bordered surface card — the base of the whole dashboard aesthetic. */
export function Card({
  children, className = "", enter, style,
}: { children: React.ReactNode; className?: string; enter?: number; style?: React.CSSProperties }) {
  return (
    <div
      {...(enter !== undefined ? { "data-enter": true } : {})}
      style={{ ...(enter !== undefined ? { animationDelay: `${enter}ms` } : {}), ...style }}
      className={`surface ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * KPI tile. The number counts up on first paint, and the icon sits in a tinted
 * chip — teal, because these are health/volume signals rather than actions.
 */
export function Kpi({
  icon, label, value, prefix = "", suffix = "", sub, decimals = 0, delay = 0,
}: {
  icon: IconName; label: string; value: number; prefix?: string; suffix?: string;
  sub?: string; decimals?: number; delay?: number;
}) {
  const { ref, display } = useCountUp(value);
  const shown = prefix + display.toLocaleString("en-IN", {
    minimumFractionDigits: decimals, maximumFractionDigits: decimals,
  }) + suffix;
  return (
    <div
      data-enter
      style={{ animationDelay: `${delay}ms` }}
      className="surface surface-hover group relative overflow-hidden p-5"
    >
      {/* corner bloom — picks up on hover */}
      <span className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[var(--p-cyan-soft)] opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100" />

      <div className="flex items-center gap-2.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--p-cyan-soft)] text-[var(--p-cyan-deep)]">
          <Icon name={icon} size={14} />
        </span>
        <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--p-muted)]">{label}</span>
      </div>

      <div className="stat mt-3 font-serif-p text-[28px] font-semibold text-[var(--p-ink)]">
        <span ref={ref}>{shown}</span>
      </div>
      {sub && <div className="mt-1 text-[13px] text-[var(--p-muted)]">{sub}</div>}
    </div>
  );
}

type Tone = "paid" | "pending" | "completed" | "checkedin" | "waiting" | "low" | "cancelled" | "neutral";

const toneMap: Record<Tone, string> = {
  paid: "bg-[var(--p-cyan-soft)] text-[var(--p-cyan-deep)] ring-1 ring-inset ring-[var(--p-cyan)]/20",
  completed: "bg-[var(--p-cyan-soft)] text-[var(--p-cyan-deep)] ring-1 ring-inset ring-[var(--p-cyan)]/20",
  checkedin: "bg-[var(--p-blue-soft)] text-[var(--p-blue-deep)] ring-1 ring-inset ring-[var(--p-blue)]/20",
  pending: "bg-[var(--p-amber-soft)] text-[#8a6414] ring-1 ring-inset ring-[var(--p-amber)]/25",
  waiting: "bg-[var(--p-amber-soft)] text-[#8a6414] ring-1 ring-inset ring-[var(--p-amber)]/25",
  low: "bg-[var(--p-rose-soft)] text-[var(--p-rose)] ring-1 ring-inset ring-[var(--p-rose)]/20",
  cancelled: "bg-[var(--p-rose-soft)] text-[var(--p-rose)] ring-1 ring-inset ring-[var(--p-rose)]/20",
  neutral: "bg-[var(--p-blue-soft)] text-[var(--p-blue-deep)] ring-1 ring-inset ring-[var(--p-blue)]/15",
};

export function Pill({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-semibold ${toneMap[tone]}`}>
      {children}
    </span>
  );
}

export function statusTone(status: string): Tone {
  const m: Record<string, Tone> = {
    Paid: "paid", Pending: "pending", Completed: "completed",
    "Checked-in": "checkedin", Waiting: "waiting", Admitted: "checkedin",
    Discharged: "completed", Cancelled: "cancelled", "Low stock": "low",
    Active: "completed", Disabled: "cancelled",
  };
  return m[status] ?? "neutral";
}

export function SectionTitle({ title, hint, right }: { title: string; hint?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h3 className="text-[14px] font-semibold text-[var(--p-ink)]">{title}</h3>
        {hint && <p className="mt-1 max-w-lg text-[13px] leading-relaxed text-[var(--p-muted)]">{hint}</p>}
      </div>
      {right}
    </div>
  );
}

/** Primary action. Electric blue with a top sheen and a soft glow on hover. */
export function PrimaryButton({
  children, onClick, disabled, type = "button", full,
}: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; type?: "button" | "submit"; full?: boolean }) {
  return (
    <button
      type={type} onClick={onClick} disabled={disabled}
      className={`btn-primary inline-flex items-center justify-center gap-2 rounded-lg px-3  py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none ${full ? "w-full" : ""}`}
    >
      {children}
    </button>
  );
}
