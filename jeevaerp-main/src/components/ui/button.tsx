import Link from "next/link";

const styles = {
  dark: "bg-ink text-white hover:bg-blue-deep",
  blue: "bg-blue text-white hover:bg-blue-deep",
  ghost: "border border-line text-ink hover:border-blue hover:text-blue",
  onImage: "border border-white/70 text-white hover:bg-white hover:text-ink",
  inverse: "bg-white text-ink hover:bg-blue-tint",
} as const;

export function ButtonLink({
  href,
  variant = "dark",
  children,
  className = "",
}: {
  href: string;
  variant?: keyof typeof styles;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center gap-2 rounded-md px-6 py-3 text-sm font-medium transition-colors duration-200 ${styles[variant]} ${className}`}
    >
      {children}
    </Link>
  );
}
