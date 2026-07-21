"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/portal/ui/icons";
import { Spinner } from "@/components/portal/ui/form-atoms";
import { PortalScroll } from "@/components/portal/portal-scroll";
import { api } from "@/lib/api-client";

interface Log { id: string; action: string; targetTable: string; createdAt: string; actor: { name: string; role: string } | null; }

export default function AuditPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ logs: Log[] }>("/admin/audit").then((r) => setLogs(r.logs)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <PortalScroll>
      <div data-rise className="surface dotgrid mb-6 px-6 py-5">
        <h1 className="font-serif-p text-[22px] font-semibold text-[var(--p-ink)]">Audit log</h1>
        <p className="mt-1 text-[13px] text-[var(--p-muted)]">Every significant action — who did what, and when. Nothing is deleted.</p>
      </div>

      <section data-rise className="surface overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-[var(--p-muted)]"><Spinner /> Loading…</div>
        ) : logs.length === 0 ? (
          <p className="py-16 text-center text-[13px] text-[var(--p-muted)]">No activity recorded yet.</p>
        ) : (
          <div className="divide-y divide-[var(--p-border)]">
            {logs.map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-3 px-6 py-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--p-teal-soft)] text-[var(--p-teal)]"><Icon name="activity" size={14} /></span>
                  <div>
                    <div className="font-mono text-[12px] font-semibold text-[var(--p-ink)]">{l.action}</div>
                    <div className="text-[11px] text-[var(--p-muted)]">
                      {l.actor ? `${l.actor.name} (${l.actor.role.replace("_", " ")})` : "System"} · {l.targetTable}
                    </div>
                  </div>
                </div>
                <span className="font-mono text-[11px] text-[var(--p-muted)]">{new Date(l.createdAt).toLocaleString("en-IN")}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </PortalScroll>
  );
}
