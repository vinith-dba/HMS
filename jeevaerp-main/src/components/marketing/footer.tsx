import Link from "next/link";
import { HOSPITAL, DEPARTMENTS } from "@/lib/data";

/**
 * Navy footer — practical columns and a stay-in-touch strip. Every icon here
 * does something real (call, mail, directions); no dead social links.
 */
export function Footer() {
  return (
    <footer className="px-3 pb-3 sm:px-5 sm:pb-5">
      <div className="mx-auto max-w-[1280px] rounded-[24px] bg-[var(--pine-ink)] px-8 pb-8 pt-14 text-white sm:px-12">
        <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1.2fr]">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--teal)] text-white" aria-hidden>
                <svg width="12" height="12" viewBox="0 0 14 14"><path d="M5 0h4v5h5v4H9v5H5V9H0V5h5z" fill="currentColor" /></svg>
              </span>
              <span className="text-[17px] font-semibold">{HOSPITAL.shortName}</span>
            </div>
            <p className="mt-4 max-w-xs text-[13px] leading-[1.7] text-white/55">
              {HOSPITAL.tagline} — {DEPARTMENTS.length} departments, one building,
              one record for every patient.
            </p>
          </div>

          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/40">Discover</p>
            <ul className="mt-4 space-y-2.5 text-[13.5px]">
              <li><Link href="/doctors" className="text-white/75 transition-colors hover:text-white">Doctors</Link></li>
              <li><Link href="/#departments" className="text-white/75 transition-colors hover:text-white">Departments</Link></li>
              <li><Link href="/#wards" className="text-white/75 transition-colors hover:text-white">Rooms &amp; prices</Link></li>
              <li><Link href="/book" className="text-white/75 transition-colors hover:text-white">Book an appointment</Link></li>
              <li><Link href="/portal/login" className="text-white/75 transition-colors hover:text-white">Patient portal</Link></li>
            </ul>
          </div>

          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/40">Hours</p>
            <p className="mt-4 font-mono text-[13px] text-white/90">OPD · {HOSPITAL.opdHours}</p>
            <p className="mt-1 text-[13px] text-white/55">{HOSPITAL.opdDays}</p>
            <p className="mt-3 font-mono text-[13px] text-[#ff9c8a]">Emergency · 24×7</p>
            <p className="mt-1 text-[13px] text-white/55">Every day, including holidays.</p>
          </div>

          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/40">Reach us</p>
            <a href={`tel:${HOSPITAL.phone.replace(/\s/g, "")}`}
              className="mt-4 flex items-center gap-2.5 text-[13.5px] text-white/85 transition-colors hover:text-white">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-white/10" aria-hidden>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
              </span>
              {HOSPITAL.phone}
            </a>
            <a href={`mailto:${HOSPITAL.email}`}
              className="mt-2.5 flex items-center gap-2.5 text-[13px] text-white/70 transition-colors hover:text-white">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10" aria-hidden>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="3" /><path d="m2 7 10 7L22 7" /></svg>
              </span>
              <span className="break-all">{HOSPITAL.email}</span>
            </a>
            <a href={HOSPITAL.mapUrl} target="_blank" rel="noreferrer"
              className="mt-2.5 flex items-start gap-2.5 text-[13px] leading-[1.6] text-white/70 transition-colors hover:text-white">
              <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10" aria-hidden>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
              </span>
              {HOSPITAL.address}
            </a>
          </div>
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-6">
          <p className="text-[12.5px] text-white/50">© {new Date().getFullYear()} {HOSPITAL.name}. All rights reserved.</p>
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-white/40">{HOSPITAL.locality}</p>
        </div>
      </div>
    </footer>
  );
}
