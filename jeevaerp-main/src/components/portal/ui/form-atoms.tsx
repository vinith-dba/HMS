"use client";

import { Icon, type IconName } from "./icons";

/** Small inline spinner for button loading states. */
export function Spinner({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="animate-spin" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** Labelled input with a leading icon and optional error/hint line. */
export function Field({
  label, icon, error, children, span,
}: {
  label: string; icon?: IconName; error?: string; children: React.ReactNode; span?: boolean;
}) {
  return (
    <div className={span ? "sm:col-span-2" : ""}>
      <label className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-[var(--p-muted)]">
        {icon && <span className="text-[var(--p-teal)]"><Icon name={icon} size={13} /></span>}
        {label}
      </label>
      {children}
      {error && (
        <p className="mt-1.5 flex items-center gap-1 text-[12px] text-[var(--p-rose)]">
          <Icon name="alert" size={11} /> {error}
        </p>
      )}
    </div>
  );
}

/** Animated success check that draws itself in. */
export function SuccessCheck({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 52 52" aria-hidden>
      <circle
        cx="26" cy="26" r="24" fill="none" stroke="var(--p-teal)" strokeWidth="3"
        strokeDasharray="151" strokeDashoffset="151"
        style={{ animation: "drawLine 0.5s ease forwards" }}
      />
      <path
        d="M15 27l7 7 15-15" fill="none" stroke="var(--p-teal)" strokeWidth="3.5"
        strokeLinecap="round" strokeLinejoin="round"
        strokeDasharray="40" strokeDashoffset="40"
        style={{ animation: "drawLine 0.4s ease 0.4s forwards" }}
      />
    </svg>
  );
}
