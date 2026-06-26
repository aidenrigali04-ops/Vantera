"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Landing card surfaces + orchestrated reveals — the landing's adaptation of the
 * dashboard's `components/ui/panel.tsx` method (PANEL_SURFACE + Reveal/RevealItem),
 * kept in the light Poppins/cyan system. A clean white panel with a hairline border
 * and premium soft shadow; the interactive variant lifts and picks up a faint cyan
 * halo on hover, exactly like the dashboard's `interactive` panels.
 */
export const CARD = "rounded-2xl border border-[var(--hairline)] bg-white shadow-[var(--shadow-card)]";

export const CARD_INTERACTIVE = cn(
  CARD,
  "transition-all duration-300 hover:-translate-y-1 hover:border-[var(--cyan-line)] " +
    "hover:shadow-[0_2px_8px_rgba(12,16,26,0.05),0_24px_56px_-22px_rgba(48,207,255,0.32)]",
);

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/** Scroll-triggered staggered reveal container — children animate as one orchestrated motion. */
export function Reveal({ className, children, ...props }: HTMLMotionProps<"div">) {
  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function RevealItem({ className, children, ...props }: HTMLMotionProps<"div">) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 22 },
        show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
      }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}
