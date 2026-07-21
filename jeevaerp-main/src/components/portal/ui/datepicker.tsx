"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

function ChevronLeftIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}
function ChevronRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
function CalendarGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </svg>
  );
}

/* ---- local-time-safe date helpers (no UTC string-parsing drift) ---- */
const pad2 = (n: number): string => String(n).padStart(2, "0");
const toISO = (d: Date): string => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const parseISO = (s?: string | null): Date | null => {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const startOfDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const isSameDay = (a?: Date | null, b?: Date | null): boolean =>
  !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

function buildGrid(viewYear: number, viewMonth: number): Date[] {
  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const gridStart = new Date(viewYear, viewMonth, 1 - firstOfMonth.getDay());
  return Array.from({ length: 42 }, (_, i) =>
    new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i)
  );
}

export interface PortalDatePickerProps {
  /** ISO yyyy-mm-dd, same contract as input type="date" */
  value: string;
  /** Fires the plain ISO string directly (not an event) */
  onChange: (isoDate: string) => void;
  /** ISO yyyy-mm-dd — dates before this are disabled */
  min?: string;
  /** Which portal accent to key the selection state off. Defaults to teal. */
  accent?: "teal" | "blue";
  placeholder?: string;
  className?: string;
}

const ACCENT_VARS: Record<NonNullable<PortalDatePickerProps["accent"]>, { base: string; deep: string; soft: string }> = {
  teal: { base: "var(--p-teal)", deep: "var(--p-teal-deep)", soft: "var(--p-teal-soft)" },
  blue: { base: "var(--p-blue)", deep: "var(--p-blue-deep)", soft: "var(--p-blue-soft)" },
};

/** Drop-in replacement for <input type="date">. Same value/min contract;
 *  onChange fires the plain ISO string directly (not an event) — call
 *  sites using onChange={(e) => setX(e.target.value)} become onChange={setX}. */
