import Link from "next/link";
import { Reveal } from "@/components/ui/reveal";
import { DoctorAvatar } from "@/components/marketing/doctor-avatar";
import { HOSPITAL, DOCTORS, STATS } from "@/lib/data";

/**
 * Hero — one framed porcelain shell that carries the whole promise:
 * editorial copy on the left, a doctor feature on a deep-pine panel on the
 * right, and the four headline numbers welded into a stat rail along the
 * bottom. Same material language as the staff portals — pine on porcelain,
 * Geist display, mono data — so the marketing site and the product read as
 * one system.
 */
export function Hero() {
  const lead = DOCTORS[0];
  const phone = HOSPITAL.phone.replace(/\s/g, "");

  return (
    <section className="px-3 pt-24 sm:px-5 lg:pt-28">
      <div className="mx-auto max-w-[1280px]">
        <div className="relative overflow-hidden rounded-[36px] border border-[var(--line)] bg-[var(--paper)] shadow-[var(--shadow)]">
          {/* ambient — a pine bloom + faint dotgrid, the portal signature */}
          <div aria-hidden className="pointer-events-none absolute -left-32 -top-40 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(11,84,76,0.10),transparent_62%)]" />
          <div aria-hidden className="pointer-events-none absolute right-[38%] top-0 h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle,rgba(23,112,95,0.08),transparent_60%)]" />

          <div className="relative grid items-stretch gap-8 p-6 sm:p-9 lg:grid-cols-[1.08fr_0.92fr] lg:gap-10 lg:p-12">
            {/* ── copy ─────────────────────────────────────────────── */}
            <div className="flex flex-col justify-center py-2 lg:py-4">
              <Reveal>
                <div className="mb-6 flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--muted)]" style={{ fontFamily: "var(--font-mono)" }}>
                    <span className="pulse" aria-hidden /> Now consulting · {HOSPITAL.locality.split(",")[0]}
                  </span>
                </div>
              </Reveal>

              <Reveal delay={40}>
                <h1 className="display text-[clamp(2.4rem,5vw,4rem)] text-[var(--ink)]">
                  Feel better,{" "}
                  <span className="text-[var(--teal)]">faster.</span>
                  <br />
                  Care that remembers you.
                </h1>
              </Reveal>

              <Reveal delay={90}>
                <div className="mt-7 flex max-w-lg items-start gap-5">
                  <span className="idx mt-1 shrink-0">(001)</span>
                  <p className="text-[15px] leading-[1.75] text-[var(--ink-soft)]">
                    See a specialist, get your tests done and collect your medicines —
                    all in one building in {HOSPITAL.locality.split(",")[0]}. One permanent
                    Jeeva ID keeps your whole history on the doctor&apos;s screen, so nothing
                    is asked of you twice.
                  </p>
                </div>
              </Reveal>

              <Reveal delay={160}>
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Link href="/book" className="btn btn-solid">
                    Book appointment <span aria-hidden>→</span>
                  </Link>
                  <a href={`tel:${phone}`} className="btn btn-ghost">
                    Call {HOSPITAL.phone}
                  </a>
                </div>
              </Reveal>

              <Reveal delay={220}>
                <div className="mt-8 flex flex-wrap gap-2">
                  <span className="chip">OPD {HOSPITAL.opdHours}</span>
                  <span className="chip">{HOSPITAL.opdDays}</span>
                  <span className="chip !text-[var(--alert)]">Emergency 24×7</span>
                </div>
              </Reveal>
            </div>

            {/* ── doctor feature, on a deep-pine panel ─────────────── */}
            <Reveal delay={140} className="relative min-h-[440px] lg:min-h-0">
              <div className="relative h-full min-h-[440px] overflow-hidden rounded-[26px] bg-[var(--pine-ink)]">
                <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(23,112,95,0.55),transparent_65%)]" />

                <DoctorAvatar
                  name={lead.name}
                  image={lead.image}
                  eager
                  className="absolute inset-0 h-full w-full text-[64px]"
                />

                {/* legibility gradient for the overlaid card */}
                <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-[var(--pine-ink)] via-[var(--pine-ink)]/70 to-transparent" />

                {/* top-right fact pill */}
                <div className="absolute right-4 top-4 rounded-full border border-white/15 bg-black/25 px-3.5 py-1.5 text-[11px] font-medium text-white backdrop-blur" style={{ fontFamily: "var(--font-mono)" }}>
                  {lead.experience} yrs · in practice
                </div>

                {/* consulting card */}
                <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-md sm:inset-x-5 sm:bottom-5">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--teal-tint)]" style={{ fontFamily: "var(--font-mono)" }}>
                    Consulting today
                  </p>
                  <div className="mt-1.5 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-[15px] font-semibold leading-tight text-white">{lead.name}</p>
                      <p className="text-[12px] text-[var(--teal-tint)]">{lead.specialization}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[13px] font-semibold text-white tabular" style={{ fontFamily: "var(--font-mono)" }}>{lead.opd}</p>
                      <p className="text-[11px] text-white/60 tabular" style={{ fontFamily: "var(--font-mono)" }}>₹{lead.fee} · {lead.days}</p>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>

          {/* ── stat rail — welded into the shell floor ───────────── */}
          <div className="relative grid grid-cols-2 gap-px border-t border-[var(--line)] bg-[var(--line)] sm:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label} className="bg-[var(--paper)] px-6 py-6 sm:px-7">
                <p className="display text-[clamp(1.7rem,2.6vw,2.2rem)] text-[var(--ink)]">
                  <span className="tabular">{s.value}</span>
                  <span className="text-[var(--teal)]">{s.suffix}</span>
                </p>
                <p className="mt-1 text-[13px] font-medium text-[var(--ink-soft)]">{s.label}</p>
                <p className="text-[12px] text-[var(--muted)]">{s.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
