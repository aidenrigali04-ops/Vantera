"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Below-fold design language — the four signature devices every body section shares,
 * so the page reads as one drawn system rather than assembled cards:
 *
 * 1. `SectionIntro` — an editorial header: a numbered mono chip + tracked label +
 *    a hairline rule running to the margin, over the H2 and lead. The numbering
 *    (01–05) covers exactly the five product-story sections.
 * 2. `Mark` — the brand highlight: a blue box behind the one word in a heading that
 *    earns it (the hero's REVENUE device carried down the page). `MarkOnBlue` is its
 *    inversion for blue bands (white box, blue text — exactly the hero's).
 * 3. `FrameGlow` — the soft blue ambient pool under a product frame, so embeds sit
 *    IN the page rather than on it.
 * 4. `PixelField` — a sparse echo of the hero's data pixels for the blue bands only.
 */

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export function SectionIntro({
  index,
  label,
  title,
  lead,
  onBlue = false,
  align = "left",
  className,
}: {
  /** "01"–"05" for the product-story sections; omit for the rest. */
  index?: string;
  label: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  onBlue?: boolean;
  align?: "left" | "center";
  className?: string;
}) {
  const centered = align === "center";
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-90px" }}
      transition={{ duration: 0.7, ease: EASE }}
      className={cn(centered ? "mx-auto flex max-w-2xl flex-col items-center text-center" : "max-w-2xl", className)}
    >
      {/* eyebrow row — chip · label · rule */}
      <div className={cn("flex items-center gap-3", centered ? "w-full max-w-xs" : "w-full")}>
        {index && (
          <span
            className={cn(
              "grid h-6 min-w-6 place-items-center rounded-[7px] px-1 font-mono text-[11px] font-bold tabular-nums",
              onBlue
                ? "bg-white text-[var(--fb-strong)]"
                : "bg-[var(--fb)] text-white shadow-[0_4px_12px_-4px_rgba(24,119,242,0.5)]",
            )}
          >
            {index}
          </span>
        )}
        <span
          className={cn(
            "shrink-0 text-[11.5px] font-semibold uppercase tracking-[0.18em]",
            onBlue ? "text-white/80" : "text-[var(--cyan-strong)]",
          )}
        >
          {label}
        </span>
        <span aria-hidden className={cn("h-px flex-1", onBlue ? "bg-white/25" : "bg-[var(--hairline)]")} />
        {centered && (
          /* mirrored rule on the left for centered intros */
          <span aria-hidden className="hidden" />
        )}
      </div>

      <h2
        className={cn(
          "mt-6 text-[2rem] font-semibold leading-[1.1] tracking-[-0.03em] sm:text-[2.5rem] lg:text-[2.8rem]",
          onBlue ? "text-white" : "text-foreground",
        )}
      >
        {title}
      </h2>
      {lead && (
        <p
          className={cn(
            "mt-4 max-w-xl text-[16px] leading-relaxed sm:text-[17px]",
            onBlue ? "text-white/80" : "text-[var(--ink-3)]",
          )}
        >
          {lead}
        </p>
      )}
    </motion.div>
  );
}

/** Blue highlight box behind a key word — white sections. Large headings only
    (white on --fb clears 3:1 at display sizes). */
export function Mark({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block rounded-[10px] px-[0.22em] pb-[0.06em] pt-[0.02em] text-white shadow-[0_10px_24px_-10px_rgba(24,119,242,0.6)] [background:linear-gradient(180deg,#2a82f7_0%,#1877f2_56%,#166fe5_100%)]">
      {children}
    </span>
  );
}

/** The inversion for blue bands — the hero's REVENUE treatment, verbatim. */
export function MarkOnBlue({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block rounded-[10px] bg-white px-[0.22em] pb-[0.06em] pt-[0.02em] text-[var(--fb-strong)] shadow-[0_16px_40px_-16px_rgba(3,22,58,0.55)]">
      {children}
    </span>
  );
}

/** Soft blue pool behind a ProductFrame (sibling, behind via -z-10). */
export function FrameGlow() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute -inset-x-8 -bottom-10 -top-6 -z-10 rounded-[2.5rem] blur-2xl"
      style={{
        background: "radial-gradient(58% 64% at 50% 40%, rgba(24,119,242,0.13), transparent 72%)",
      }}
    />
  );
}

/* Sparse deterministic pixel set for blue bands (reuses the hero-pixel keyframes). */
const PIXELS: { x: number; y: number; s: number; dur: number; delay: number; max: number }[] = [
  { x: 5, y: 18, s: 12, dur: 4.6, delay: 0.4, max: 0.14 },
  { x: 13, y: 72, s: 15, dur: 5.4, delay: 1.8, max: 0.12 },
  { x: 30, y: 30, s: 11, dur: 3.8, delay: 2.6, max: 0.1 },
  { x: 55, y: 82, s: 13, dur: 4.2, delay: 0.9, max: 0.12 },
  { x: 71, y: 14, s: 12, dur: 5.0, delay: 2.1, max: 0.14 },
  { x: 87, y: 58, s: 16, dur: 4.4, delay: 1.2, max: 0.12 },
  { x: 95, y: 24, s: 11, dur: 3.6, delay: 3.0, max: 0.1 },
  { x: 44, y: 10, s: 13, dur: 5.8, delay: 0.2, max: 0.1 },
];

export function PixelField() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      {PIXELS.map((p, i) => (
        <span
          key={i}
          className="hero-pixel absolute rounded-[3px] bg-white"
          style={
            {
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: p.s,
              height: p.s,
              "--pixel-max": p.max,
              "--pixel-dur": `${p.dur}s`,
              "--pixel-delay": `${p.delay}s`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
