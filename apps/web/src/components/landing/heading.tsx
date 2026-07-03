"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Landing section heading — 2026 premium, restrained (Stripe/Vercel/Linear register).
 * A quiet typographic eyebrow (uppercase, tracked, in the accent) — no pill, no glowing
 * dot — over a large Poppins-semibold title and a measured grey subtitle. Scroll-reveals
 * once. The kicker earns attention through type, not ornament.
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
        <span className="block text-[12.5px] font-semibold uppercase tracking-[0.18em] text-[var(--cyan-strong)]">
          {eyebrow}
        </span>
      )}
      <h2 className="mt-4 text-[2.15rem] font-semibold leading-[1.05] tracking-[-0.035em] text-foreground sm:text-[2.75rem] lg:text-[3.1rem]">
        {title}
      </h2>
      {subtitle && (
        <p className="mx-auto mt-5 max-w-xl text-[16px] font-normal leading-relaxed text-[var(--ink-3)] sm:text-[17px]">
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
