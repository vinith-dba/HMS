"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon, type IconName } from "@/components/portal/ui/icons";
import { Spinner } from "@/components/portal/ui/form-atoms";
import { api } from "@/lib/api-client";

/**
 * THE COMMAND BAR — ⌘K / Ctrl+K, or click the search box.
 *
 * A front desk is a queue of interruptions. Somebody walks up mid-task and says
 * a name. Before this, finding them meant: stop, look at the sidebar, decide
 * which of nine pages is right, navigate, search again. Now it's one keystroke
 * from any screen, and the RESULT carries the actions — book, check in, upload
 * an Rx, admit — so the receptionist never has to know which page owns which verb.
 *
 * Deliberately searches PATIENTS, not pages. Staff don't think "I need the
 * prescriptions page"; they think "Ramesh Kumar is standing here."
 */

interface Patient {
  id: string; displayId: string; fullName: string; phone: string;
  age?: number | null; gender?: string | null;
}

/** What a PHARMACIST is actually asking when they search. */
interface Med {
  id: string; name: string; unit: string; inStock: number;
  rackLocation: string | null; nearestExpiry: string | null;
  lowStock: boolean; courseCritical: boolean;
}

interface Action { label: string; href: string; icon: IconName; hint: string; }

/** Days until a batch expires — negative means it's already dead on the shelf. */
function daysTo(iso: string | null): number | null {
  if (!iso) return null;
  const d = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
  return Number.isFinite(d) ? d : null;
}

/** What you can do TO a patient — the verbs, in the order the desk uses them. */
const patientActions = (uhid: string): Action[] => [
  { label: "Open patient file", href: `/patients/${uhid}`, icon: "search", hint: "History, visits, bills" },
  { label: "Book appointment",  href: `/book?patient=${uhid}`, icon: "calendar", hint: "Pick a doctor & slot" },
  { label: "Upload prescription", href: `/prescriptions?patient=${uhid}`, icon: "file", hint: "Scan the doctor's chit" },
  { label: "Order lab tests",   href: `/labs?patient=${uhid}`, icon: "flask", hint: "Take payment too" },
  { label: "Admit to a bed",    href: `/ipd?patient=${uhid}`, icon: "bed", hint: "Inpatient admission" },
];

/** Jump targets when nothing is typed yet — different job, different verbs. */
const QUICK_RECEPTION: Action[] = [
  { label: "Register a new patient", href: "/register", icon: "users", hint: "First visit → gives them a UHID" },
  { label: "Book an appointment",    href: "/book", icon: "calendar", hint: "Doctor, slot, fee" },
  { label: "Today's queue",          href: "/", icon: "grid", hint: "Check people in" },
  { label: "Collect a payment",      href: "/billing", icon: "receipt", hint: "Settle a balance, reprint a bill" },
  { label: "Print a blank OPD sheet", href: "/print/opd/blank", icon: "file", hint: "The power-cut fallback" },
];

const QUICK_PHARMACY: Action[] = [
  { label: "Prescription queue", href: "/queue", icon: "file", hint: "Chits waiting to be dispensed" },
  { label: "Walk-in sale",       href: "/dispense", icon: "pill", hint: "Over the counter, no chit" },
  { label: "Stock on the rack",  href: "/stock", icon: "grid", hint: "Add, edit, write off damaged" },
  { label: "Alerts",             href: "/alerts", icon: "alert", hint: "Low, expiring, expired" },
];

