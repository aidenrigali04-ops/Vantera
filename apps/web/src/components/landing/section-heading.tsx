"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { WARM } from "./landing-theme";

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "center",
  className,
}: {
  eyebrow: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  align?: "center" | "left";
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6 }}
      className={cn(align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-2xl", className)}
    >
      <span
        className={cn(
          "inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase",
          align === "center" && "justify-center",
        )}
      >
        <span className="size-1.5 rounded-full" style={{ backgroundColor: WARM.c2 }} />
        {eyebrow}
      </span>
      <h2 className="font-heading mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        {title}
      </h2>
      {subtitle && <p className="mt-4 text-base text-muted-foreground sm:text-lg">{subtitle}</p>}
    </motion.div>
  );
}
