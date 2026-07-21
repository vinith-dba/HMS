"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ComponentType } from "react";
import { gsap } from "gsap";
import { DeptIcon } from "@/components/marketing/dept-icon";
import { DoctorAvatar } from "@/components/marketing/doctor-avatar";
import { HOSPITAL, DEPARTMENTS, DOCTORS, QUICK_NEEDS } from "@/lib/data";

type Menu = "departments" | "doctors" | null;
type DoctorItem = (typeof DOCTORS)[number];

const LINKS: { href: string; label: string; menu?: Menu }[] = [
  { href: "/#departments", label: "Departments", menu: "departments" },
  { href: "/doctors", label: "Doctors", menu: "doctors" },
  { href: "/#wards", label: "Rooms & prices" },
  { href: "/#visit", label: "Visit us" },
  { href: "/#faq", label: "FAQ" },
];

/* ---------------------------------------------------------------------- */
/*  Family & preventive care — self-contained so it renders even before   */
/*  lib/data.ts grows a dedicated entry for it. `match` is a loose        */
/*  keyword resolved against DEPARTMENTS.name below; adjust the keywords  */
/*  to whatever your real department names are.                          */
/* ---------------------------------------------------------------------- */

type IconProps = { className?: string };

function IconPregnancy({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M12 20s-7-4.35-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 5c-2.5 4.65-9.5 9-9.5 9Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="11" r="1.6" fill="currentColor" />
    </svg>
  );
}

