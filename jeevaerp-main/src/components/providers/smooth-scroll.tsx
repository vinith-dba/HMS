"use client";

/**
 * Smooth scrolling is handled by native CSS (`scroll-behavior: smooth`) rather
 * than a JS library. Libraries like Lenis hijack the scroll event, which breaks
 * inner scrollable containers (long lists, modals) and fights the browser.
 * Native scrolling is faster, accessible, and respects prefers-reduced-motion.
 */
export function SmoothScroll({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
