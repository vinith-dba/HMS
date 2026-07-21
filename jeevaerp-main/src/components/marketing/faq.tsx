import { Reveal } from "@/components/ui/reveal";
import { FAQ } from "@/lib/data";

/** Plain answers, each question its own rounded card. Native accordions. */
export function Faq() {
  return (
    <section id="faq" className="px-3 py-16 sm:px-5 lg:py-24">
      <div className="mx-auto grid max-w-[1280px] gap-x-16 gap-y-10 px-2 sm:px-4 lg:grid-cols-[4fr_8fr]">
        <div>
          <Reveal><p className="sec-index">07 · Questions</p></Reveal>
          <Reveal delay={60}>
            <h2 className="display mt-8 text-[clamp(2.2rem,4vw,3rem)] text-[var(--ink)]">
              Before you come.
            </h2>
          </Reveal>
          <Reveal delay={120}>
            <p className="mt-4 max-w-xs text-[14px] leading-[1.7] text-[var(--muted)]">
              Can&apos;t find your answer? Call us — a person picks up.
            </p>
          </Reveal>
        </div>

        <Reveal delay={100}>
          <div>
            {FAQ.map((f) => (
              <details key={f.q} className="faq group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5">
                  <h3 className="text-[15.5px] font-semibold text-[var(--ink)]">{f.q}</h3>
                  <span className="faq-chev" aria-hidden><span className="text-[14px] leading-none">+</span></span>
                </summary>
                <div className="faq-body pb-6 pr-12">
                  <p className="text-[14px] leading-[1.8] text-[var(--ink-soft)]">{f.a}</p>
                </div>
              </details>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
