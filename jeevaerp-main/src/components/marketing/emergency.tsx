import { Scoop } from "@/components/ui/scoop";
import { HOSPITAL } from "@/lib/data";

/** The one loud thing on the page — and it's for emergencies only. */
export function EmergencyBand() {
  return (
    <section className="px-3 py-8 sm:px-5">
      <div className="relative mx-auto max-w-[1280px] rounded-[var(--r-shell)] bg-[var(--alert)] px-8 py-14 pb-24 sm:px-12 lg:py-16 lg:pb-24">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/70">Emergency · 24×7</p>
        <p className="display mt-3 max-w-3xl text-[clamp(1.8rem,4.4vw,3rem)] text-white">
          Don&apos;t book. Come straight in, or call.
        </p>

        <Scoop corner="br" r={22} inner={26}>
          <a href={`tel:${HOSPITAL.emergency.replace(/\s/g, "")}`}
            className="btn btn-light font-mono !text-[15px] !text-[var(--alert)]">
            {HOSPITAL.emergency}
          </a>
        </Scoop>
      </div>
    </section>
  );
}
