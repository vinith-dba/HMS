import Link from "next/link";
import { Reveal } from "@/components/ui/reveal";
import { HOSPITAL } from "@/lib/data";

/** The closing ask — one sky panel, one ink pill, the name as a watermark. */
export function PortalCta() {
  return (
    <section className="px-3 py-10 sm:px-5">
      <Reveal className="mx-auto max-w-[1280px]">
        <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-b from-[var(--sky)] to-[var(--sky-soft)] px-6 py-16 text-center sm:py-20">
          <p aria-hidden
            className="pointer-events-none absolute inset-x-0 -bottom-8 select-none whitespace-nowrap text-center font-sans text-[clamp(5rem,16vw,12rem)] font-bold leading-none tracking-tight text-white/50">
            Jeeva
          </p>
          <div className="relative">
            <h2 className="display mx-auto max-w-2xl text-[clamp(1.8rem,3.6vw,2.6rem)] text-[var(--ink)]">
              Don&apos;t wait on your health — expert care, morning to night
            </h2>
            <p className="mx-auto mt-4 max-w-md text-[14px] leading-[1.75] text-[var(--ink-soft)]">
              OPD {HOSPITAL.opdHours}, {HOSPITAL.opdDays.toLowerCase()} — and the
              emergency door never closes.
            </p>
            <Link href="/book" className="btn btn-solid mt-7 !px-8">Book appointment now</Link>
            <p className="mt-5 text-[13px] text-[var(--ink-soft)]">
              Already visited?{" "}
              <Link href="/portal/login" className="font-semibold text-[var(--teal-deep)] underline underline-offset-2 hover:text-[var(--ink)]">
                Open the patient portal
              </Link>{" "}
              to see your reports and bills.
            </p>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
