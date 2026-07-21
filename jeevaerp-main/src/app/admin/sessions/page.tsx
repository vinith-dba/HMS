"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/portal/ui/icons";
import { Spinner } from "@/components/portal/ui/form-atoms";
import { PortalScroll } from "@/components/portal/portal-scroll";
import { api, ApiClientError } from "@/lib/api-client";

interface Session {
  id: string; name: string; role: string; method: string;
  ipAddress: string | null; loginAt: string; logoutAt: string | null; durationMin: number | null;
}

const ROLE_LABEL: Record<string, string> = { ADMIN: "Admin", RECEPTIONIST: "Reception", DOCTOR: "Doctor", LAB_TECH: "Lab", PHARMACIST: "Pharmacy" };
const dt = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const dur = (min: number | null) => {
  if (min == null) return null;
  const h = Math.floor(min / 60), m = min % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
};

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState("ALL");

  useEffect(() => {
    api.get<{ sessions: Session[] }>("/admin/sessions")
      .then((r) => setSessions(r.sessions))
      .catch((e) => setError(e instanceof ApiClientError ? e.message : "Couldn't load sessions."))
      .finally(() => setLoading(false));
  }, []);

  const shown = useMemo(() => (role === "ALL" ? sessions : sessions.filter((s) => s.role === role)), [sessions, role]);
  const activeNow = sessions.filter((s) => !s.logoutAt).length;
  const roles = ["ALL", "ADMIN", "RECEPTIONIST", "DOCTOR", "LAB_TECH", "PHARMACIST"];

  return (
    <PortalScroll>
      {/* header shell */}
      <div data-rise className="relative mb-6 rounded-[24px] bg-[#0b201d] px-7 py-7 text-white sm:px-9">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-[#7fcab8]">Access log</p>
        <h1 className="mt-2 font-serif-p text-[clamp(24px,3vw,32px)] font-semibold">Login activity</h1>
        <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-white/60">
          Who signed in, from where, and for how long. Sessions open at sign-in and close at sign-out —
          anything without a sign-out time is still on the desk right now.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <span className="rounded-full bg-white/10 px-3.5 py-1.5 font-mono text-[11.5px] text-white/85">{sessions.length} sessions logged</span>
          <span className="rounded-full bg-[#12a150]/25 px-3.5 py-1.5 font-mono text-[11.5px] text-[#9fe3cd]">{activeNow} signed in now</span>
        </div>
      </div>

      {error && <div className="mb-4 rounded-lg border border-[var(--p-rose)]/25 bg-[var(--p-rose-soft)] px-4 py-2.5 text-[13px] text-[var(--p-rose)]">{error}</div>}

      {/* role filter */}
      <div data-rise className="mb-4 flex flex-wrap gap-1 rounded-full border border-[var(--p-border)] bg-white p-1">
        {roles.map((r) => (
          <button key={r} onClick={() => setRole(r)}
            className={`rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors ${role === r ? "bg-[var(--p-blue)] text-white" : "text-[var(--p-muted)] hover:text-[var(--p-ink)]"}`}>
            {r === "ALL" ? "Everyone" : ROLE_LABEL[r] ?? r}
          </button>
        ))}
      </div>

      <section data-rise className="surface overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-[var(--p-muted)]"><Spinner /> Loading…</div>
        ) : shown.length === 0 ? (
          <div className="py-16 text-center text-[13px] text-[var(--p-muted)]">No sessions recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-[var(--p-border)] bg-[var(--p-bg)] text-left text-[10.5px] font-semibold uppercase tracking-wide text-[var(--p-muted)]">
                  <th className="px-6 py-3">Staff</th>
                  <th className="px-4 py-3">Signed in</th>
                  <th className="px-4 py-3">Signed out</th>
                  <th className="px-4 py-3">On for</th>
                  <th className="px-4 py-3">Via</th>
                  <th className="px-4 py-3">IP</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((s) => (
                  <tr key={s.id} className="border-b border-[var(--p-border)] last:border-0 hover:bg-[var(--p-bg)]">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--p-blue-soft)] text-[11px] font-bold text-[var(--p-blue)]">
                          {s.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                        </span>
                        <div>
                          <div className="font-medium text-[var(--p-ink)]">{s.name}</div>
                          <div className="text-[11px] text-[var(--p-muted)]">{ROLE_LABEL[s.role] ?? s.role}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-[12px] text-[var(--p-ink)]">{dt(s.loginAt)}</td>
                    <td className="px-4 py-3 font-mono text-[12px]">
                      {s.logoutAt
                        ? <span className="text-[var(--p-ink)]">{dt(s.logoutAt)}</span>
                        : <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--p-cyan-soft)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--p-cyan-deep)]"><span className="h-1.5 w-1.5 rounded-full bg-[var(--p-cyan-deep)]" /> On now</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-[12px] text-[var(--p-text)]">{dur(s.durationMin) ?? "—"}</td>
                    <td className="px-4 py-3 text-[12px] text-[var(--p-muted)]">{s.method === "OTP" ? "Email code" : "Password"}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-[var(--p-muted)]">{s.ipAddress ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </PortalScroll>
  );
}
