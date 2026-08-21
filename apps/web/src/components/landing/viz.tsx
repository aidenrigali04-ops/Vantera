"use client";

import { useEffect, useId, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Landing data-viz primitives — one shared instrument-panel language for every mock,
 * pitched at the hero-calendar's richness bar: real axes, gridlines, tick labels,
 * tabular metrics, delta chips, and a single reduced-motion-safe live beat. Holds the
 * white surface + ONE blue accent line (--fb / --cyan-strong / --cyan-line); no second
 * hue, no glow-spam. Every visual is decorative (aria-hidden) — the honest number lives
 * in real DOM text supplied by the caller.
 */

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/** Layered-depth recipes — a crisp top rim + a tight, restrained drop (Framer/Figma
 *  register), so panels read defined, not floating. */
export const INSET_CARD_SHADOW =
  "inset 0 1px 0 rgba(255,255,255,.6), 0 1px 2px rgba(16,24,32,.04), 0 6px 16px -8px rgba(16,24,32,.08)";
export const INSET_RIM = "inset 0 1px 0 rgba(255,255,255,.6), 0 1px 2px rgba(16,24,32,.04)";

/* ── useCountUp — the single source (stats.tsx re-imports this) ───────────── */
export function useCountUp(target: number, run: boolean, decimals = 0, duration = 1600) {
  const reduce = useReducedMotion();
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!run) return;
    if (reduce) {
      const id = requestAnimationFrame(() => setValue(target));
      return () => cancelAnimationFrame(id);
    }
    let raf = 0;
    let start = 0;
    const tick = (t: number) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run, reduce, duration]);
  return decimals > 0 ? value.toFixed(decimals) : Math.round(value).toLocaleString();
}

/** One shared in-view trigger per section (fire animations once). */
export function useInViewOnce() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return [ref, inView] as const;
}

/* ── StatusDot — the one liveness cue (replaces every ad-hoc neon pulse) ───── */
export function StatusDot({
  pulse = false,
  size = "sm",
  className,
}: {
  pulse?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  const reduce = useReducedMotion();
  const dim = size === "md" ? "size-[7px]" : "size-1.5";
  return (
    <span className={cn("relative inline-grid place-items-center", className)} aria-hidden>
      {pulse && !reduce && (
        <motion.span
          className={cn("absolute rounded-full bg-[var(--fb)]", dim)}
          animate={{ opacity: [0.5, 0, 0.5], scale: [1, 2.4, 1] }}
          transition={{ duration: 2.4, ease: "easeInOut", repeat: Infinity }}
        />
      )}
      <span
        className={cn(
          "relative rounded-full bg-[var(--fb)]",
          dim,
          size === "md" && "shadow-[0_0_0_3px_rgba(24,119,242,0.18)]",
        )}
      />
    </span>
  );
}

/* ── DeltaChip — the "+38%" trend pill ────────────────────────────────────── */
export function DeltaChip({
  value,
  dir = "up",
  tone = "accent",
  className,
}: {
  value: string;
  dir?: "up" | "down" | "flat";
  tone?: "accent" | "neutral";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
        tone === "accent"
          ? "bg-[var(--fb-tint)] text-[var(--cyan-strong)] ring-1 ring-inset ring-[var(--cyan-line)]"
          : "bg-[rgba(12,16,26,0.05)] text-[var(--ink-3)]",
        className,
      )}
    >
      <svg viewBox="0 0 8 8" className={cn("size-2", dir === "down" && "rotate-180")} fill="currentColor" aria-hidden>
        {dir === "flat" ? <rect x="1" y="3.4" width="6" height="1.2" rx="0.6" /> : <path d="M4 1 7 5.5H1z" />}
      </svg>
      {value}
    </span>
  );
}