function IconChild({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M10 3.5h4M10.5 3.5v2.7c0 .5-.2.9-.6 1.2-1 .8-1.9 1.9-1.9 3.6v7c0 1.4 1.1 2.5 2.5 2.5h3c1.4 0 2.5-1.1 2.5-2.5v-7c0-1.7-.9-2.8-1.9-3.6-.4-.3-.6-.7-.6-1.2V3.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M9 14h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconSenior({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.4" opacity="0.35" />
      <path
        d="M3 12h4l2-4 3 8 2-6 1.5 2H21"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCheckup({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect x="5" y="4" width="14" height="17" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M9 3.5h6a1 1 0 0 1 1 1V6H8V4.5a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M8.5 13.5l2 2 4.5-4.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const FAMILY_CARE: {
  label: string;
  note: string;
  match: string;
  Icon: ComponentType<IconProps>;
}[] = [
  {
    label: "Pregnancy & Maternity",
    note: "Antenatal care through to delivery",
    match: "gynaec",
    Icon: IconPregnancy,
  },
  {
    label: "Newborn & Child Care",
    note: "Vaccination, growth checks, paediatric OPD",
    match: "paediatric",
    Icon: IconChild,
  },
  {
    label: "Parent & Senior Care",
    note: "Ongoing care for ageing parents",
    match: "general medicine",
    Icon: IconSenior,
  },
  {
    label: "Full Body Checkup",
    note: "Preventive screening for every age",
    match: "general medicine",
    Icon: IconCheckup,
  },
];

function resolveDept(match: string): string {
  const found = DEPARTMENTS.find((d) => d.name.toLowerCase().includes(match.toLowerCase()));
  return found?.name ?? match;
}

/* ---------------------------------------------------------------------- */
/*  Motion helpers                                                        */
/* ---------------------------------------------------------------------- */

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Subtle magnetic tilt for cards — follows the cursor, settles on leave. */
function useMagneticTilt<T extends HTMLElement>(strength = 6) {
  const ref = useRef<T>(null);
  const setX = useRef<((v: number) => void) | null>(null);
  const setY = useRef<((v: number) => void) | null>(null);

  useEffect(() => {
    if (!ref.current || prefersReducedMotion()) return;
    gsap.set(ref.current, { transformPerspective: 700, force3D: true });
    setX.current = gsap.quickTo(ref.current, "rotationY", { duration: 0.5, ease: "power3.out" });
    setY.current = gsap.quickTo(ref.current, "rotationX", { duration: 0.5, ease: "power3.out" });
  }, []);

  const onMouseMove = (e: React.MouseEvent<T>) => {
    if (!ref.current || !setX.current || !setY.current) return;
    const rect = ref.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    setX.current(px * strength);
    setY.current(py * -strength);
  };

  const onMouseLeave = () => {
    setX.current?.(0);
    setY.current?.(0);
  };

  return { ref, onMouseMove, onMouseLeave };
}

/** Small magnetic pull for the primary CTA button. */
function useMagneticPull<T extends HTMLElement>(strength = 0.3) {
  const ref = useRef<T>(null);
  const setX = useRef<((v: number) => void) | null>(null);
  const setY = useRef<((v: number) => void) | null>(null);

  useEffect(() => {
    if (!ref.current || prefersReducedMotion()) return;
    setX.current = gsap.quickTo(ref.current, "x", { duration: 0.4, ease: "power3.out" });
    setY.current = gsap.quickTo(ref.current, "y", { duration: 0.4, ease: "power3.out" });
  }, []);

  const onMouseMove = (e: React.MouseEvent<T>) => {
    if (!ref.current || !setX.current || !setY.current) return;
    const rect = ref.current.getBoundingClientRect();
    const relX = e.clientX - (rect.left + rect.width / 2);
    const relY = e.clientY - (rect.top + rect.height / 2);
    setX.current(relX * strength);
    setY.current(relY * strength);
  };

  const onMouseLeave = () => {
    setX.current?.(0);
    setY.current?.(0);
  };

  return { ref, onMouseMove, onMouseLeave };
}

/* ---------------------------------------------------------------------- */
/*  Doctor card                                                           */
/* ---------------------------------------------------------------------- */

function DoctorCard({ d }: { d: DoctorItem }) {
  const { ref, onMouseMove, onMouseLeave } = useMagneticTilt<HTMLAnchorElement>(6);

  return (
    <Link
      ref={ref}
      href={`/book?doctor=${d.id}`}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      className="mega-item card group rounded-[var(--r-sm)] border border-transparent p-4 shadow-[var(--shadow-sm)] transition-[border-color,box-shadow] duration-300 hover:border-[var(--teal-tint)] hover:shadow-[var(--shadow)]"
      style={{ transformStyle: "preserve-3d", willChange: "transform" }}
    >
      <span className="flex items-center gap-3">
        <span className="relative h-12 w-12 flex-none overflow-hidden rounded-full ring-2 ring-transparent transition-all duration-300 group-hover:ring-[var(--teal-tint)]">
          <DoctorAvatar
            name={d.name}
            image={d.image}
            className="h-full w-full rounded-full text-[13px] transition-transform duration-500 group-hover:scale-110"
          />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[13.5px] font-semibold text-[var(--ink)] group-hover:text-[var(--teal-deep)]">
            {d.name}
          </span>
          <span className="block truncate text-[11.5px] text-[var(--teal)]">{d.specialization}</span>
        </span>
      </span>
      <span className="mt-3 flex items-center justify-between gap-2 border-t border-[var(--line)] pt-2.5">
        <span className="truncate font-mono text-[10px] text-[var(--muted)]">
          {d.days} · {d.opd}
        </span>
        <span className="rounded-full bg-[var(--teal-soft)] px-2 py-0.5 font-mono text-[11.5px] font-semibold text-[var(--ink)] transition-colors duration-300 group-hover:bg-[var(--teal)] group-hover:text-white">
          ₹{d.fee}
        </span>
      </span>
      <span className="mt-2.5 flex items-center gap-1.5 text-[11.5px] font-semibold text-[var(--teal)]">
        Book appointment
        <span className="transition-transform duration-300 group-hover:translate-x-1.5" aria-hidden>
          →
        </span>
      </span>
    </Link>
  );
}

/* ---------------------------------------------------------------------- */
/*  Navbar                                                                 */
/* ---------------------------------------------------------------------- */

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState<Menu>(null);
  const [mobileSection, setMobileSection] = useState<Menu>(null);

  const navWrapRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const megaPanelRef = useRef<HTMLDivElement>(null);
  const mobilePanelRef = useRef<HTMLDivElement>(null);

  const cta = useMagneticPull<HTMLAnchorElement>();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Mega panel entrance: stagger children in whenever the menu opens or switches.
  useEffect(() => {
    const panel = megaPanelRef.current;
    if (!panel || !menu) return;
    const reduced = prefersReducedMotion();
    const ctx = gsap.context(() => {
      gsap.fromTo(
        panel.querySelectorAll(".mega-item"),
        { autoAlpha: 0, y: reduced ? 0 : 14 },
        {
          autoAlpha: 1,
          y: 0,
          duration: reduced ? 0 : 0.4,
          stagger: reduced ? 0 : 0.03,
          ease: "power3.out",
        }
      );
    }, panel);
    return () => ctx.revert();
  }, [menu]);

  // Mobile drawer entrance: animate open height + stagger items in.
  useEffect(() => {
    const panel = mobilePanelRef.current;
    if (!panel || !open) return;
    const reduced = prefersReducedMotion();
    const targetHeight = panel.scrollHeight;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        panel,
        { height: 0, autoAlpha: 0 },
        {
          height: targetHeight,
          autoAlpha: 1,
          duration: reduced ? 0 : 0.4,
          ease: "power3.out",
          onComplete: () => {
            panel.style.height = "auto";
          },
        }
      );
      gsap.fromTo(
        panel.querySelectorAll(".mobile-item"),
        { autoAlpha: 0, y: reduced ? 0 : 10 },
        {
          autoAlpha: 1,
          y: 0,
          duration: reduced ? 0 : 0.35,
          stagger: reduced ? 0 : 0.035,
          delay: reduced ? 0 : 0.08,
          ease: "power3.out",
        }
      );
    }, panel);
    return () => ctx.revert();
  }, [open]);

  function hidePill() {
    if (!pillRef.current) return;
    gsap.to(pillRef.current, { autoAlpha: 0, duration: prefersReducedMotion() ? 0 : 0.25, ease: "power2.out" });
  }

  function movePillTo(el: HTMLElement) {
    const wrap = navWrapRef.current;
    const pill = pillRef.current;
    if (!wrap || !pill) return;
    const wrapRect = wrap.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    gsap.to(pill, {
      x: elRect.left - wrapRect.left,
      width: elRect.width,
      autoAlpha: 1,
      duration: prefersReducedMotion() ? 0 : 0.45,
      ease: "power3.out",
    });
  }

  function close() {
    setMenu(null);
    hidePill();
  }

  function toggleMobileSection(section: Exclude<Menu, null>) {
    setMobileSection((s) => (s === section ? null : section));
  }

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5 sm:pt-4">
      <div onMouseLeave={close}>
        <div
          className={`glass mx-auto flex h-[58px] max-w-[1100px] items-center justify-between gap-4 rounded-full pl-5 pr-2 transition-shadow duration-300 ${
            scrolled || menu ? "shadow-[var(--shadow)]" : "shadow-[var(--shadow-sm)]"
          }`}
        >
          <Link href="/" className="flex items-center gap-2.5" aria-label="Jeeva — home" onClick={close}>
            <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--teal)] text-white" aria-hidden>
              <svg width="12" height="12" viewBox="0 0 14 14">
                <path d="M5 0h4v5h5v4H9v5H5V9H0V5h5z" fill="currentColor" />
              </svg>
            </span>
            <span className="display text-[19px] text-[var(--ink)]">Jeeva</span>
          </Link>

          <nav ref={navWrapRef} onMouseLeave={hidePill} className="relative hidden items-center gap-1 lg:flex">
            <span
              ref={pillRef}
              aria-hidden
              className="pointer-events-none absolute left-0 top-1 bottom-1 z-0 rounded-full bg-[var(--teal-soft)] opacity-0"
              style={{ width: 0 }}
            />
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={close}
                onMouseEnter={(e) => {
                  setMenu(l.menu ?? null);
                  movePillTo(e.currentTarget);
                }}
                onFocus={(e) => {
                  setMenu(l.menu ?? null);
                  movePillTo(e.currentTarget);
                }}
                aria-expanded={l.menu ? menu === l.menu : undefined}
                className={`relative z-10 flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13.5px] font-medium transition-colors ${
                  menu === l.menu && l.menu ? "text-[var(--teal)]" : "text-[var(--ink-soft)] hover:text-[var(--teal)]"
                }`}
              >
                {l.label}
                {l.menu && (
                  <svg
                    width="9"
                    height="9"
                    viewBox="0 0 10 10"
                    className={`transition-transform duration-200 ${menu === l.menu ? "rotate-180" : ""}`}
                    aria-hidden
                  >
                    <path
                      d="M1.5 3.5 5 7l3.5-3.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <span className="hidden md:inline-flex">
              <a
                href={`tel:${HOSPITAL.emergency.replace(/\s/g, "")}`}
                className="chip !border-[var(--alert)]/25 !text-[var(--alert)]"
                aria-label="Emergency, 24 by 7"
              >
                24×7 · {HOSPITAL.emergency}
              </a>
            </span>
            <Link
              ref={cta.ref}
              href="/book"
              onMouseMove={cta.onMouseMove}
              onMouseLeave={cta.onMouseLeave}
              className="btn btn-solid !px-5 !py-2.5 !text-[13px]"
              onClick={close}
            >
              Book a visit
            </Link>
            <button
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              className="grid h-10 w-10 place-items-center rounded-full border border-[var(--line-strong)] bg-white/60 lg:hidden"
            >
              <span className="text-[14px] leading-none" aria-hidden>
                {open ? "✕" : "☰"}
              </span>
            </button>
          </div>
        </div>

        {/* ---- mega panel: the navbar extends downward ---- */}
        {menu && (
          <div
            ref={megaPanelRef}
            className="mega-in glass mx-auto mt-2 hidden max-w-[1100px] rounded-[var(--r-lg)] p-4 shadow-[var(--shadow)] lg:block"
          >
            {menu === "departments" && (
              <div>
                <div className="flex items-center justify-between px-2 pb-3 pt-1">
                  <p className="mega-item font-mono text-[10.5px] uppercase tracking-[0.16em] text-[var(--muted)]">
                    {DEPARTMENTS.length} departments · one building
                  </p>
                  <Link
                    href="/#departments"
                    onClick={close}
                    className="mega-item text-[12.5px] font-semibold text-[var(--teal)] hover:text-[var(--teal-deep)]"
                  >
                    What we treat →
                  </Link>
                </div>

                <div className="xl:grid xl:grid-cols-[1fr_300px] xl:gap-5">
                  {/* department cards */}
                  <div className="grid grid-cols-4 gap-2">
                    {DEPARTMENTS.map((d) => (
                      <Link
                        key={d.name}
                        href={`/book?dept=${encodeURIComponent(d.name)}`}
                        onClick={close}
                        className="mega-item card group rounded-[var(--r-sm)] border border-transparent p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--teal-tint)] hover:shadow-[var(--shadow)]"
                      >
                        <span className="flex items-start justify-between">
                          <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--teal-soft)] text-[var(--teal)] transition-colors group-hover:bg-[var(--teal)] group-hover:text-white">
                            <DeptIcon name={d.name} className="h-5 w-5" />
                          </span>
                          <span
                            className="grid h-7 w-7 place-items-center rounded-full border border-[var(--line)] text-[11px] text-[var(--muted)] transition-all duration-200 group-hover:rotate-45 group-hover:border-transparent group-hover:bg-[var(--teal-soft)] group-hover:text-[var(--teal)]"
                            aria-hidden
                          >
                            ↗
                          </span>
                        </span>
                        <span className="mt-3.5 block text-[13.5px] font-semibold text-[var(--ink)] group-hover:text-[var(--teal-deep)]">
                          {d.name}
                        </span>
                        <span className="mt-1 block font-mono text-[9.5px] uppercase tracking-[0.08em] text-[var(--muted)]">
                          {d.common}
                        </span>
                      </Link>
                    ))}
                  </div>

                  {/* family & preventive care */}
                  <div className="mega-item mt-4 flex flex-col gap-1 rounded-[var(--r-sm)] bg-[var(--teal)] p-4 xl:mt-0">
                    <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.16em] text-white/70">
                      For the whole family
                    </p>
                    <div className="flex flex-col divide-y divide-white/15">
                      {FAMILY_CARE.map((item) => (
                        <Link
                          key={item.label}
                          href={`/book?dept=${encodeURIComponent(resolveDept(item.match))}`}
                          onClick={close}
                          className="group flex items-center gap-3 py-3 first:pt-2 last:pb-2"
                        >
                          <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-white/15 transition-colors group-hover:bg-white">
                            <item.Icon className="h-4.5 w-4.5 text-white transition-colors group-hover:text-[var(--teal-deep)]" />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-[12.5px] font-semibold text-white">{item.label}</span>
                            <span className="mt-0.5 block text-[10.5px] leading-[1.4] text-white/70">
                              {item.note}
                            </span>
                          </span>
                          <span
                            className="ml-auto -translate-x-1 text-white opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100"
                            aria-hidden
                          >
                            →
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>

                {/* common needs — fever & prevention, children, pregnancy */}
                <p className="mega-item mb-2 mt-4 px-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
                  Common needs · straight to booking
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {QUICK_NEEDS.map((q) => (
                    <Link
                      key={q.label}
                      href={`/book?dept=${encodeURIComponent(q.dept)}`}
                      onClick={close}
                      className="mega-item group flex items-start gap-3 rounded-[var(--r-sm)] bg-[var(--teal-soft)] p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:bg-[var(--teal)]"
                    >
                      <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-white/70 text-[var(--teal)] transition-colors group-hover:bg-white/15 group-hover:text-white">
                        <DeptIcon name={q.icon} className="h-4.5 w-4.5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[12.5px] font-semibold text-[var(--teal-deep)] transition-colors group-hover:text-white">
                          {q.label}
                        </span>
                        <span className="mt-0.5 block text-[10.5px] leading-[1.5] text-[var(--ink-soft)] transition-colors group-hover:text-white/75">
                          {q.note}
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {menu === "doctors" && (
              <div>
                <div className="flex items-center justify-between px-2 pb-3 pt-1">
                  <p className="mega-item font-mono text-[10.5px] uppercase tracking-[0.16em] text-[var(--muted)]">
                    {DOCTORS.length} specialists · consulting daily
                  </p>
                  <Link
                    href="/doctors"
                    onClick={close}
                    className="mega-item text-[12.5px] font-semibold text-[var(--teal)] hover:text-[var(--teal-deep)]"
                  >
                    All doctors →
                  </Link>
                </div>

                <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
                  {DOCTORS.slice(0, 6).map((d) => (
                    <DoctorCard key={d.id} d={d} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {open && (
        <div
          ref={mobilePanelRef}
          className="glass mx-auto mt-2 max-w-[1100px] overflow-hidden rounded-[var(--r-lg)] shadow-[var(--shadow)] lg:hidden"
        >
          <nav className="flex flex-col px-5 py-3">
            {/* family care highlight */}
            <div className="mobile-item my-1 rounded-[var(--r-sm)] bg-[var(--teal)] p-4">
              <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.16em] text-white/70">
                For the whole family
              </p>
              <div className="grid grid-cols-2 gap-2">
                {FAMILY_CARE.map((item) => (
                  <Link
                    key={item.label}
                    href={`/book?dept=${encodeURIComponent(resolveDept(item.match))}`}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2 rounded-[var(--r-sm)] bg-white/10 p-2.5"
                  >
                    <item.Icon className="h-4 w-4 flex-none text-white" />
                    <span className="text-[11.5px] font-medium leading-tight text-white">{item.label}</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* departments accordion */}
            <button
              type="button"
              onClick={() => toggleMobileSection("departments")}
              aria-expanded={mobileSection === "departments"}
              className="mobile-item flex items-center justify-between border-b border-[var(--line)] py-3.5 text-[14px] font-medium text-[var(--ink-soft)]"
            >
              Departments
              <svg
                width="9"
                height="9"
                viewBox="0 0 10 10"
                className={`transition-transform duration-200 ${mobileSection === "departments" ? "rotate-180" : ""}`}
                aria-hidden
              >
                <path
                  d="M1.5 3.5 5 7l3.5-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <div
              className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                mobileSection === "departments" ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              }`}
            >
              <div className="overflow-hidden">
                <div className="grid grid-cols-2 gap-1.5 py-2">
                  {DEPARTMENTS.map((d) => (
                    <Link
                      key={d.name}
                      href={`/book?dept=${encodeURIComponent(d.name)}`}
                      onClick={() => setOpen(false)}
                      className="rounded-[var(--r-sm)] px-3 py-2.5 text-[12.5px] font-medium text-[var(--ink-soft)] hover:bg-[var(--teal-soft)] hover:text-[var(--teal)]"
                    >
                      {d.name}
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            {/* doctors accordion */}
            <button
              type="button"
              onClick={() => toggleMobileSection("doctors")}
              aria-expanded={mobileSection === "doctors"}
              className="mobile-item flex items-center justify-between border-b border-[var(--line)] py-3.5 text-[14px] font-medium text-[var(--ink-soft)]"
            >
              Doctors
              <svg
                width="9"
                height="9"
                viewBox="0 0 10 10"
                className={`transition-transform duration-200 ${mobileSection === "doctors" ? "rotate-180" : ""}`}
                aria-hidden
              >
                <path
                  d="M1.5 3.5 5 7l3.5-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <div
              className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                mobileSection === "doctors" ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              }`}
            >
              <div className="overflow-hidden">
                <div className="flex flex-col gap-1.5 py-2">
                  {DOCTORS.slice(0, 6).map((d) => (
                    <Link
                      key={d.id}
                      href={`/book?doctor=${d.id}`}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 rounded-[var(--r-sm)] px-2 py-2 hover:bg-[var(--teal-soft)]"
                    >
                      <DoctorAvatar name={d.name} image={d.image} className="h-9 w-9 flex-none rounded-full text-[11px]" />
                      <span className="min-w-0">
                        <span className="block truncate text-[12.5px] font-semibold text-[var(--ink)]">{d.name}</span>
                        <span className="block truncate text-[10.5px] text-[var(--teal)]">{d.specialization}</span>
                      </span>
                      <span className="ml-auto font-mono text-[11px] font-semibold text-[var(--muted)]">₹{d.fee}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            {/* plain links */}
            {LINKS.filter((l) => !l.menu).map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="mobile-item border-b border-[var(--line)] py-3.5 text-[14px] font-medium text-[var(--ink-soft)] last:border-0"
              >
                {l.label}
              </Link>
            ))}

            <a
              href={`tel:${HOSPITAL.emergency.replace(/\s/g, "")}`}
              className="mobile-item mb-2 mt-3 flex items-center justify-center gap-2 rounded-full bg-[var(--alert-soft)] py-3 font-mono text-[13px] font-semibold text-[var(--alert)]"
            >
              Emergency · {HOSPITAL.emergency}
            </a>
            <Link
              href="/book"
              onClick={() => setOpen(false)}
              className="mobile-item btn btn-solid mb-3 w-full justify-center !py-3 !text-[13px]"
            >
              Book a visit
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}