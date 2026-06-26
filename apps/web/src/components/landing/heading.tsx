"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Landing section heading — 2026 premium. A pill eyebrow with a cyan dot, a large
 * Poppins-semibold title, and a measured grey subtitle. Scroll-reveals once.
 */
export function LandingHeading({
  eyebrow,
  title,
  subtitle,
  align = "center",
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  align?: "center" | "left";
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-90px" }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className={cn(align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-2xl", className)}
    >
      {eyebrow && (
        <span
          className={cn(
            "inline-flex items-center gap-2 rounded-full border border-[var(--hairline)] bg-white px-3 py-1 text-[12.5px] font-medium text-[var(--ink-2)] shadow-[var(--shadow-sm)]",
            align === "center" ? "mx-auto" : "",
          )}
        >
          <span className="size-1.5 rounded-full bg-[var(--cyan)] shadow-[0_0_8px_rgba(48,207,255,0.8)]" />
          {eyebrow}
        </span>
      )}
      <h2 className="mt-5 text-[2.1rem] font-semibold leading-[1.07] tracking-[-0.03em] text-foreground sm:text-[2.7rem] lg:text-[3rem]">
        {title}
      </h2>
      {subtitle && (
        <p className="mx-auto mt-5 max-w-xl text-[16px] font-normal leading-relaxed text-[var(--ink-3)] sm:text-[17.5px]">
          {subtitle}
        </p>
      )}
    </motion.div>
  );
}

/** A single cyan accent word (legible cyan on light). */
export function Accent({ children }: { children: React.ReactNode }) {
  return <span className="text-[var(--cyan-strong)]">{children}</span>;
}
