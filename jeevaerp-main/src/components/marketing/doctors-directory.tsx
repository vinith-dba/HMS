"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Doctor } from "@/lib/data";
import { DoctorAvatar } from "@/components/marketing/doctor-avatar";
import { DEPARTMENTS } from "@/lib/data";

export function DoctorsDirectory({ doctors }: { doctors: Doctor[] }) {
  const [dept, setDept] = useState("All");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return doctors.filter((d) => {
      const inDept = dept === "All" || d.department === dept;
      if (!q) return inDept;
      return inDept && (
        d.name.toLowerCase().includes(q) ||
        d.specialization.toLowerCase().includes(q)
      );
    });
  }, [doctors, dept, query]);

  return (
    <div className="mx-auto max-w-[1200px] px-5 pb-24 lg:px-8">
      {/* filters */}
      <div className="mb-10 flex flex-col gap-4 border-b border-[var(--line)] pb-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {["All", ...DEPARTMENTS.map((d) => d.name)].map((name) => (
            <button key={name} onClick={() => setDept(name)}
              className={`rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition-colors ${
                dept === name
                  ? "border-[var(--teal)] bg-[var(--teal)] text-white"
                  : "border-[var(--line-strong)] text-[var(--ink-soft)] hover:border-[var(--teal)] hover:text-[var(--teal)]"
              }`}>
              {name}
            </button>
          ))}
        </div>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or speciality…"
          className="w-full rounded-full border border-[var(--line-strong)] bg-[var(--paper)] px-4 py-2.5 text-[14px] outline-none transition-colors focus:border-[var(--teal)] lg:w-72"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="py-20 text-center text-[15px] text-[var(--muted)]">
          No doctors match that. Try a different department.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((d) => (
            <Link key={d.id} href={`/book?doctor=${d.id}`} className="card card-hover group flex flex-col overflow-hidden">
              <div className="relative">
                <DoctorAvatar name={d.name} image={d.image} className="aspect-[5/4] w-full text-[28px]" />
                <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-[var(--ink)] shadow-sm backdrop-blur">{d.experience}+ yrs</span>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h3 className="text-[16px] font-semibold text-[var(--ink)]">{d.name}</h3>
                <p className="mt-0.5 text-[13px] font-medium text-[var(--teal)]">{d.specialization}</p>
                <p className="mt-1 text-[12px] text-[var(--muted)]">{d.qualification}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <span className="rounded-full border border-[var(--line)] px-2.5 py-1 text-[11px] font-medium text-[var(--muted)]">{d.department}</span>
                  <span className="rounded-full border border-[var(--line)] px-2.5 py-1 text-[11px] font-medium text-[var(--muted)]">Age {d.age}</span>
                </div>
                <div className="mt-auto flex items-center justify-between border-t border-[var(--line)] pt-3.5 text-[13px]">
                  <span className="text-[var(--muted)]">{d.days} · {d.opd}</span>
                  <span className="font-mono font-semibold text-[var(--ink)]">₹{d.fee}</span>
                </div>
                <span className="mt-3.5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--teal)]">
                  Book appointment <span className="transition-transform group-hover:translate-x-1" aria-hidden>→</span>
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
