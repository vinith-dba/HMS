"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/portal/ui/icons";
import { CommandBar } from "@/components/portal/shell/command-bar";
import type { NavItem } from "@/lib/portal/nav";
import { PORTALS } from "@/lib/portal/nav";
import { api } from "@/lib/api-client";

export function PortalShell({
  portalKey, userName, title, children,
}: { portalKey: string; userName: string; title: string; children: React.ReactNode }) {
  const meta = PORTALS[portalKey];
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // pathname arrives rewritten as /reception/... — strip the portal prefix to match nav hrefs.
  const localPath = pathname.replace(new RegExp(`^/${portalKey}`), "") || "/";

  const [me, setMe] = useState<{ name: string; role: string } | null>(null);
  useEffect(() => {
    if (localPath === "/login") return;
    api.get<{ name: string; role: string }>("/auth/me").then(setMe).catch(() => {});
  }, [localPath]);

  const displayName = me?.name ?? userName;
  const firstName = displayName.split(" ")[0] || displayName;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  // The sign-in screen carries its own full-screen layout — no sidebar or topbar.
  if (localPath === "/login") return <>{children}</>;

  async function logout() {
    try { await api.post("/auth/logout"); } catch { /* ignore */ }
    window.location.assign("/login");
  }

  const initials = displayName.split(" ").map((n) => n[0]).slice(0, 2).join("");

  const isActive = (href: string) =>
    href === "/" ? localPath === "/" : localPath.startsWith(href);

  const NavRow = ({ item }: { item: NavItem }) => {
    const active = isActive(item.href);
    return (
      <Link
        href={item.href}
        onClick={() => setOpen(false)}
        title={item.hint}
        className={`group relative flex items-start gap-3 rounded-sm px-3 py-2.5 transition-all duration-200 ${
          active
            ? "bg-[var(--p-blue-soft)] text-[var(--p-blue)]"
            : "text-[var(--p-text)] hover:bg-[var(--p-blue-soft)]/60 hover:text-[var(--p-ink)]"
        }`}
      >
        <span
          className={`absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full bg-[var(--p-blue)] transition-all duration-200 ${
            active ? "opacity-100" : "opacity-0 group-hover:opacity-40"
          }`}
        />
        <span className="mt-[1px] shrink-0"><Icon name={item.icon} size={17} /></span>
        <span className="min-w-0">
          <span className={`block text-[13.5px] leading-tight ${active ? "font-semibold" : "font-medium"}`}>
            {item.label}
          </span>
          {/* the hint is the teaching: a new receptionist learns the flow by reading the sidebar */}
          {item.hint && (
            <span className="mt-0.5 block text-[11.5px] leading-snug text-[var(--p-muted)]">{item.hint}</span>
          )}
        </span>
      </Link>
    );
  };

  const NavLinks = () => (
    <nav className="flex flex-col gap-4 mt-4 px-3 pb-4">
      {meta.groups
        ? meta.groups.map((g) => (
            <div key={g.title}>
              <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-tight border-b border-[var(--p-border)] text-[var(--p-muted)]">
                {g.title}
              </p>
              <div className="flex flex-col gap-0.5">
                {g.items.map((item) => <NavRow key={item.href} item={item} />)}
              </div>
            </div>
          ))
        : (
            <div className="flex flex-col gap-0.5">
              {meta.nav.map((item) => <NavRow key={item.href} item={item} />)}
            </div>
          )}
    </nav>
  );

  return (
    /* data-portal lets one portal carry its own skin without leaking into the
       others — the pharmacy's glass theme is scoped to [data-portal="pharmacy"]. */
    <div className="portal min-h-screen" data-portal={meta.key}>
      <div className="flex min-h-screen">
        {/* ---- Sidebar: frosted glass, light ---- */}
        <aside className="glass sticky top-0 hidden h-screen w-[336px] shrink-0 flex-col border-r border-[var(--p-border)] md:flex">
          <div className="flex items-center gap-2.5 px-6 py-5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--p-blue)] text-white shadow-[0_4px_12px_-4px_var(--p-blue-glow)]">
              <Icon name="stethoscope" size={17} />
            </span>
            <span className="font-serif-p text-[17px] font-semibold text-[var(--p-ink)]">{meta.brand}</span>
          </div>

          <div className="mb-2 px-6 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--p-muted)]">
            {meta.roleLabel}
          </div>

          <NavLinks />

          <div className="flex-1" />

          {/* user card */}
          <div className="mx-3 mb-3 rounded-xl border border-[var(--p-border)] bg-white/70 p-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[var(--p-blue)] to-[var(--p-cyan)] text-[12px] font-semibold text-white">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium text-[var(--p-ink)]">{displayName}</div>
                <div className="text-[11px] text-[var(--p-muted)]">{meta.roleLabel}</div>
              </div>
            </div>
            <button
              onClick={logout}
              className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--p-border)] py-1.5 text-[13px] font-medium text-[var(--p-muted)] transition-colors hover:border-[var(--p-rose)]/40 hover:text-[var(--p-rose)]"
            >
              <Icon name="logout" size={13} /> Sign out
            </button>
          </div>
        </aside>

        {/* ---- Main ---- */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* sticky glass topbar — content blurs under it as you scroll */}
          <header className="glass sticky top-0 z-30 flex items-center justify-between border-b border-[var(--p-border)] px-5 py-3.5 md:px-8">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setOpen((v) => !v)}
                className="rounded-lg border border-[var(--p-border)] p-1.5 text-[var(--p-ink)] md:hidden"
                aria-label="Menu"
              >
                <Icon name="grid" size={18} />
              </button>
              <h1 className="font-serif-p text-[19px] font-semibold text-[var(--p-ink)]">{localPath === "/" ? `${greeting}, ${firstName}` : title}</h1>
            </div>

            <div className="flex items-center gap-3">
              {/* one keystroke to anyone, from any screen — the desk's single busiest move */}
              <CommandBar portal={meta.key} />
              <span className="hidden items-center gap-1.5 rounded-full border border-[var(--p-border)] bg-white/60 px-3 py-1 text-[12px] font-medium text-[var(--p-muted)] xl:inline-flex">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--p-cyan)]" />
                Live
              </span>
              <div className="hidden text-right sm:block">
                <div className="text-[13px] font-semibold leading-tight text-[var(--p-ink)]">{displayName}</div>
                <div className="text-[11px] text-[var(--p-muted)]">{meta.roleLabel}</div>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[var(--p-blue)] to-[var(--p-cyan)] text-[13px] font-semibold text-white shadow-[0_4px_12px_-4px_var(--p-blue-glow)]">
                {initials}
              </div>
            </div>
          </header>

          {/* Mobile nav drawer */}
          {open && (
            <div className="glass border-b border-[var(--p-border)] py-3 md:hidden">
              <NavLinks />
              <div className="mt-2 border-t border-[var(--p-border)] px-3 pt-2">
                <button onClick={logout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] text-[var(--p-muted)] hover:text-[var(--p-rose)]">
                  <Icon name="logout" size={16} /> Sign out
                </button>
              </div>
            </div>
          )}

          <main className="flex-1 px-5 py-6 md:px-8 md:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