export function PortalDatePicker({
  value,
  onChange,
  min,
  accent = "teal",
  placeholder = "Select date",
  className,
}: PortalDatePickerProps) {
  const selected = parseISO(value);
  const minDate = min ? startOfDay(parseISO(min)!) : null;
  const today = startOfDay(new Date());
  const base = selected || today;

  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(base.getFullYear());
  const [viewMonth, setViewMonth] = useState(base.getMonth());
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  function goMonth(delta: number) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setViewMonth(m);
    setViewYear(y);
  }

  function pick(d: Date) {
    if (minDate && d < minDate) return;
    onChange(toISO(d));
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setOpen(false);
  }

  const days = buildGrid(viewYear, viewMonth);
  const accentVars = ACCENT_VARS[accent];
  const rootStyle = {
    "--cal-accent": accentVars.base,
    "--cal-accent-deep": accentVars.deep,
    "--cal-accent-soft": accentVars.soft,
  } as CSSProperties;

  return (
    <div className={`cal-root${className ? ` ${className}` : ""}`} ref={rootRef} style={rootStyle}>
      <button
        type="button"
        className="cal-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span>
          {selected
            ? selected.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
            : placeholder}
        </span>
        <span className="cal-trigger-icon"><CalendarGlyph /></span>
      </button>

      {open && (
        <div className="cal-pop" role="dialog" aria-label="Choose date">
          <div className="cal-head">
            <button type="button" className="cal-nav" onClick={() => goMonth(-1)} aria-label="Previous month">
              <ChevronLeftIcon />
            </button>
            <div className="cal-title">{MONTHS[viewMonth]} {viewYear}</div>
            <button type="button" className="cal-nav" onClick={() => goMonth(1)} aria-label="Next month">
              <ChevronRightIcon />
            </button>
          </div>

          <div className="cal-weekdays">
            {WEEKDAYS.map((w) => (
              <div key={w} className="cal-weekday">{w}</div>
            ))}
          </div>

          <div className="cal-grid">
            {days.map((d) => {
              const inMonth = d.getMonth() === viewMonth;
              const isToday = isSameDay(d, today);
              const isSelected = !!selected && isSameDay(d, selected);
              const disabled = !!minDate && d < minDate;
              const cls = [
                "cal-day",
                !inMonth && "cal-day--muted",
                isToday && !isSelected && "cal-day--today",
                isSelected && "cal-day--selected",
                disabled && "cal-day--disabled",
              ].filter(Boolean).join(" ");
              return (
                <button
                  type="button"
                  key={toISO(d)}
                  className={cls}
                  disabled={disabled}
                  onClick={() => pick(d)}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>

          <div className="cal-foot">
            <button type="button" className="cal-today-btn" onClick={() => pick(today)}>
              Today
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .cal-root { position: relative; display: inline-block; width: 100%; max-width: 240px; }

        .cal-trigger {
          width: 100%;
          display: flex; align-items: center; justify-content: space-between; gap: 8px;
          padding: 9px 12px;
          border-radius: 8px;
          border: 1px solid var(--p-border);
          background: var(--p-bg);
          color: var(--p-text);
          font: inherit; font-size: 13.5px;
          cursor: pointer;
          transition: border-color .15s ease, box-shadow .15s ease;
        }
        .cal-trigger:hover { border-color: var(--cal-accent); }
        .cal-trigger:focus-visible,
        .cal-trigger[aria-expanded="true"] {
          outline: none;
          border-color: var(--cal-accent);
          box-shadow: 0 0 0 3px var(--cal-accent-soft);
        }
        .cal-trigger-icon { display: flex; color: var(--p-muted); flex: none; }

        .cal-pop {
          position: absolute; top: calc(100% + 8px); left: 0; z-index: 20;
          width: 272px; padding: 14px;
          border-radius: 12px;
          border: 1px solid var(--p-border);
          background: #fff;
          box-shadow: 0 1px 2px rgba(9,26,52,0.05), 0 18px 40px -20px rgba(9,26,52,0.18);
          animation: calIn .16s ease;
        }
        @keyframes calIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) { .cal-pop { animation: none; } }

        .cal-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
        .cal-title { font-weight: 600; font-size: 13.5px; color: var(--p-ink); letter-spacing: -0.01em; }
        .cal-nav {
          display: grid; place-items: center; width: 26px; height: 26px;
          border-radius: 6px; border: none; background: transparent; color: var(--p-muted);
          cursor: pointer; transition: background-color .15s ease, color .15s ease;
        }
        .cal-nav:hover { background: var(--cal-accent-soft); color: var(--cal-accent); }
        .cal-nav:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--cal-accent-soft); }

        .cal-weekdays { display: grid; grid-template-columns: repeat(7, 1fr); margin-bottom: 2px; }
        .cal-weekday {
          text-align: center; padding: 4px 0;
          font-family: ui-monospace, "SFMono-Regular", monospace;
          font-size: 10.5px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase;
          color: var(--p-muted);
        }

        .cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
        .cal-day {
          aspect-ratio: 1; display: grid; place-items: center;
          border: none; background: transparent; border-radius: 8px;
          font: inherit; font-size: 12.5px; font-variant-numeric: tabular-nums;
          color: var(--p-text); cursor: pointer;
          transition: background-color .15s ease, color .15s ease, box-shadow .15s ease;
        }
        .cal-day:hover:not(:disabled) { background: var(--cal-accent-soft); }
        .cal-day:focus-visible { outline: none; box-shadow: 0 0 0 2px #fff, 0 0 0 4px var(--cal-accent-soft), inset 0 0 0 1.5px var(--cal-accent); }
        .cal-day--muted { color: var(--p-muted); opacity: 0.45; }
        .cal-day--today { font-weight: 700; color: var(--cal-accent-deep); box-shadow: inset 0 0 0 1.5px var(--cal-accent); }
        .cal-day--selected {
          background: var(--cal-accent); color: #fff; font-weight: 600;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.15);
        }
        .cal-day--selected:hover:not(:disabled) { background: var(--cal-accent-deep); }
        .cal-day--disabled { color: var(--p-muted); opacity: 0.35; cursor: not-allowed; }
        .cal-day--disabled:hover { background: transparent; }

        .cal-foot { margin-top: 8px; padding-top: 10px; border-top: 1px solid var(--p-border); display: flex; justify-content: flex-end; }
        .cal-today-btn {
          font-size: 12px; font-weight: 500; color: var(--cal-accent);
          background: transparent; border: none; cursor: pointer;
          padding: 4px 8px; border-radius: 6px; transition: background-color .15s ease;
        }
        .cal-today-btn:hover { background: var(--cal-accent-soft); }
        .cal-today-btn:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--cal-accent-soft); }
      `}</style>
    </div>
  );
}

export default PortalDatePicker;