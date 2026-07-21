"use client";

import { useState } from "react";

/**
 * Renders the photo at `src` (drop files into /public/images — see IMAGES.md).
 * Until the file exists, shows a designed placeholder so layouts read
 * correctly. Swapping in real photography requires zero code changes.
 */
export function SmartImage({
  src,
  alt,
  label,
  className = "",
}: {
  src: string;
  alt: string;
  label: string;
  className?: string;
}) {
  const [missing, setMissing] = useState(false);

  if (missing) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`relative flex items-end overflow-hidden bg-gradient-to-br from-ink via-[#16233f] to-blue-deep ${className}`}
      >
        <span
          aria-hidden
          className="absolute top-4 right-5 font-display text-2xl text-blue-tint/70"
        >
          ✳
        </span>
        <div className="p-5">
          <p className="text-[13px] font-medium text-white/90">{label}</p>
          <p className="mt-1 font-mono text-[10px] tracking-wide text-white/50">
            {src}
          </p>
        </div>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      onError={() => setMissing(true)}
      className={`object-cover ${className}`}
    />
  );
}