export function CommandBar({ portal = "reception" }: { portal?: string }) {
  const isPharmacy = portal === "pharmacy";
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Patient[]>([]);
  const [meds, setMeds] = useState<Med[]>([]);
  const [picked, setPicked] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => {
    setOpen(false); setQ(""); setResults([]); setMeds([]); setPicked(null); setCursor(0);
  }, []);

  // ⌘K / Ctrl+K from anywhere. Escape closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 40);
  }, [open]);

  /**
   * A receptionist searching means "who is standing here?".
   * A pharmacist searching means "do we have it, where is it, is it still good?".
   * Same key, different question — so the bar answers the one the desk is asking.
   */
  useEffect(() => {
    if (picked) return;
    const s = q.trim();
    if (s.length < 2) { setResults([]); setMeds([]); return; }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        if (isPharmacy) {
          const r = await api.get<{ medicines: Med[] }>("/pharmacy/medicines");
          const needle = s.toLowerCase();
          setMeds(r.medicines
            .filter((m) => m.name.toLowerCase().includes(needle))
            .slice(0, 7));
          setResults([]);
        } else {
          const r = await api.get<{ patients: Patient[] }>(`/reception/patients?q=${encodeURIComponent(s)}&limit=6`);
          setResults(r.patients); setMeds([]);
        }
        setCursor(0);
      } catch { setResults([]); setMeds([]); }
      finally { setLoading(false); }
    }, 200);
    return () => clearTimeout(t);
  }, [q, picked, isPharmacy]);

  const rows: Action[] = picked
    ? patientActions(picked.displayId)
    : q.trim().length < 2
      ? (isPharmacy ? QUICK_PHARMACY : QUICK_RECEPTION)
      : [];

  const go = useCallback((href: string) => { close(); router.push(href); }, [close, router]);

  function onKeyDown(e: React.KeyboardEvent) {
    const list = picked || q.trim().length < 2 ? rows.length : (isPharmacy ? meds.length : results.length);
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => (c + 1) % Math.max(1, list)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setCursor((c) => (c - 1 + list) % Math.max(1, list)); }
    if (e.key === "Enter") {
      e.preventDefault();
      if (!picked && results.length > 0) { setPicked(results[cursor]); setCursor(0); return; }
      if (rows[cursor]) go(rows[cursor].href);
    }
    if (e.key === "Backspace" && picked && q === "") setPicked(null);
  }

  return (
    <>
      {/* the always-visible trigger — nobody discovers a shortcut they can't see */}
      <button onClick={() => setOpen(true)}
        className="flex min-w-[190px] items-center gap-2.5 rounded-lg border border-[var(--p-border)] bg-[var(--p-surface)] px-3.5 py-2 text-left transition-colors hover:border-[var(--p-blue)] lg:min-w-[280px]">
        <Icon name="search" size={15} />
        <span className="flex-1 text-[14px] text-[var(--p-muted)]">Find anyone…</span>
        <kbd className="hidden rounded border border-[var(--p-border)] bg-[var(--p-bg)] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[var(--p-muted)] lg:block">
          ⌘K
        </kbd>
      </button>

      {!open ? null : (
        <div className="fixed inset-0 z-[60] flex items-start justify-center bg-[rgba(9,26,52,0.45)] p-4 pt-[12vh] backdrop-blur-sm"
          onClick={close}>
          <div onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--p-border)] bg-[var(--p-surface)] shadow-[var(--p-shadow-lg)]">

            {/* input */}
            <div className="flex items-center gap-3 border-b border-[var(--p-border)] px-4 py-3.5">
              {picked ? (
                <span className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--p-blue-soft)] px-2.5 py-1 text-[14px] font-semibold text-[var(--p-blue)]">
                  {picked.fullName}
                  <button onClick={() => { setPicked(null); setCursor(0); }} className="text-[var(--p-muted)] hover:text-[var(--p-ink)]">✕</button>
                </span>
              ) : (
                <Icon name="search" size={17} />
              )}
              <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKeyDown}
                placeholder={picked ? "What do you need to do?" : isPharmacy ? "Medicine name…" : "Name, phone or UHID…"}
                className="w-full bg-transparent text-[15px] text-[var(--p-ink)] outline-none placeholder:text-[var(--p-muted)]" />
              {loading && <Spinner size={14} />}
            </div>

            <div className="max-h-[52vh] overflow-y-auto">
              {/* MEDICINE matches — rack, stock and expiry are the whole answer.
                  Deliberately opaque and high-contrast: a pharmacist reading a
                  strength through frosted glass is how the wrong box gets handed over. */}
              {!picked && isPharmacy && meds.length > 0 && (
                <>
                  <p className="px-4 pt-3 text-[10px] font-bold uppercase tracking-wider text-[var(--p-muted)]">On the shelf</p>
                  {meds.map((m, i) => {
                    const d = daysTo(m.nearestExpiry);
                    const dead = d !== null && d < 0;
                    const soon = d !== null && d >= 0 && d <= 60;
                    return (
                      <button key={m.id} onClick={() => go(`/stock?q=${encodeURIComponent(m.name)}`)}
                        onMouseEnter={() => setCursor(i)}
                        className={`flex w-full items-center gap-3 px-4 py-2.5 text-left ${i === cursor ? "bg-[var(--p-blue-soft)]" : ""}`}>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate text-[14px] font-semibold text-[var(--p-ink)]">{m.name}</span>
                            {m.courseCritical && (
                              <span className="shrink-0 rounded bg-[var(--p-rose-soft)] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[var(--p-rose)]">
                                Full course
                              </span>
                            )}
                          </span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-x-2.5 text-[12px]">
                            {m.rackLocation && (
                              <span className="font-mono font-semibold text-[var(--p-blue)]">Rack {m.rackLocation}</span>
                            )}
                            <span className={m.inStock === 0 ? "font-semibold text-[var(--p-rose)]" : m.lowStock ? "font-semibold text-[var(--p-amber)]" : "text-[var(--p-muted)]"}>
                              {m.inStock === 0 ? "OUT OF STOCK" : `${m.inStock} ${m.unit}${m.inStock === 1 ? "" : "s"}`}
                            </span>
                            {dead ? (
                              <span className="font-semibold text-[var(--p-rose)]">EXPIRED — pull it</span>
                            ) : soon ? (
                              <span className="font-semibold text-[var(--p-amber)]">expires in {d}d</span>
                            ) : d !== null ? (
                              <span className="text-[var(--p-muted)]">good for {d}d</span>
                            ) : null}
                          </span>
                        </span>
                        <span className="shrink-0 text-[11px] text-[var(--p-muted)]">↵ open</span>
                      </button>
                    );
                  })}
                </>
              )}

              {!picked && isPharmacy && q.trim().length >= 2 && !loading && meds.length === 0 && (
                <p className="px-4 py-8 text-center text-[13px] text-[var(--p-muted)]">
                  Nothing on the shelf by that name.
                </p>
              )}

              {/* patient matches */}
              {!picked && !isPharmacy && results.length > 0 && (
                <>
                  <p className="px-4 pt-3 text-[11px] font-bold uppercase tracking-wider text-[var(--p-muted)]">Patients</p>
                  {results.map((p, i) => (
                    <button key={p.id} onClick={() => { setPicked(p); setCursor(0); }}
                      onMouseEnter={() => setCursor(i)}
                      className={`flex w-full items-center justify-between px-4 py-2.5 text-left ${i === cursor ? "bg-[var(--p-blue-soft)]" : ""}`}>
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-medium text-[var(--p-ink)]">{p.fullName}</span>
                        <span className="block text-[13px] text-[var(--p-muted)]">
                          <span className="font-mono">{p.displayId}</span> · {p.phone}
                          {p.age != null && ` · ${p.age}y`}
                        </span>
                      </span>
                      <span className="ml-2 shrink-0 text-[12px] text-[var(--p-muted)]">↵ pick</span>
                    </button>
                  ))}
                </>
              )}

              {!picked && !isPharmacy && q.trim().length >= 2 && !loading && results.length === 0 && (
                <div className="px-4 py-8 text-center">
                  <p className="text-[14px] text-[var(--p-muted)]">Nobody by that name yet.</p>
                  <button onClick={() => go("/register")}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[var(--p-blue)] px-4 py-2 text-[14px] font-semibold text-white">
                    <Icon name="plus" size={14} /> Register them
                  </button>
                </div>
              )}

              {/* actions — either for the picked patient, or the quick jumps */}
              {rows.length > 0 && (
                <>
                  <p className="px-4 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wider text-[var(--p-muted)]">
                    {picked ? `What next for ${picked.fullName.split(" ")[0]}?` : "Jump to"}
                  </p>
                  {rows.map((a, i) => (
                    <button key={a.href} onClick={() => go(a.href)} onMouseEnter={() => setCursor(i)}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left ${i === cursor ? "bg-[var(--p-blue-soft)]" : ""}`}>
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--p-bg)] text-[var(--p-blue)]">
                        <Icon name={a.icon} size={15} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-medium text-[var(--p-ink)]">{a.label}</span>
                        <span className="block truncate text-[13px] text-[var(--p-muted)]">{a.hint}</span>
                      </span>
                      {i === cursor && <span className="shrink-0 text-[12px] text-[var(--p-muted)]">↵</span>}
                    </button>
                  ))}
                </>
              )}
            </div>

            <div className="flex items-center gap-4 border-t border-[var(--p-border)] bg-[var(--p-bg)] px-4 py-2 text-[12px] text-[var(--p-muted)]">
              <span><kbd className="font-mono font-semibold">↑↓</kbd> move</span>
              <span><kbd className="font-mono font-semibold">↵</kbd> select</span>
              <span><kbd className="font-mono font-semibold">esc</kbd> close</span>
              <span className="ml-auto">{isPharmacy ? "Type a medicine name" : "Type a name, phone or UHID"}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
