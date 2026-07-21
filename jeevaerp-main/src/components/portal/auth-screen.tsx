"use client";

import { Icon, type IconName } from "@/components/portal/ui/icons";
import { StaffLogin } from "@/components/portal/staff-login";

const FEATURES: { icon: IconName; title: string; desc: string }[] = [
  { icon: "calendar", title: "One connected system", desc: "OPD, IPD, pharmacy and labs share a single patient record." },
  { icon: "rupee",    title: "Live money view",      desc: "Billing, collections, beds and stock update as they happen." },
  { icon: "check",    title: "Secure sign-in",       desc: "One-time email codes or passwords, with full audit trails." },
  { icon: "users",    title: "A desk for every role", desc: "Reception, doctors, labs, pharmacy and admin each see their own tools." },
];

/**
 * Sign-in for every staff portal. A dark brand shell (tinted by the portal's
 * own accent) with the live-status pill docked in its scooped corner, and the
 * sign-in card on the canvas beside it.
 */
export function AuthScreen({ portalName, portalKey = "reception" }: { portalName: string; portalKey?: string }) {
  return (
    <div className="portal min-h-screen" data-portal={portalKey}>
      <div className="mx-auto grid min-h-screen max-w-[1440px] gap-4 p-3 sm:p-4 lg:grid-cols-[1.05fr_1fr]">
        {/* ---- brand shell: dark, rounded, portal-tinted ---- */}
        <div
          className="relative hidden flex-col justify-between overflow-visible rounded-[36px] p-10 text-white lg:flex xl:p-14"
          style={{ background: "color-mix(in oklab, var(--p-blue-deep) 36%, #0a1413)" }}
        >
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/12 backdrop-blur">
              <Icon name="stethoscope" size={21} />
            </span>
            <span className="font-serif-p text-[22px] font-semibold">Jeeva</span>
            <span className="ml-1 rounded-full border border-white/20 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-white/70">
              {portalName} portal
            </span>
          </div>

          <div className="max-w-xl py-10">
            <h2 className="font-serif-p text-[clamp(34px,3.4vw,48px)] font-medium leading-[1.04]">
              The whole hospital,<br />on one system.
            </h2>
            <p className="mt-4 max-w-md text-[14.5px] leading-relaxed text-white/65">
              From the front desk to the pharmacy counter — appointments, admissions,
              billing and stock, always in sync.
            </p>

            <div className="mt-9 grid gap-3 sm:grid-cols-2">
              {FEATURES.map((f) => (
                <div key={f.title} className="rounded-[20px] bg-white/[0.07] p-4 ring-1 ring-white/10">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/12 text-white/90">
                    <Icon name={f.icon} size={16} />
                  </span>
                  <p className="mt-3 text-[13.5px] font-semibold">{f.title}</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-white/55">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            {/* one calm ECG pulse — the same signature the public site carries */}
            <svg viewBox="0 0 600 28" className="w-full text-white/30" preserveAspectRatio="none" aria-hidden>
              <path
                d="M0 14 H250 l8 -5 8 5 12 0 7 -10 9 18 7 -12 5 4 H600"
                stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"
              />
            </svg>
            <p className="mt-4 text-[12px] text-white/40">Jeeva Hospital ERP · Secure staff access</p>
          </div>

          {/* live-status pill docked in the scooped corner */}
          <div className="scoop scoop-br">
            <span className="flex items-center gap-2.5 rounded-t-full bg-white py-3 pl-4 pr-5 shadow-[var(--p-shadow)]">
              <span className="relative flex h-2 w-2" aria-hidden>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--p-cyan)] opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--p-cyan)]" />
              </span>
              <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--p-ink)]">All systems live</span>
            </span>
          </div>
        </div>

        {/* ---- sign-in side ---- */}
        <div className="flex items-center justify-center px-2 py-10 sm:px-6">
          <div className="w-full max-w-lg">
            <div className="mb-6 flex items-center gap-2.5 lg:hidden">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--p-blue)] text-white">
                <Icon name="stethoscope" size={17} />
              </span>
              <span className="font-serif-p text-xl font-semibold text-[var(--p-ink)]">Jeeva</span>
            </div>
            <StaffLogin portalName={portalName} />
            <p className="mt-5 text-center text-[12px] text-[var(--p-muted)]">
              Trouble signing in? Ask your administrator — accounts are created at the admin desk.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
