"use client";

import * as React from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * The product's core panel — a clean white card on the premium-light system: hairline
 * border + soft premium shadow (matches the landing/auth CARD). Light-only now that the
 * dark theme is retired. Reveals on enter with a staggered delay (`index`).
 */
export const PANEL_SURFACE =
  "rounded-2xl border border-[var(--hairline)] bg-white shadow-[var(--shadow-card)]";

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
      <span className="size-1.5 rounded-full bg-foreground/25" />
      {children}
    </span>
  );
}
