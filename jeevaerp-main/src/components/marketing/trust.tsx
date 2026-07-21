import Link from "next/link";
import { Reveal, CountUp } from "@/components/ui/reveal";
import { DoctorAvatar } from "@/components/marketing/doctor-avatar";
import { DEPARTMENTS, DOCTORS } from "@/lib/data";

/** The proof band under the hero — one big number, one connect card. */
export function Trust() {
  const faces = DOCTORS.slice(0, 3);
  return (
    <section className="px-3 pt-4 sm:px-5">
      <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-4 lg:grid-cols-[1fr_2.2fr]">
        {/* the big number */}
        <Reveal>
          <div className="card flex h-full flex-col justify-between rounded-[24px] p-6">
            <p className="display text-[44px] text-[var(--ink)]"><CountUp to={DEPARTMENTS.length} /></p>
            <div>
              <p className="mt-2 max-w-[220px] text-[13px] leading-relaxed text-[var(--muted)]">
                departments under one roof — most visits never leave the building
              </p>
              <div className="mt-4 flex items-center">
                {faces.map((d, i) => (
                  <DoctorAvatar key={d.id} name={d.name} image={d.image}
                    className={`h-8 w-8 rounded-full border-2 border-white text-[10px] ${i > 0 ? "-ml-2.5" : ""}`} />
                ))}
                <span className="-ml-2.5 grid h-8 w-8 place-items-center rounded-full border-2 border-white bg-[var(--sky-soft)] text-[10px] font-semibold text-[var(--teal-deep)]">
                  +{Math.max(0, DOCTORS.length - 3)}
                </span>
              </div>
            </div>
          </div>
        </Reveal>

        {/* connect card — orbit graphic + the two figures */}
        <Reveal delay={80}>
          <div className="card grid h-full gap-6 rounded-[24px] p-6 sm:grid-cols-[1.2fr_1fr_auto] sm:items-center sm:p-8">
            <div>
              <h3 className="display text-[22px] text-[var(--ink)]">Connect with our professional doctors</h3>
              <p className="mt-2 max-w-xs text-[13px] leading-relaxed text-[var(--muted)]">
                Book a time with a dedicated specialist — your full history is already
                on their screen when you sit down.
              </p>
              <Link href="/doctors" className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--teal)] hover:text-[var(--teal-deep)]">
                Meet the doctors →
              </Link>
            </div>

            {/* orbit */}
            <div aria-hidden className="relative mx-auto hidden h-[150px] w-[150px] sm:block">
              <span className="absolute inset-0 rounded-full border border-[var(--line)]" />
              <span className="absolute inset-[22px] rounded-full border border-[var(--line)]" />
              <span className="absolute inset-[44px] rounded-full border border-[var(--line-strong)]" />
              <DoctorAvatar name={DOCTORS[4].name} image={DOCTORS[4].image} className="absolute left-1/2 top-1/2 h-11 w-11 -translate-x-1/2 -translate-y-1/2 rounded-full text-[11px]" />
              <DoctorAvatar name={DOCTORS[1].name} image={DOCTORS[1].image} className="absolute -top-1 left-8 h-7 w-7 rounded-full text-[9px]" />
              <DoctorAvatar name={DOCTORS[5].name} image={DOCTORS[5].image} className="absolute bottom-1 right-1 h-7 w-7 rounded-full text-[9px]" />
              <span className="absolute right-4 top-6 h-2 w-2 rounded-full bg-[var(--teal)]" />
              <span className="absolute bottom-8 left-1 h-2 w-2 rounded-full bg-[var(--saffron)]" />
            </div>

            <div className="flex gap-8 sm:flex-col sm:gap-5 sm:border-l sm:border-[var(--line)] sm:pl-8">
              <div>
                <p className="display text-[26px] text-[var(--ink)]"><CountUp to={DOCTORS.length} suffix="+" /></p>
                <p className="text-[12px] leading-snug text-[var(--muted)]">professional<br />doctors</p>
              </div>
              <div>
                <p className="display text-[26px] text-[var(--ink)]"><CountUp to={30} suffix=" min" /></p>
                <p className="text-[12px] leading-snug text-[var(--muted)]">routine lab<br />reports</p>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
