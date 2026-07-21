export type IconName =
  | "grid" | "users" | "calendar" | "stethoscope" | "building" | "pill"
  | "flask" | "receipt" | "rupee" | "trend" | "bed" | "search" | "plus"
  | "check" | "logout" | "chevron" | "activity" | "clock" | "alert" | "file" | "printer";

const paths: Record<IconName, React.ReactNode> = {
  grid: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
  users: <><circle cx="9" cy="8" r="3.2"/><path d="M3.5 20c0-3.3 2.7-5 5.5-5s5.5 1.7 5.5 5"/><path d="M16 5.2A3 3 0 0 1 16 11M20.5 20c0-2.6-1.6-4.2-3.8-4.7"/></>,
  calendar: <><rect x="3" y="4.5" width="18" height="16.5" rx="2.5"/><path d="M16 2.5v4M8 2.5v4M3 9.5h18"/></>,
  stethoscope: <><path d="M4.5 3v5a4 4 0 0 0 8 0V3"/><path d="M4.5 3h-1M12.5 3h1"/><path d="M8.5 15v1.5a5 5 0 0 0 10 0V14"/><circle cx="18.5" cy="12" r="2"/></>,
  building: <><rect x="4" y="2.5" width="16" height="19" rx="2"/><path d="M9 21.5v-4h6v4M9 6h1.5M13.5 6H15M9 10h1.5M13.5 10H15M9 14h1.5M13.5 14H15"/></>,
  pill: <><path d="M10.5 20.5 3.5 13.5a5 5 0 0 1 7-7l7 7a5 5 0 0 1-7 7z"/><path d="m8.5 8.5 7 7"/></>,
  flask: <><path d="M9 2.5v6L3.5 19a2 2 0 0 0 1.8 3h13.4a2 2 0 0 0 1.8-3L15 8.5v-6"/><path d="M9 2.5h6M7.5 15h9"/></>,
  receipt: <><path d="M4 2.5h16v19l-3-2-3 2-3-2-3 2-3-2z"/><path d="M8 8h8M8 12h8M8 16h5"/></>,
  rupee: <><path d="M6 3.5h12M6 8.5h12M6 13l8.5 8M6 13h3a5 5 0 0 0 0-9.5"/></>,
  trend: <><path d="M22 7 13.5 15.5l-5-5L2 17"/><path d="M16 7h6v6"/></>,
  bed: <><path d="M3 8v12M3 12h18a0 0 0 0 1 0 0v8M3 16h18"/><path d="M21 20v-8a4 4 0 0 0-4-4H9v4"/><circle cx="7" cy="12" r="1.5"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></>,
  plus: <><path d="M12 5v14M5 12h14"/></>,
  check: <><path d="M20 6 9 17l-5-5"/></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/></>,
  chevron: <><path d="m9 18 6-6-6-6"/></>,
  activity: <><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  alert: <><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h16.9a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></>,
  file: <><path d="M14 2.5H6a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8.5z"/><path d="M14 2.5v6h6"/></>,
  printer: <><path d="M6 8.5V3h12v5.5"/><rect x="3" y="8.5" width="18" height="8" rx="1.5"/><rect x="6" y="13.5" width="12" height="7.5" rx="1"/></>,
};

export function Icon({ name, size = 18, className = "" }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden>
      {paths[name]}
    </svg>
  );
}