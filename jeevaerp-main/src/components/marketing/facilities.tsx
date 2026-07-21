import { Reveal } from "@/components/ui/reveal";
import { WARDS } from "@/lib/data";

/**
 * Facilities & technology — what's physically in the building. Every line
 * here is backed by a department blurb, the ward table or the FAQ; nothing
 * is aspirational.
 */
const stroke = { fill: "none" as const, stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function totalBeds() {
  return WARDS.reduce((s, w) => s + w.beds, 0);
}

const FACILITIES = [
  {
    title: "In-house laboratory",
    text: "Routine blood work in about 30 minutes — reports land on your record and your phone, and stay there for every future visit.",
    icon: <g {...stroke}><path d="M9 3h6M10 3v6.3L4.8 18a2.4 2.4 0 0 0 2.1 3.6h10.2a2.4 2.4 0 0 0 2.1-3.6L14 9.3V3" /><path d="M7.5 15h9" /></g>,
  },
  {
    title: "Digital X-ray & imaging",
    text: "On-site X-ray for fractures and spine, imaging support for neurology — scans are read with your full history in view.",
    icon: <g {...stroke}><rect x="4" y="3" width="16" height="18" rx="2.5" /><path d="M12 6v12M8.5 9h7M9.5 12h5M10.5 15h3" /></g>,
  },
  {
    title: "ECG · 2D Echo · TMT",
    text: "Cardiac work-ups the same day — chest pain and rhythm complaints are assessed without a referral across town.",
    icon: <g {...stroke}><path d="M3 12h4l2-4 3.5 8 2.5-5 1.5 1h4.5" /></g>,
  },
  {
    title: "In-house pharmacy",
    text: "Batch-tracked stock with automatic expiry checks, dispensed against your Jeeva ID with a printed GST bill.",
    icon: <g {...stroke}><rect x="3" y="8" width="18" height="13" rx="2.5" /><path d="M8 8V6a4 4 0 0 1 8 0v2M12 11.5v5M9.5 14h5" /></g>,
  },
  {
    title: "24×7 emergency",
    text: "A doctor on duty around the clock, every day of the year — walk straight in, no booking, no front-desk queue.",
    icon: <g {...stroke}><path d="M12 3l8 4v5c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10V7l8-4Z" /><path d="M12 8.5v6M9 11.5h6" /></g>,
  },
  {
    title: `Inpatient wards · ${totalBeds()} beds`,
    text: "General, semi-private and private rooms plus a monitored ICU — with attendant arrangements and published day rates.",
    icon: <g {...stroke}><path d="M3 18V8a2 2 0 0 1 2-2h6v8h10a0 0 0 0 1 0 0v4" /><path d="M11 10h7a3 3 0 0 1 3 3" /><path d="M3 18h18M3 21v-3M21 21v-3" /><circle cx="7" cy="10" r="1.6" /></g>,
  },
];

export function Facilities() {
  return (
    <section id="facilities" className="px-3 py-16 sm:px-5 lg:py-24">
      <div className="mx-auto max-w-[1280px]">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <Reveal>
            <div>
              <p className="idx uppercase tracking-[0.16em]">Facilities &amp; technology</p>
              <h2 className="display mt-3 max-w-xl text-[clamp(1.9rem,3.6vw,2.6rem)] text-[var(--ink)]">
                Everything under one roof, on purpose
              </h2>
            </div>
          </Reveal>
          <Reveal delay={80}>
            <p className="max-w-sm text-[14px] leading-[1.75] text-[var(--muted)]">
              The point of a multispeciality building is that the test, the scan and
              the medicine are a corridor away — not another trip across town.
            </p>
          </Reveal>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FACILITIES.map((f, i) => (
            <Reveal key={f.title} delay={Math.min(i * 50, 300)}>
              <div className="card card-hover h-full rounded-[20px] p-6">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-[var(--sky-soft)] text-[var(--teal)]">
                  <svg width="21" height="21" viewBox="0 0 24 24" aria-hidden>{f.icon}</svg>
                </span>
                <h3 className="mt-5 text-[16px] font-semibold text-[var(--ink)]">{f.title}</h3>
                <p className="mt-2 text-[13px] leading-[1.7] text-[var(--ink-soft)]">{f.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
