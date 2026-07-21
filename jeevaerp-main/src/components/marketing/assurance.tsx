import { Reveal } from "@/components/ui/reveal";

/**
 * The money-honesty strip — sits right after the price table, answering the
 * three questions families actually worry about at the counter.
 */
const stroke = { fill: "none" as const, stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

const POINTS = [
  {
    title: "Pay how you like",
    text: "Cash, UPI and cards at every counter — consultation, lab, pharmacy and admissions.",
    icon: <g {...stroke}><rect x="2.5" y="6" width="19" height="13" rx="2.5" /><path d="M2.5 10h19M6.5 15h4" /></g>,
  },
  {
    title: "A receipt for everything",
    text: "Every payment gets a printed, GST-compliant receipt — and any past bill can be reprinted at the desk.",
    icon: <g {...stroke}><path d="M6 2.5h12v19l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4-2 1.4v-19Z" /><path d="M9 8h6M9 12h6M9 16h3.5" /></g>,
  },
  {
    title: "Rates locked at admission",
    text: "Ward prices are published on this page and frozen when you're admitted — the bill can't disagree with the website.",
    icon: <g {...stroke}><rect x="4.5" y="10" width="15" height="11" rx="2.5" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14.5v3" /></g>,
  },
];

export function Assurance() {
  return (
    <section className="px-3 pb-10 sm:px-5">
      <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-3 md:grid-cols-3">
        {POINTS.map((p, i) => (
          <Reveal key={p.title} delay={i * 70}>
            <div className="flex h-full items-start gap-4 rounded-[20px] bg-[var(--mint-soft)] p-5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-[#3e7d5c]">
                <svg width="19" height="19" viewBox="0 0 24 24" aria-hidden>{p.icon}</svg>
              </span>
              <span>
                <span className="block text-[14px] font-semibold text-[var(--ink)]">{p.title}</span>
                <span className="mt-1 block text-[12.5px] leading-[1.65] text-[var(--ink-soft)]">{p.text}</span>
              </span>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
