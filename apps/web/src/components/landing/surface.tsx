"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Landing card surfaces + orchestrated reveals — the landing's adaptation of the
 * dashboard's `components/ui/panel.tsx` method (PANEL_SURFACE + Reveal/RevealItem),
 * kept in the light Poppins/cyan system. A clean white panel with a hairline border
 * and premium soft shadow; the interactive variant lifts and picks up a faint cyan
 * halo on hover, exactly like the dashboard's `interactive` panels.
 *
 * Reveal is CSS-driven (native IntersectionObserver + globals.css `landing-reveal-*`),
 * not Framer Motion — this keeps the animation runtime off the landing's hydration path
 * (mobile perf). Content is VISIBLE BY DEFAULT: the hidden→shown states apply only once
 * JS has armed the container, so a no-JS / pre-hydration render always shows everything.
 */
export const CARD = "rounded-2xl border border-[var(--hairline)] bg-white shadow-[var(--shadow-card)]";

export const CARD_INTERACTIVE = cn(
  CARD,
  "transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--cyan-line)] " +
    "hover:shadow-[0_1px_2px_rgba(12,16,26,0.04),0_10px_24px_-12px_rgba(24,119,242,0.16)]",
);

/** Scroll-triggered staggered reveal container — children fade/rise as one on first view. */
export function Reveal({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null);
  // "" (SSR / no-JS) → children visible. "armed" → hidden, ready. "shown" → animate in.
  const [state, setState] = useState<"" | "armed" | "shown">("");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setState("armed");
    const io = new IntersectionObserver(
      ([entry], obs) => {
        if (entry.isIntersecting) {
          setState("shown");
          obs.disconnect();
        }
      },
      { rootMargin: "-80px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} data-reveal={state || undefined} className={className} {...props}>
      {children}
    </div>
  );
}

/** A single revealed child — carries the class the parent's data-reveal state drives. */
export function RevealItem({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("landing-reveal-item", className)} {...props}>
      {children}
    </div>
  );
}
