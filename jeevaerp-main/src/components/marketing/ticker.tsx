import { DEPARTMENTS } from "@/lib/data";

/** A slow marquee of the departments — mono, quiet, pauses on hover. */
export function Ticker() {
  const row = [...DEPARTMENTS, ...DEPARTMENTS];
  return (
    <div className="ticker-wrap overflow-hidden py-7" aria-hidden>
      <div className="ticker items-center">
        {row.map((d, i) => (
          <span key={i} className="flex items-center font-mono text-[12px] uppercase tracking-[0.18em] text-[var(--muted)]">
            <span className="px-7">{d.name}</span>
            <span className="text-[var(--teal)]">+</span>
          </span>
        ))}
      </div>
    </div>
  );
}