/* ── Sparkline — line + area micro-trend ──────────────────────────────────── */
export function Sparkline({
  points,
  width = 72,
  height = 18,
  draw = true,
  halo = false,
  className,
}: {
  points: number[];
  width?: number;
  height?: number;
  draw?: boolean;
  halo?: boolean;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const gid = useId();
  const P = 2.5;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const span = max - min || 1;
  const x = (i: number) => P + (i / (points.length - 1)) * (width - 2 * P);
  const y = (v: number) => P + (1 - (v - min) / span) * (height - 2 * P);
  const line = points.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L${x(points.length - 1).toFixed(1)} ${height - P} L${x(0).toFixed(1)} ${height - P} Z`;
  const lx = x(points.length - 1);
  const ly = y(points[points.length - 1]);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={cn("overflow-visible", className)} aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1877f2" stopOpacity="0.16" />
          <stop offset="1" stopColor="#1877f2" stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1={P} y1={height - P} x2={width - P} y2={height - P} stroke="var(--hairline)" strokeWidth="1" />
      <path d={area} fill={`url(#${gid})`} />
      <motion.path
        d={line}
        fill="none"
        stroke="var(--fb)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={draw && !reduce ? { pathLength: 0 } : false}
        animate={{ pathLength: 1 }}
        transition={reduce ? { duration: 0 } : { duration: 1, ease: EASE }}
      />
      {halo && <circle cx={lx} cy={ly} r="3.5" fill="rgba(24,119,242,0.18)" />}
      <circle cx={lx} cy={ly} r="2" fill="var(--fb)" />
    </svg>
  );
}

/* ── BarChart — gridlined column chart with axis, ceiling + value label ────── */
export function BarChart({
  values,
  max,
  labels,
  yTicks,
  ceiling,
  valueLabel = false,
  mutedIndices = [],
  run = true,
  height = 92,
  className,
}: {
  values: number[];
  max?: number;
  labels?: string[];
  yTicks?: number[];
  ceiling?: { at: number; label: string };
  valueLabel?: boolean;
  mutedIndices?: number[];
  run?: boolean;
  height?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const hi = max ?? Math.max(...values);
  const muted = new Set(mutedIndices);
  const peak = values.indexOf(Math.max(...values));
  const grid = yTicks ?? [0.25, 0.5, 0.75].map((f) => f * hi);
  return (
    <div className={cn("flex w-full gap-2", className)} aria-hidden>
      {yTicks && (
        <div className="relative flex-none" style={{ width: 20, height }}>
          {yTicks.map((t) => (
            <span
              key={t}
              className="absolute right-0 -translate-y-1/2 text-[9px] tabular-nums leading-none text-[var(--ink-4)]"
              style={{ top: (1 - t / hi) * height }}
            >
              {t}
            </span>
          ))}
        </div>
      )}
      <div className="relative min-w-0 flex-1">
        <div className="relative" style={{ height }}>
          {grid.map((t, i) => (
            <div key={i} className="absolute inset-x-0 border-t border-[var(--hairline)]" style={{ top: (1 - t / hi) * height }} />
          ))}
          <div className="absolute inset-x-0 bottom-0 border-t border-[var(--hairline)]" />
          {ceiling && (
            <div className="absolute inset-x-0 flex items-center" style={{ bottom: (ceiling.at / hi) * height }}>
              <span className="mr-1 whitespace-nowrap rounded-[3px] bg-[var(--fb-tint)] px-1 py-px text-[7.5px] font-semibold text-[var(--cyan-strong)]">
                {ceiling.label}
              </span>
              <div className="h-px flex-1 border-t border-dashed border-[rgba(24,119,242,0.5)]" />
            </div>
          )}
          <motion.div
            className="absolute inset-0 flex items-end gap-1.5"
            initial="hidden"
            animate={run ? "show" : "hidden"}
            variants={{ hidden: {}, show: { transition: { staggerChildren: reduce ? 0 : 0.06, delayChildren: reduce ? 0 : 0.1 } } }}
          >
            {values.map((v, i) => (
              <motion.div
                key={i}
                className="relative flex-1"
                style={{ height: `${Math.max((v / hi) * 100, 2)}%`, transformOrigin: "bottom" }}
                variants={{
                  hidden: { scaleY: reduce ? 1 : 0, opacity: reduce ? 1 : 0 },
                  show: { scaleY: 1, opacity: 1, transition: reduce ? { duration: 0 } : { type: "spring", stiffness: 460, damping: 26 } },
                }}
              >
                <div
                  className="absolute inset-0 rounded-t-[3px] shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] ring-1 ring-inset ring-[var(--cyan-line)]"
                  style={{ background: muted.has(i) ? "var(--cyan-line)" : "linear-gradient(180deg,#2a82f7,var(--fb))" }}
                />
                {valueLabel && i === peak && (
                  <span className="absolute -top-[15px] left-1/2 -translate-x-1/2 text-[9px] font-semibold tabular-nums leading-none text-[var(--cyan-strong)]">
                    {v}
                  </span>
                )}
              </motion.div>
            ))}
          </motion.div>
        </div>
        {labels && (
          <div className="mt-1.5 flex gap-1.5">
            {labels.map((l, i) => (
              <span key={i} className="flex-1 text-center text-[8px] font-medium uppercase tracking-[0.06em] leading-none text-[var(--ink-4)]">
                {l}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Gauge — single-value meter with ticks + threshold marker ─────────────── */
export function Gauge({
  pct,
  ticks = [],
  threshold,
  gradient = false,
  run = true,
  className,
}: {
  pct: number;
  ticks?: number[];
  threshold?: { pct: number };
  gradient?: boolean;
  run?: boolean;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <div
      className={cn("relative h-1.5 w-full rounded-full bg-[#eef1f4] ring-1 ring-inset ring-[var(--hairline)]", className)}
      aria-hidden
    >
      <motion.div
        className="absolute inset-y-0 left-0 rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]"
        style={{ background: gradient ? "linear-gradient(90deg,#8fc0ff,var(--fb))" : "var(--fb)" }}
        initial={{ width: reduce ? `${pct}%` : 0 }}
        animate={{ width: run ? `${pct}%` : reduce ? `${pct}%` : 0 }}
        transition={reduce ? { duration: 0 } : { duration: 0.9, delay: 0.2, ease: EASE }}
      />
      {ticks.map((t) => (
        <span key={t} className="absolute inset-y-0 w-px bg-[var(--hairline)]" style={{ left: `${t}%` }} />
      ))}
      {threshold && (
        <span
          className="absolute -inset-y-1 w-px border-l border-dashed border-[var(--cyan-line)]"
          style={{ left: `${threshold.pct}%` }}
        />
      )}
    </div>
  );
}

/* ── StatRail + MetricCell — inset instrument tiles ───────────────────────── */
export function StatRail({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex items-stretch", className)}>{children}</div>;
}

export function MetricCell({
  value,
  label,
  delta,
  className,
}: {
  value: React.ReactNode;
  label: string;
  delta?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0 flex-1 px-4 first:pl-0 [&:not(:first-child)]:border-l [&:not(:first-child)]:border-[var(--hairline)]",
        className,
      )}
    >
      <div className="flex items-baseline gap-1.5">
        <span className="text-[18px] font-semibold tabular-nums tracking-[-0.02em] text-foreground">{value}</span>
        {delta}
      </div>
      <div className="mt-1 text-[10.5px] font-medium uppercase tracking-[0.07em] leading-snug text-[var(--ink-4)]">{label}</div>
    </div>
  );
}

/* ── LegendRow + SectionLabel — instrument chrome ─────────────────────────── */
export function LegendRow({
  items,
  className,
}: {
  items: { label: string; kind?: "fill" | "muted" | "dashed" }[];
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1", className)} aria-hidden>
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5 text-[10px] text-[var(--ink-4)]">
          {it.kind === "dashed" ? (
            <span className="w-3 border-t border-dashed border-[var(--cyan-line)]" />
          ) : (
            <span
              className="size-2 rounded-[3px]"
              style={{ background: it.kind === "muted" ? "var(--cyan-line)" : "linear-gradient(180deg,#2a82f7,var(--fb))" }}
            />
          )}
          {it.label}
        </span>
      ))}
    </div>
  );
}

export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className="whitespace-nowrap text-[10.5px] font-semibold uppercase tracking-[0.09em] text-[var(--ink-4)]">
        {children}
      </span>
      <span className="h-px flex-1 bg-[var(--hairline)]" />
    </div>
  );
}
