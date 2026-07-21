"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/portal/ui/icons";
import { Spinner } from "@/components/portal/ui/form-atoms";
import { PortalScroll } from "@/components/portal/portal-scroll";
import { api, ApiClientError } from "@/lib/api-client";

interface PatientRow {
  id: string; displayId: string; fullName: string; age: number | null;
  bloodGroup: string | null; phone: string; city: string | null; createdAt: string;
}
const inits = (n: string) => n.split(" ").map((x) => x[0]).slice(0, 2).join("");

export default function PatientsPage() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<PatientRow[]>([]);
  // ── DUPLICATES ──
  // Same person, two UHIDs. Their history is split, so a doctor checking
  // allergies sees half of it. Not an admin annoyance — a clinical hazard.
  interface DupPatient {
    id: string; displayId: string; fullName: string; age: number | null;
    gender: string | null; createdAt: string; visits: number; bills: number; admitted: boolean;
  }
  interface DupGroup { phone: string; patients: DupPatient[] }

  const [dups, setDups] = useState<DupGroup[]>([]);
  const [merging, setMerging] = useState<{ group: DupGroup; keepId: string } | null>(null);
  const [mergeReason, setMergeReason] = useState("");
  const [mergeBusy, setMergeBusy] = useState(false);
  const [mergeFlash, setMergeFlash] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDups = async () => {
    try {
      const { groups } = await api.get<{ groups: DupGroup[] }>("/reception/duplicates");
      setDups(groups);
    } catch { setDups([]); }
  };
  useEffect(() => { loadDups(); }, []);

  async function doMerge() {
    if (!merging) return;
    const other = merging.group.patients.find((p) => p.id !== merging.keepId);
    if (!other) return;
    setMergeBusy(true);
    try {
      const r = await api.post<{ kept: string; merged: string; moved: { visits: number; bills: number; tests: number; prescriptions: number; admissions: number } }>(
        "/reception/duplicates",
        { keepId: merging.keepId, mergeId: other.id, reason: mergeReason.trim() }
      );
      const m = r.moved;
      setMergeFlash(
        `${r.merged} folded into ${r.kept}. Moved ${m.visits} visit(s), ${m.bills} bill(s), ` +
        `${m.tests} test(s), ${m.prescriptions} prescription(s), ${m.admissions} admission(s).`
      );
      setMerging(null); setMergeReason("");
      await loadDups();
    } catch (e) {
      setMergeFlash(e instanceof ApiClientError ? e.message : "Could not merge.");
    } finally { setMergeBusy(false); }
  }

  useEffect(() => {
    let active = true; setLoading(true);
    const t = setTimeout(async () => {
      try {
        const { patients } = await api.get<{ patients: PatientRow[] }>(`/reception/patients?q=${encodeURIComponent(q)}&limit=30`);
        if (active) setRows(patients);
      } catch { if (active) setRows([]); } finally { if (active) setLoading(false); }
    }, 250);
    return () => { active = false; clearTimeout(t); };
  }, [q]);

  return (
    <PortalScroll>
      {mergeFlash && (
        <div data-rise className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-[var(--p-cyan)]/30 bg-[var(--p-cyan-soft)] px-4 py-3 text-[13px] text-[var(--p-cyan-deep)]">
          <span>{mergeFlash}</span>
          <button onClick={() => setMergeFlash(null)}>✕</button>
        </div>
      )}

      {/* ─────────── POSSIBLE DUPLICATES ───────────
          Same phone, two UHIDs. Almost always one person registered twice —
          once at a walk-in, once in an emergency by a different clerk. Their
          history is split, so a doctor checking allergies sees half of it. */}
      {dups.length > 0 && (
        <section data-rise className="surface mb-5 overflow-hidden border-[var(--p-amber)]/35">
          <div className="border-b border-[var(--p-border)] bg-[var(--p-amber-soft)] px-5 py-3.5">
            <h2 className="flex items-center gap-2 text-[14px] font-semibold text-[#8a6414]">
              <Icon name="alert" size={15} />
              {dups.length} possible duplicate{dups.length === 1 ? "" : "s"}
            </h2>
            <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--p-text)]">
              Same phone number, different Jeeva IDs. If it&apos;s one person, their history is
              currently <b>split across two records</b> — a doctor checking allergies would see
              only half of it.
            </p>
          </div>

          <div className="divide-y divide-[var(--p-border)]">
            {dups.map((g) => (
              <div key={g.phone} className="px-5 py-4">
                <p className="mb-2.5 font-mono text-[12px] font-semibold text-[var(--p-muted)]">{g.phone}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {g.patients.map((p, i) => (
                    <div key={p.id} className="rounded-lg border border-[var(--p-border)] px-3.5 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-semibold text-[var(--p-ink)]">{p.fullName}</span>
                        {i === 0 && (
                          <span className="rounded bg-[var(--p-teal-soft)] px-1.5 py-0.5 text-[10px] font-bold uppercase text-[var(--p-teal-deep)]">
                            Older
                          </span>
                        )}
                        {p.admitted && (
                          <span className="rounded bg-[var(--p-blue-soft)] px-1.5 py-0.5 text-[10px] font-bold uppercase text-[var(--p-blue)]">
                            Admitted
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 font-mono text-[12px] text-[var(--p-muted)]">{p.displayId}</div>
                      <div className="mt-1 text-[12px] text-[var(--p-muted)]">
                        {p.visits} visit{p.visits === 1 ? "" : "s"} · {p.bills} bill{p.bills === 1 ? "" : "s"} ·
                        since {new Date(p.createdAt).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
                      </div>
                    </div>
                  ))}
                </div>

                {g.patients.some((p) => p.admitted) ? (
                  <p className="mt-3 rounded-lg bg-[var(--p-bg)] px-3 py-2 text-[12px] text-[var(--p-muted)]">
                    One of these is <b>currently admitted</b>. Merging would move their identity out from
                    under a live admission — discharge them first.
                  </p>
                ) : g.patients.length === 2 ? (
                  <button
                    onClick={() => { setMerging({ group: g, keepId: g.patients[0].id }); setMergeReason(""); }}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[var(--p-amber)]/50 px-3.5 py-2 text-[13px] font-semibold text-[#8a6414] transition-colors hover:bg-[var(--p-amber-soft)]">
                    <Icon name="users" size={14} /> These are the same person — merge
                  </button>
                ) : (
                  <p className="mt-3 text-[12px] text-[var(--p-muted)]">
                    Three or more records on one number. Merge them two at a time.
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─────────── MERGE ─────────── */}
      {merging && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setMerging(null)}>
          <div onClick={(e) => e.stopPropagation()} className="surface w-full max-w-lg overflow-hidden">
            <div className="border-b border-[var(--p-border)] px-5 py-4">
              <h3 className="text-[15px] font-semibold text-[var(--p-ink)]">Merge two records</h3>
              <p className="mt-0.5 text-[12px] text-[var(--p-muted)]">
                Pick the one to <b>keep</b>. Everything from the other moves into it.
              </p>
            </div>

            <div className="space-y-4 p-5">
              <div className="space-y-2">
                {merging.group.patients.map((p, i) => {
                  const keep = merging.keepId === p.id;
                  return (
                    <button key={p.id} onClick={() => setMerging({ ...merging, keepId: p.id })}
                      className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-all ${
                        keep
                          ? "border-[var(--p-teal)] bg-[var(--p-teal-soft)] shadow-[0_0_0_3px_var(--p-teal-glow,rgba(0,150,136,.15))]"
                          : "border-[var(--p-border)] hover:border-[var(--p-border-strong)]"}`}>
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="text-[14px] font-semibold text-[var(--p-ink)]">{p.fullName}</span>
                          {i === 0 && <span className="text-[10px] font-bold uppercase text-[var(--p-muted)]">older</span>}
                        </span>
                        <span className="block font-mono text-[12px] text-[var(--p-muted)]">{p.displayId}</span>
                        <span className="block text-[12px] text-[var(--p-muted)]">
                          {p.visits} visits · {p.bills} bills
                        </span>
                      </span>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase ${
                        keep ? "bg-[var(--p-teal)] text-white" : "bg-[var(--p-bg)] text-[var(--p-muted)]"}`}>
                        {keep ? "Keep this" : "Merge away"}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="rounded-lg bg-[var(--p-rose-soft)] px-4 py-3">
                <p className="text-[12px] leading-relaxed text-[var(--p-rose)]">
                  <b>This cannot be undone.</b> Every visit, bill, lab test, prescription and admission
                  moves onto the record you keep. The other Jeeva ID stops working — anyone who quotes
                  it will be told it doesn&apos;t exist.
                </p>
                <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--p-text)]">
                  Nothing is deleted. The old record stays in the audit trail forever, with your name on it.
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-[var(--p-text)]">
                  Why are you sure these are the same person?
                </label>
                <input value={mergeReason} onChange={(e) => setMergeReason(e.target.value)}
                  placeholder="Same phone, same DOB, confirmed with the patient"
                  className="w-full rounded-lg border border-[var(--p-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--p-teal)]" />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[var(--p-border)] bg-[var(--p-bg)] px-5 py-3">
              <button onClick={() => setMerging(null)} className="rounded-lg px-4 py-2 text-[13px] font-medium text-[var(--p-muted)] hover:text-[var(--p-ink)]">
                Cancel
              </button>
              <button onClick={doMerge} disabled={mergeBusy || mergeReason.trim().length < 3}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--p-rose)] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-40">
                {mergeBusy ? <><Spinner /> Merging…</> : <>Merge — permanently</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <div data-rise className="surface dotgrid mb-6 px-6 py-5">
        <h1 className="font-serif-p text-[22px] font-semibold text-[var(--p-ink)]">Patients</h1>
        <p className="mt-1 text-[14px] text-[var(--p-muted)]">Search the register. Click a patient to view, edit, or bill them.</p>
        <div className="mt-4 flex max-w-md items-center gap-2 rounded-lg border border-[var(--p-border)] bg-white px-3.5 py-2.5">
          <Icon name="search" size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, Jeeva ID or phone…" className="w-full text-sm outline-none" autoFocus />
          {loading && <Spinner size={14} />}
        </div>
      </div>

      <section data-rise className="surface overflow-hidden">
        {loading && rows.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-16 text-[14px] text-[var(--p-muted)]"><Spinner /> Loading…</div>
        ) : rows.length === 0 ? (
          <p className="py-16 text-center text-[14px] text-[var(--p-muted)]">No patients found.</p>
        ) : (
          <div className="divide-y divide-[var(--p-border)]">
            {rows.map((p) => (
              <Link key={p.id} href={`/patients/${p.displayId}`} className="flex items-center justify-between gap-3 px-6 py-3.5 transition-colors hover:bg-[var(--p-bg)]">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--p-teal-soft)] font-serif-p text-[13px] font-semibold text-[var(--p-teal)]">{inits(p.fullName)}</div>
                  <div>
                    <div className="text-[14px] font-medium text-[var(--p-ink)]">{p.fullName}</div>
                    <div className="text-[13px] text-[var(--p-muted)]">
                      <span className="tabular">{p.displayId}</span> · {p.phone}
                      {p.age != null && ` · ${p.age}y`}{p.bloodGroup && ` · ${p.bloodGroup}`}{p.city && ` · ${p.city}`}
                    </div>
                  </div>
                </div>
                <Icon name="chevron" size={16} />
              </Link>
            ))}
          </div>
        )}
      </section>
    </PortalScroll>
  );
}
