import Link from "next/link";
import { Reveal } from "@/components/ui/reveal";
import { DoctorAvatar } from "@/components/marketing/doctor-avatar";
import { DOCTORS } from "@/lib/data";

/** "People who care" — centered intro, then the team as photo cards. */
export function SpecializedDoctors() {
  const featured = DOCTORS.slice(0, 8);
  return (
    <section id="doctors" className="bg-[var(--bone-deep)]/60 px-3 py-16 sm:px-5 lg:py-24">
      <div className="mx-auto max-w-[1280px]">
        <Reveal><p className="idx text-center uppercase tracking-[0.16em]">Meet the team</p></Reveal>
        <Reveal delay={60}>
          <h2 className="display mx-auto mt-3 max-w-xl text-center text-[clamp(1.9rem,3.6vw,2.6rem)] text-[var(--ink)]">
            People who care
          </h2>
        </Reveal>
        <Reveal delay={120}>
          <p className="mx-auto mt-4 max-w-lg text-center text-[14px] leading-[1.75] text-[var(--muted)]">
            Our doctors aren&apos;t just top-notch at what they do — they actually care
            about you. Specialists, physicians and nurses who make sure you get the
            care you deserve, with a smile.
          </p>
        </Reveal>

        <div className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-4">
          {featured.map((d, i) => (
            <Reveal key={d.id} delay={Math.min(i * 50, 350)}>
              <Link href={`/book?doctor=${d.id}`} className="group relative block overflow-hidden rounded-[20px]">
                <DoctorAvatar name={d.name} image={d.image}
                  className="aspect-[3/4] w-full object-cover text-[28px] transition-transform duration-500 group-hover:scale-[1.04]" />
                <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-[rgba(16,24,40,0.78)] via-transparent to-transparent" />
                <div className="absolute inset-x-4 bottom-4 text-white">
                  <p className="text-[14px] font-semibold">{d.name}</p>
                  <p className="mt-0.5 text-[11.5px] text-white/75">{d.specialization}</p>
                </div>
                <span className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-white/85 text-[12px] text-[var(--ink)] opacity-0 backdrop-blur transition-all duration-300 group-hover:opacity-100" aria-hidden>
                  ↗
                </span>
              </Link>
            </Reveal>
          ))}
        </div>

        <Reveal delay={200} className="mt-10 text-center">
          <Link href="/doctors" className="btn btn-solid !px-7">Meet the team</Link>
        </Reveal>
      </div>
    </section>
  );
}
