"use client";

import * as React from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * The product's core panel — the landing page's clean translucent card (see
 * DESIGN.md), NOT the liquid-glass distortion Card. Theme-aware so the dashboard
 * toggle keeps working; the dark theme is the designed-for default and matches the
 * landing exactly. Reveals on enter with a staggered delay (`index`).
 */
export const PANEL_SURFACE =
  "rounded-2xl border shadow-lg border-black/[0.07] bg-black/[0.02] shadow-black/5 " +
  "dark:border-white/[0.12] dark:bg-white/[0.04] dark:shadow-black/30";

const REVEAL = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

export function Panel({
  className,
  index = 0,
  interactive = false,
  children,
  ...props
}: HTMLMotionProps<"div"> & { index?: number; interactive?: boolean }) {
  return (
    <motion.div
      initial={REVEAL.initial}
      animate={REVEAL.animate}
      transition={{ duration: 0.55, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        PANEL_SURFACE,
        "p-5",
        interactive &&
          "transition-colors hover:border-black/15 dark:hover:border-white/20",
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/**
 * Staggered reveal container — children animate in sequence on enter. Use for a
 * grid/column of panels so the load reads as one orchestrated motion, not scatter.
 * Honors prefers-reduced-motion via framer-motion's reduced-motion handling.
 */
export function Reveal({
  className,
  children,
  ...props
}: HTMLMotionProps<"div">) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: 0.06 } },
      }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function RevealItem({
  className,
  children,
  ...props
}: HTMLMotionProps<"div">) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
      }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/** Uppercase mono eyebrow with a small dot — the landing's section/label idiom. */
export function Eyebrow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground",
        className
      )}
    >
      <span className="size-1.5 rounded-full bg-foreground/70" />
      {children}
    </span>
  );
}
