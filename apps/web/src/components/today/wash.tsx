import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The page's one decorative element (blueprint C8 / §5.1): a white highlight on the gray
 * canvas with a trace of accent at the top-right corner. It renders behind Z2–Z3 only and
 * never over a card, so the work card always reads as the brightest surface on the page.
 */
export function Wash({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      // Placed as the FIRST child of the app shell (a `relative` container), so it paints
      // full-bleed under everything — including the translucent chrome band, which is what
      // gives the band its tint. It stops well above the work card: colour belongs to the
      // greeting, never behind data.
      className={cn("pointer-events-none absolute inset-x-0 top-0 z-0 h-[560px]", className)}
      style={{ background: "var(--wash)" }}
    />
  );
}

/**
 * The container every Today zone sits in: 1200px, centered, 24px gutters, 72px of breath
 * under the chrome. Today SCROLLS (D5) — the one-screen doctrine is for data surfaces.
 */
export function TodayPageFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("relative mx-auto w-full max-w-[1248px] px-6 pt-8 pb-16 lg:pt-[72px]", className)}>{children}</div>
  );
}

/** The blueprint's vertical rhythm as an explicit element, so gaps are read, not guessed. */
export function ZoneGap({ size }: { size: 28 | 48 | 64 }) {
  return <div aria-hidden="true" style={{ height: size }} />;
}
