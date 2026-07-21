import Link from "next/link";
import { Reveal } from "@/components/ui/reveal";
import { DeptIcon } from "@/components/marketing/dept-icon";
import { DEPARTMENTS } from "@/lib/data";

/** Departments — a photo + blurb column beside the hairline services list. */
export function Departments() {
  return (
    <section id="departments" className="px-3 py-16 sm:px-5 lg:py-24">
      <div className="mx-auto grid max-w-[1280px] grid-cols-1 items-start gap-10 lg:grid-cols-[1fr_1.3fr] lg:gap-16">
        {/* left — the promise */}
        <div className="lg:sticky lg:top-28">
          <Reveal>
            <div className="relative overflow-hidden rounded-[20px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/hospital_banner.jpeg" alt="Inside Jeeva Multispeciality Hospital"
                loading="lazy" className="aspect-[16/10] w-full object-cover" />
            </div>
          </Reveal>
          <Reveal delay={80}>
            <div className="mt-6 flex items-start gap-5">
              <span className="idx mt-1 shrink-0">(002)</span>
              <p className="max-w-sm text-[14px] leading-[1.75] text-[var(--ink-soft)]">
                We cover most of a family&apos;s healthcare needs, so you don&apos;t have
                to run all over town to get things done. Here&apos;s what we&apos;re
                great at — each with its own specialists and equipment in-house.
              </p>
            </div>
          </Reveal>
          <Reveal delay={140}>
            <Link href="/doctors" className="btn btn-solid mt-6 !px-6 !py-3 !text-[13px]">Explore our doctors</Link>
          </Reveal>
        </div>

        {/* right — the list */}
        <div>
          {DEPARTMENTS.map((d, i) => (
            <Reveal key={d.name} delay={Math.min(i * 40, 280)}>
              <Link href={`/book?dept=${encodeURIComponent(d.name)}`}
                className="group flex items-center gap-5 border-b border-[var(--line)] py-5 first:border-t">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--sky-soft)] text-[var(--teal)] transition-colors group-hover:bg-[var(--ink)] group-hover:text-white">
                  <DeptIcon name={d.name} className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[17px] font-semibold text-[var(--ink)] transition-colors group-hover:text-[var(--teal-deep)]">
                    {d.name}
                  </span>
                  <span className="mt-0.5 block truncate text-[12.5px] text-[var(--muted)]">{d.blurb}</span>
                </span>
                <span className="hidden shrink-0 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--muted)] md:block">{d.common}</span>
                <span aria-hidden className="shrink-0 text-[15px] text-[var(--muted)] transition-all group-hover:translate-x-1 group-hover:text-[var(--ink)]">→</span>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
