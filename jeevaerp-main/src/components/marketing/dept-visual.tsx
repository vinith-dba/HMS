"use client";

import { useEffect, useRef, useState } from "react";
import { DeptIcon } from "@/components/marketing/dept-icon";

/**
 * Department photo with a designed fallback: until the file in `src` exists
 * in /public/images, a quiet icon tile renders instead — so dropping real
 * photography in later needs zero code changes.
 */
export function DeptVisual({ name, src, className = "" }: { name: string; src?: string; className?: string }) {
  const [missing, setMissing] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  // The 404 can fire before hydration, so onError alone would miss it.
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setMissing(true);
  }, []);

  if (!src || missing) {
    return (
      <div
        role="img"
        aria-label={name}
        className={`grid place-items-center bg-[var(--teal-soft)] text-[var(--teal)] transition-colors duration-300 group-hover:bg-white/10 group-hover:text-[var(--teal-tint)] ${className}`}
      >
        <DeptIcon name={name} className="h-10 w-10" />
      </div>
    );
  }

  return (
    <img
      ref={ref}
      src={src}
      alt={name}
      loading="lazy"
      onError={() => setMissing(true)}
      className={`object-cover ${className}`}
    />
  );
}
