"use client";

import { useRef } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { CalendarCheck, Clock, Rocket } from "lucide-react";
import { LandingHeading } from "./heading";
import { Reveal, RevealItem } from "./surface";
import { DeltaChip, Gauge, Sparkline, StatusDot, useCountUp } from "./viz";
import { cn } from "@/lib/utils";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

type Stat = {
  icon: typeof CalendarCheck;
  target: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  label: string;
  caption: string;
  live?: boolean;
  trend?: number[];
  delta?: string;
};

const STATS: Stat[] = [
  {
    icon: CalendarCheck,
    target: 12480,
    suffix: "+",
    label: "meetings booked",
    caption: "Qualified conversations, booked hands-off.",
    live: true,
    trend: [42, 55, 61, 73, 88, 100],
    delta: "+18%",
  },
  {
    icon: Clock,
    target: 3.5,
    decimals: 1,
    suffix: "hrs",
    label: "saved per day on prospecting",
    caption: "Sourcing, scoring, and enrichment, automated.",
    trend: [58, 64, 61, 72, 80, 86],
    delta: "+21%",
  },
  {
    icon: Rocket,
    target: 15,
    suffix: "min",
    label: "from signup to agents live",
    caption: "Connect LinkedIn, deploy agents, go live.",
    trend: [44, 41, 45, 42, 44, 43],
  },
];

/**
 * Stats band — three big tabular-nums figures on a clean white surface, in the hero's
 * light system. The lead metric ("meetings booked") counts up live the moment the
 * band scrolls into view — the same cubic ease-out the hero-calendar "booked" pill
 * uses; the others tick up alongside it. A small booked-meetings mockup on the right
 * mirrors the hero-calendar's card recipe (rounded card, hairline border, soft
 * shadow, blue accents). Reduced motion shows every final value instantly.
 */
export function Stats() {
  const bandRef = useRef<HTMLDivElement>(null);
  const inView = useInView(bandRef, { once: true, margin: "-100px" });

  return (
    <section className="relative border-t border-[var(--hairline)] bg-white py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <LandingHeading
          eyebrow="By the numbers"
          title="Pipeline, on autopilot"
          subtitle="The outreach never sleeps and never sprays. Every figure here is the system doing work that used to be yours."
        />

        <div ref={bandRef} className="mt-16 grid items-stretch gap-5 lg:grid-cols-[1.35fr_1fr]">
          {/* LEFT — the three big figures */}
          <Reveal className="grid gap-5 sm:grid-cols-3">
            {STATS.map((s) => (
              <StatCard key={s.label} stat={s} run={inView} />
            ))}
          </Reveal>

          {/* RIGHT — matching booked-meetings mockup */}
          <RevealItem>
            <BookedMockup run={inView} />
          </RevealItem>
        </div>
      </div>
    </section>
  );
}

function StatCard({ stat, run }: { stat: Stat; run: boolean }) {
  const value = useCountUp(stat.target, run, stat.decimals ?? 0);
  const Icon = stat.icon;
  // Word units (hrs/min) render as a small muted label so the figure never wraps to a
  // second line; symbol suffixes (+) stay inline at full size as part of the number.
  const unit = stat.suffix?.trim();
  const isWordUnit = !!unit && /[a-z]/i.test(unit);

  return (
    <RevealItem
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border border-[var(--hairline)] bg-white p-6 shadow-[var(--shadow-card)]",
        "transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--cyan-line)]",
        "hover:shadow-[0_1px_2px_rgba(12,16,26,0.04),0_10px_24px_-12px_rgba(24,119,242,0.16)]",
      )}
    >
      {/* subtle inner highlight along the top edge, matching the hero-calendar recipe */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent"
      />

      <div className="flex items-center justify-between">
        <span className="grid size-9 place-items-center rounded-xl bg-[var(--cyan-tint)] text-[var(--cyan-strong)] ring-1 ring-inset ring-[rgba(24,119,242,0.2)] transition-transform duration-300 group-hover:scale-105">
          <Icon className="size-[18px]" strokeWidth={1.9} />
        </span>
        {stat.live && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(24,119,242,0.1)] px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#1461d1]">
            <StatusDot pulse />
            Live
          </span>
        )}
      </div>

      {/* figure + label + caption as one block, vertically centered so the tall card
          reads balanced instead of hollow. Sized to fit the narrow 3-up column with
          padding to spare — the unit (hrs/min) and the "+" ride smaller so the figure
          never crowds the card edge. */}
      <div className="flex flex-1 flex-col justify-center py-6">
        <p className="flex items-baseline font-mono text-[2rem] font-semibold leading-none tracking-[-0.04em] tabular-nums text-foreground lg:text-[2.3rem]">
          <span>
            {stat.prefix}
            {value}
          </span>
          {unit && (
            <span
              className={cn(
                "font-semibold",
                isWordUnit
                  ? "ml-1.5 text-[0.42em] tracking-[-0.01em] text-[var(--ink-4)]"
                  : "ml-0.5 text-[0.62em] text-foreground",
              )}
            >
              {unit}
            </span>
          )}
        </p>
        <p className="mt-4 text-[14px] font-semibold leading-snug text-foreground">{stat.label}</p>
        <p className="mt-1.5 text-[12.5px] leading-snug text-[var(--ink-4)]">{stat.caption}</p>

        {stat.trend && (
          <div className="mt-3.5 flex items-center gap-2.5 border-t border-[var(--hairline)] pt-3.5">
            <Sparkline points={stat.trend} width={64} height={18} draw={run} />
            {stat.delta && <DeltaChip value={stat.delta} dir="up" />}
          </div>
        )}
      </div>
    </RevealItem>
  );
}

