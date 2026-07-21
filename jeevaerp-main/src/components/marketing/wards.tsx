import { Reveal } from "@/components/ui/reveal";
import { WARDS } from "@/lib/data";

/** Rooms and prices, published. ICU carries the dark card — it's the serious one. */
export function Wards() {
  return (
    <section id="wards" className="px-3 py-16 sm:px-5 lg:py-24">
      <div className="mx-auto max-w-[1280px] px-2 sm:px-4">
        <Reveal><p className="sec-index">05 · Rooms &amp; prices</p></Reveal>
        <div className="mt-8 flex flex-wrap items-end justify-between gap-6">
          <Reveal delay={60}>
            <h2 className="display max-w-xl text-[clamp(2.2rem,4.6vw,3.4rem)] text-[var(--ink)]">
              No surprises at the bill.
            </h2>
          </Reveal>
          <Reveal delay={120}>
            <p className="max-w-sm text-[14px] leading-[1.7] text-[var(--muted)]">
              These are the rates our billing system charges — locked when you&apos;re admitted,
              so this page and your bill can&apos;t disagree.
            </p>
          </Reveal>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {WARDS.map((w, i) => {
            const dark = w.name === "ICU";
            return (
              <Reveal key={w.name} delay={Math.min(i * 60, 240)}>
                <div className={`card card-hover flex h-full flex-col rounded-[var(--r-lg)] p-7 ${dark ? "!bg-[var(--pine-ink)] text-white" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    <h3 className={`display text-[19px] ${dark ? "text-white" : "text-[var(--ink)]"}`}>{w.name}</h3>
                    <span className={`chip !px-2.5 !py-1 !text-[10px] ${dark ? "!border-white/25 !text-white/80" : ""}`}>{w.floor}</span>
                  </div>
                  <p className={`mt-5 font-mono text-[26px] font-semibold tabular ${dark ? "text-white" : "text-[var(--ink)]"}`}>
                    ₹{w.price.toLocaleString("en-IN")}
                    <span className={`text-[13px] font-normal ${dark ? "text-white/60" : "text-[var(--muted)]"}`}> /day</span>
                  </p>
                  <p className={`font-mono text-[11px] ${dark ? "text-white/60" : "text-[var(--muted)]"}`}>
                    {w.gst > 0 ? `+ ${w.gst}% GST` : "no GST"} · {w.beds} beds
                  </p>
                  <p className={`mt-3 text-[13px] leading-[1.65] ${dark ? "text-white/75" : "text-[var(--ink-soft)]"}`}>{w.note}</p>
                  <ul className={`mt-5 space-y-1.5 border-t pt-5 ${dark ? "border-white/15" : "border-[var(--line)]"}`}>
                    {w.includes.map((inc) => (
                      <li key={inc} className={`flex gap-2 text-[13px] ${dark ? "text-white/75" : "text-[var(--ink-soft)]"}`}>
                        <span className={dark ? "text-[var(--teal-lift)]" : "text-[var(--teal)]"} aria-hidden>+</span> {inc}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
