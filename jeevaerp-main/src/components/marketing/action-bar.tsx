import Link from "next/link";
import { Reveal } from "@/components/ui/reveal";
import { HOSPITAL } from "@/lib/data";

/**
 * The four things visitors actually come to do — surfaced as one bar right
 * under the hero, the way the big hospital groups do it.
 */
const ACTIONS = [
  {
    href: "/doctors", title: "Find a doctor", sub: "By name or speciality",
    icon: <><circle cx="11" cy="8" r="4" /><path d="M3 21c0-3.5 3.6-6 8-6 1.1 0 2.2.15 3.1.44" /><circle cx="18" cy="17" r="3.2" /><path d="m20.4 19.4 1.8 1.8" /></>,
  },
  {
    href: "/book", title: "Book appointment", sub: "Pick a doctor and a time",
    icon: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4M16 3v4M3 10h18M9 15.5l2 2 4-4" /></>,
  },
  {
    href: "/#wards", title: "Rooms & prices", sub: "Published, no surprises",
    icon: <><path d="M3 18V8a2 2 0 0 1 2-2h6v8" /><path d="M11 10h7a3 3 0 0 1 3 3v5" /><path d="M3 18h18M3 21v-3M21 21v-3" /><circle cx="7" cy="10" r="1.6" /></>,
  },
] as const;

export function ActionBar() {
  return (
    <section className="px-3 pt-4 sm:px-5">
      <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ACTIONS.map((a, i) => (
          <Reveal key={a.title} delay={i * 60}>
            <Link href={a.href}
              className="card card-hover group flex h-full items-center gap-4 rounded-[20px] p-5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--sky-soft)] text-[var(--teal)] transition-colors group-hover:bg-[var(--ink)] group-hover:text-white">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{a.icon}</svg>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14.5px] font-semibold text-[var(--ink)]">{a.title}</span>
                <span className="block text-[12px] text-[var(--muted)]">{a.sub}</span>
              </span>
              <span aria-hidden className="text-[var(--muted)] transition-transform group-hover:translate-x-1">→</span>
            </Link>
          </Reveal>
        ))}

        {/* emergency — the one that is never a marketing tile */}
        <Reveal delay={180}>
          <a href={`tel:${HOSPITAL.emergency.replace(/\s/g, "")}`}
            className="card card-hover group flex h-full items-center gap-4 rounded-[20px] border border-[var(--alert)]/20 !bg-[var(--alert-soft)] p-5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-[var(--alert)]">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14.5px] font-semibold text-[var(--alert)]">Emergency · 24×7</span>
              <span className="block font-mono text-[12px] text-[var(--alert-deep)]">{HOSPITAL.emergency}</span>
            </span>
            <span aria-hidden className="text-[var(--alert)] transition-transform group-hover:translate-x-1">→</span>
          </a>
        </Reveal>
      </div>
    </section>
  );
}