/* ── Booked-meetings mockup ────────────────────────────────────────────────
   A compact "recent bookings" card in the hero-calendar recipe: white card,
   #E6EAEE hairline, the same soft shadow + inner highlight, blue accents,
   tabular figures. Rows stagger in on scroll; a running counter climbs to
   match the live figure; the footer meter fills to the calendar-fill figure. */
const ROWS = [
  { initial: "S", name: "Stripe", note: "Product demo", tint: "#635BFF" },
  { initial: "H", name: "HubSpot", note: "Discovery", tint: "#FF7A59" },
  { initial: "F", name: "Figma", note: "Closing call", tint: "#A259FF" },
  { initial: "L", name: "Linear", note: "Intro call", tint: "#5E6AD2" },
];

function BookedMockup({ run }: { run: boolean }) {
  const reduce = useReducedMotion();
  const total = useCountUp(48, run, 0, 1400);
  const fill = useCountUp(92, run);

  const containerV = {
    hidden: {},
    show: { transition: { staggerChildren: reduce ? 0 : 0.09, delayChildren: reduce ? 0 : 0.15 } },
  };
  const rowV = {
    hidden: { opacity: 0, x: reduce ? 0 : 12 },
    show: {
      opacity: 1,
      x: 0,
      transition: reduce ? { duration: 0 } : { duration: 0.5, ease: EASE },
    },
  };

  return (
    <div className="relative h-full" aria-hidden>
      <div
        className="flex h-full flex-col overflow-hidden rounded-[18px] border border-[#E6EAEE] bg-white"
        style={{
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,.6), 0 1px 2px rgba(16,24,32,.04), 0 10px 26px -12px rgba(16,24,32,.12)",
        }}
      >
        {/* header */}
        <div className="flex items-center gap-2.5 border-b border-[#EFF2F5] px-4 pb-3 pt-3.5">
          <span className="grid size-7 place-items-center rounded-[8px] bg-[var(--cyan-tint)] text-[var(--cyan-strong)] ring-1 ring-inset ring-[rgba(24,119,242,0.2)]">
            <CalendarCheck className="size-[15px]" strokeWidth={2} />
          </span>
          <span className="text-[13.5px] font-semibold tracking-[-0.01em] text-[#0C1620]">This week</span>
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-[rgba(24,119,242,0.12)] px-2.5 py-[5px] text-[11px] font-semibold tabular-nums text-[#1461d1]">
            <span className="size-1.5 rounded-full bg-[#1877f2]" />
            {total} booked
          </span>
        </div>

        {/* rows */}
        <motion.div
          className="flex flex-1 flex-col justify-center gap-2.5 px-3 py-3"
          variants={containerV}
          initial="hidden"
          animate={run ? "show" : "hidden"}
        >
          {ROWS.map((r) => (
            <motion.div
              key={r.name}
              variants={rowV}
              className="group/row flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 ring-1 ring-inset ring-[rgba(15,23,42,0.04)] transition-colors duration-300"
              style={{ background: `${r.tint}0F`, boxShadow: `inset 3px 0 0 ${r.tint}` }}
            >
              <span
                className="grid size-6 flex-none place-items-center rounded-[6px] text-[10px] font-bold leading-none text-white shadow-[0_1px_2px_rgba(16,24,32,0.16)]"
                style={{ background: r.tint }}
              >
                {r.initial}
              </span>
              <span className="min-w-0 leading-none">
                <span className="block text-[12px] font-semibold tracking-[-0.01em] text-[#0F172A]">{r.name}</span>
                <span className="mt-[3px] block text-[10.5px] text-[#64748B]">{r.note}</span>
              </span>
              <span className="ml-auto inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-[rgba(24,119,242,0.08)] px-2 py-[3px] text-[9.5px] font-semibold uppercase tracking-[0.06em] text-[var(--fb)] transition-transform duration-300 group-hover/row:scale-105">
                <span className="size-1 rounded-full bg-[var(--fb)]" />
                Booked
              </span>
            </motion.div>
          ))}
        </motion.div>

        {/* footer meter — a real gauge with tick marks + a target threshold */}
        <div className="border-t border-[#EFF2F5] px-4 pb-3.5 pt-3">
          <div className="flex items-center justify-between text-[10.5px] font-medium text-[#64748B]">
            <span className="uppercase tracking-[0.06em]">Calendar fill</span>
            <span className="font-mono font-semibold tabular-nums text-[#1461d1]">{fill}%</span>
          </div>
          <Gauge className="mt-2.5" pct={92} ticks={[25, 50, 75]} threshold={{ pct: 80 }} run={run} />
        </div>
      </div>
    </div>
  );
}
