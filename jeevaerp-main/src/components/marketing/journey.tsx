import Link from "next/link";
import { Reveal } from "@/components/ui/reveal";
import { Scoop } from "@/components/ui/scoop";
import { JOURNEY } from "@/lib/data";

/** A visit, in order — one wide rounded panel, the CTA docked in its corner. */
export function Journey() {
  return (
    <section className="px-3 py-8 sm:px-5">
      <div className="mx-auto max-w-[1280px]">
        <div className="px-2 sm:px-4">
          <Reveal><p className="sec-index">04 · Your first visit</p></Reveal>
          <Reveal delay={60}>
            <h2 className="display mt-8 max-w-xl text-[clamp(2.2rem,4.6vw,3.4rem)] text-[var(--ink)]">
              Four steps, start to finish.
            </h2>
          </Reveal>
        </div>

        <Reveal delay={120} className="mt-12">
          <div className="card relative rounded-[var(--r-xl)] px-8 py-10 pb-16 lg:px-12 lg:py-14 lg:pb-20">
            <ol className="grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
              {JOURNEY.map((j) => (
                <li key={j.step} className="border-t border-[var(--line)] pt-6 first:border-t-0 first:pt-0 sm:border-t-0 sm:pt-0 lg:border-l lg:border-[var(--line)] lg:pl-10 lg:first:border-l-0 lg:first:pl-0">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--teal-soft)] font-mono text-[12px] text-[var(--teal)]">
                    {j.step}
                  </span>
                  <h3 className="display mt-5 text-[19px] text-[var(--ink)]">{j.title}</h3>
                  <p className="mt-2.5 text-[13.5px] leading-[1.7] text-[var(--ink-soft)]">{j.text}</p>
                </li>
              ))}
            </ol>

            <Scoop corner="br" r={20} inner={24}>
              <Link href="/book" className="btn btn-solid">
                Start with step 01 <span aria-hidden>→</span>
              </Link>
            </Scoop>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
