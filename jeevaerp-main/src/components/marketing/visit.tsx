import { Reveal } from "@/components/ui/reveal";
import { Scoop } from "@/components/ui/scoop";
import { Vitals } from "@/components/marketing/vitals";
import { HOSPITAL } from "@/lib/data";

/** Address, hours, contact — one rounded panel, Maps docked in the photo. */
export function Visit() {
  return (
    <section id="visit" className="px-3 py-16 sm:px-5 lg:py-24">
      <div className="mx-auto max-w-[1280px]">
        <div className="px-2 sm:px-4">
          <Reveal><p className="sec-index">06 · Visit us</p></Reveal>
          <Reveal delay={60}>
            <h2 className="display mt-8 max-w-xl text-[clamp(2.2rem,4.6vw,3.4rem)] text-[var(--ink)]">
              Easy to find,<br />open all day.
            </h2>
          </Reveal>
        </div>

        <Reveal delay={120} className="mt-12">
          <div className="card grid gap-2 rounded-[var(--r-xl)] p-3 lg:grid-cols-[6fr_6fr]">
            {/* the actual street — with Maps docked in the scooped corner */}
            <div className="relative min-h-[320px]">
              <img
                src="/images/hospital_banner.jpeg"
                alt={`${HOSPITAL.name}, ${HOSPITAL.locality}`}
                className="absolute inset-0 h-full w-full rounded-[calc(var(--r-xl)-10px)] object-cover"
              />
              <Scoop corner="br" bg="var(--paper)" r={18} inner={22}>
                <a href={HOSPITAL.mapUrl} target="_blank" rel="noreferrer" className="btn btn-solid !px-6 !py-3 !text-[13px]">
                  Open in Maps <span aria-hidden>→</span>
                </a>
              </Scoop>
            </div>

            {/* the practical facts */}
            <div className="flex flex-col justify-center gap-8 px-6 py-8 lg:px-10 lg:py-10">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">Address</p>
                <p className="mt-3 max-w-md text-[15px] leading-[1.7] text-[var(--ink)]">{HOSPITAL.address}</p>
              </div>
              <div className="grid gap-8 border-t border-[var(--line)] pt-8 sm:grid-cols-2">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">Hours</p>
                  <p className="mt-3 font-mono text-[14.5px] text-[var(--ink)]">OPD · {HOSPITAL.opdHours}</p>
                  <p className="mt-1 text-[13px] text-[var(--muted)]">{HOSPITAL.opdDays}</p>
                  <p className="mt-4 font-mono text-[14.5px] text-[var(--alert)]">Emergency · 24×7</p>
                  <p className="mt-1 text-[13px] text-[var(--muted)]">Every day, including holidays.</p>
                </div>
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">Contact</p>
                  <a href={`tel:${HOSPITAL.phone.replace(/\s/g, "")}`} className="mt-3 block font-mono text-[14.5px] text-[var(--ink)] hover:text-[var(--teal)]">{HOSPITAL.phone}</a>
                  <a href={`mailto:${HOSPITAL.email}`} className="mt-1.5 block break-all text-[13px] text-[var(--muted)] hover:text-[var(--teal)]">{HOSPITAL.email}</a>
                  <p className="mt-4 text-[13px] leading-[1.7] text-[var(--muted)]">Parking at the gate. Wheelchair access at the main entrance.</p>
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal className="mt-14 px-2 sm:px-4 lg:mt-16"><Vitals /></Reveal>
      </div>
    </section>
  );
}
