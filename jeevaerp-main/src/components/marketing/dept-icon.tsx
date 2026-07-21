import type { ReactNode } from "react";

/** Minimal line icons, one per department. Stroke inherits currentColor. */
const ICONS: Record<string, ReactNode> = {
  Cardiology: (
    <>
      <path d="M12 20.5C6.5 16 3.5 12.4 3.5 9.1A4.6 4.6 0 0 1 12 6.6a4.6 4.6 0 0 1 8.5 2.5c0 3.3-3 6.9-8.5 11.4Z" />
      <path d="M7.5 12h2l1.3-2.6 2 4.6 1.4-2h2.3" />
    </>
  ),
  Orthopaedics: (
    <>
      <circle cx="6.7" cy="9.4" r="2.1" />
      <circle cx="9.4" cy="6.7" r="2.1" />
      <circle cx="14.6" cy="17.3" r="2.1" />
      <circle cx="17.3" cy="14.6" r="2.1" />
      <path d="M8.7 8.7l6.6 6.6" strokeWidth="2.6" />
    </>
  ),
  Gynaecology: (
    <>
      <circle cx="12" cy="8.5" r="4.8" />
      <path d="M12 13.3V21M8.5 17.5h7" />
    </>
  ),
  Paediatrics: (
    <>
      <circle cx="12" cy="13.5" r="5.8" />
      <circle cx="6.8" cy="6.8" r="2.2" />
      <circle cx="17.2" cy="6.8" r="2.2" />
      <path d="M10 12.6h.01M14 12.6h.01" strokeWidth="2.2" />
      <path d="M9.8 15.6c1.2 1.2 3.2 1.2 4.4 0" />
    </>
  ),
  "General Medicine": (
    <>
      <path d="M6 3.5v5a4.5 4.5 0 0 0 9 0v-5" />
      <path d="M10.5 12.9V16a4 4 0 0 0 8 0v-1.3" />
      <circle cx="18.5" cy="12.6" r="2.1" />
      <path d="M4.6 3.5h2.8M13.6 3.5h2.8" />
    </>
  ),
  Neurology: (
    <>
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24A2.5 2.5 0 0 1 9.5 2Z" />
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24A2.5 2.5 0 0 0 14.5 2Z" />
    </>
  ),
  Dermatology: (
    <>
      <path d="M11.5 4.5c3.2 3.7 4.8 6.2 4.8 8.7a4.8 4.8 0 0 1-9.6 0c0-2.5 1.6-5 4.8-8.7Z" />
      <path d="M18.7 3.6l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6.6-1.4Z" />
    </>
  ),
  ENT: (
    <>
      <path d="M6 8.5a6.5 6.5 0 1 1 13 0c0 6-6 6-6 10a3.5 3.5 0 1 1-7 0" />
      <path d="M15 8.5a2.5 2.5 0 0 0-5 0v1a2 2 0 1 1 0 4" />
    </>
  ),
  /* quick-need extras */
  Fever: (
    <>
      <path d="M10 4.5a2 2 0 0 1 4 0V13a4.5 4.5 0 1 1-4 0V4.5Z" />
      <path d="M12 9.5V16M16.8 5.5h2.7M16.8 8.5h1.7" />
    </>
  ),
  Prevention: (
    <>
      <path d="M12 3.2 19 6v5.1c0 4.4-2.9 7.4-7 8.7-4.1-1.3-7-4.3-7-8.7V6l7-2.8Z" />
      <path d="M12 8.5v6M9 11.5h6" />
    </>
  ),
};

export function DeptIcon({ name, className = "h-6 w-6" }: { name: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {ICONS[name] ?? <path d="M12 5v14M5 12h14" />}
    </svg>
  );
}
