"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion";
import { ArrowRight, Sparkles, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AppWindow,
  Figure,
  RuleChip,
  ScoreBadge,
  Skeleton,
  SOFT,
  StatusDot,
  Who,
  type Person,
} from "./prospect-discovery.parts";

/**
 * Prospect discovery, running: a scheduled run searches the agent's three ICPs, the
 * counts climb as the fit gate filters them, then it walks the profiles one by one,
 * each with the qualified prospects it found, the fit rules they met, and the signal
 * that lifted them. Everyone shown scored 70+ and went to outreach.
 *
 * Runs only while half of it is on screen and starts over once it leaves, so every
 * visit sees the run. With reduced motion it shows the finished run, still.
 */

interface Found {
  person: Person;
  signal: string;
  score: number;
}

/* Qualified per ICP sums to QUALIFIED. */
const ICPS: { name: string; short: string; count: number; found: Found[] }[] = [
  {
    name: "VP Sales · B2B SaaS · 11–200",
    short: "VP Sales",
    count: 18,
    found: [
      {
        person: { initials: "RN", name: "Rachel Nguyen", role: "VP Sales · Northwind", tint: "#1877f2" },
        signal: "Posted about pipeline pain · 3d",
        score: 94,
      },
      {
        person: { initials: "KW", name: "Kenji Watanabe", role: "VP Sales · Kestrel", tint: "#5e6ad2" },
        signal: "Hiring two SDRs · 6d",
        score: 88,
      },
      {
        person: { initials: "HB", name: "Hannah Brooks", role: "VP Sales · Tidewater", tint: "#c2557d" },
        signal: "Raised a Series A · 2w",
        score: 85,
      },
      {
        person: { initials: "DC", name: "Daniel Cho", role: "Sales Director · Summit Ridge", tint: "#0f766e" },
        signal: "Started a new role · 1mo",
        score: 81,
      },
    ],
  },
  {
    name: "Head of Growth · Agencies",
    short: "Growth",
    count: 11,
    found: [
      {
        person: { initials: "MF", name: "Marcus Feld", role: "Head of Growth · Lumen", tint: "#5e6ad2" },
        signal: "Commented on outbound tooling · 2d",
        score: 91,
      },
      {
        person: { initials: "OG", name: "Owen Gallagher", role: "Agency Owner · Paperplane", tint: "#0c9fce" },
        signal: "Expanding to a new market · 1w",
        score: 86,
      },
      {
        person: { initials: "CB", name: "Chloe Bernard", role: "Demand Gen Lead · Pinecrest", tint: "#d97706" },
        signal: "Posted about lead quality · 4d",
        score: 82,
      },
      {
        person: { initials: "SO", name: "Samuel Osei", role: "Head of Partnerships · Halcyon", tint: "#0f9d6e" },
        signal: "Hiring a growth lead · 9d",
        score: 78,
      },
    ],
  },
  {
    name: "Founders · Seed–Series A",
    short: "Founders",
    count: 8,
    found: [
      {
        person: { initials: "AO", name: "Aisha Okafor", role: "Founder · Brightlane", tint: "#0f9d6e" },
        signal: "Raised a seed round · 2w",
        score: 89,
      },
      {
        person: { initials: "RM", name: "Ravi Menon", role: "Founder & CEO · Vela Robotics", tint: "#1877f2" },
        signal: "Posted about a first sales hire · 5d",
        score: 87,
      },
      {
        person: { initials: "AK", name: "Arjun Kapoor", role: "Founder · Ledgerline", tint: "#7c3aed" },
        signal: "Launched a new product · 1w",
        score: 84,
      },
      {
        person: { initials: "LM", name: "Lucas Moreau", role: "Founder · Marlow Legal", tint: "#c2557d" },
        signal: "Hiring a first AE · 3w",
        score: 79,
      },
    ],
  },
];

const FOUND = 412;
const PASSED = 128;
const QUALIFIED = ICPS.reduce((n, icp) => n + icp.count, 0);
/* How long a profile stays up before the run moves to the next. */
const ICP_MS = 4600;
const EASE = [0.16, 1, 0.3, 1] as const;

/* Name · fit · signal · score, collapsing to name · score on phones. */
const COLS =
  "grid grid-cols-[minmax(0,1fr)_2.4rem] items-center gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.4rem] lg:grid-cols-[minmax(0,1.05fr)_9.5rem_minmax(0,1fr)_2.4rem]";

export function ProspectingWindow() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.45 });
  const reduce = useReducedMotion();
  const railId = useId();

  const [ran, setRan] = useState(false);
  const [active, setActive] = useState(0);

  const progress = useMotionValue(0);
  const found = useTransform(progress, (p) => Math.round(p * FOUND).toLocaleString("en-US"));
  const passed = useTransform(progress, (p) => Math.round(p * PASSED));
  const qualified = useTransform(progress, (p) => Math.round(p * QUALIFIED));

  // Running only while on screen and motion is allowed. Reduced motion shows the
  // finished state, still: `ready` is derived, and the figures jump to their totals.
  const live = inView && !reduce;
  const ready = reduce || ran;
  useEffect(() => {
    if (reduce) progress.jump(1);
  }, [reduce, progress]);

  // The run: the counts climb, then the rows arrive. Leaving the screen rewinds it
  // (in the cleanup), so the next visit sees the run from the start.
  useEffect(() => {
    if (!live) return;
    const controls = animate(progress, 1, {
      duration: 2,
      ease: [0.33, 0, 0.2, 1],
      onComplete: () => setRan(true),
    });
    return () => {
      controls.stop();
      progress.jump(0);
      setRan(false);
      setActive(0);
    };
  }, [live, progress]);

  // The walk through the profiles.
  useEffect(() => {
    if (!live || !ready) return;
    const next = window.setTimeout(() => setActive((i) => (i + 1) % ICPS.length), ICP_MS);
    return () => window.clearTimeout(next);
  }, [live, ready, active]);

  const icp = ICPS[active];

  return (
    <div ref={ref}>
      <AppWindow
        title="Prospecting"
        context="Scout · Northwind"
        label="Sample prospecting run: the agent searches three ideal customer profiles, filters them through the fit gate, and lists the qualified prospects with the signals that lifted them."
        status={
          <>
            <StatusDot done={ready} />
            <span className="truncate">{ready ? "Run complete" : "Searching your ICP"}</span>
          </>
        }
        footer={
          <>
            <span className="flex items-center gap-2 text-[0.75rem] font-medium text-foreground">
              <Sparkles className="size-3.5 text-[var(--fb-strong)]" />
              <span className="tabular-nums">{QUALIFIED}</span> qualified this run
            </span>
            <span className="flex items-center gap-1 text-[0.75rem] font-semibold text-[var(--fb-strong)]">
              Sent to outreach <ArrowRight className="size-3.5" />
            </span>
          </>
        }
      >
        {/* The figures, climbing while it runs */}
        <div className="grid grid-cols-2 gap-px border-b border-[var(--hairline)] bg-[var(--hairline)] md:grid-cols-4">
          <Figure label="Prospects found">
            <motion.span>{found}</motion.span>
          </Figure>
          <Figure label="Passed fit gate">
            <motion.span>{passed}</motion.span>
          </Figure>
          <Figure label="Qualified 70+">
            <motion.span>{qualified}</motion.span>
          </Figure>
          <Figure label="Next run">
            <span className="text-[1.15rem]">Tue 9:00</span>
          </Figure>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)] md:grid-cols-[14rem_minmax(0,1fr)]">
          {/* The agent's profiles */}
          <aside className={cn("hidden border-r border-[var(--hairline)] p-3 md:block", SOFT)}>
            <p className="px-2 pb-1.5 pt-1 text-[0.65rem] font-medium text-[var(--ink-3)]">
              Ideal customer profiles
            </p>
            <ul className="space-y-0.5">
              {ICPS.map((p, i) => {
                const on = ready && i === active;
                return (
                  <li
                    key={p.name}
                    className={cn(
                      "relative flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-[0.76rem] font-medium transition-colors duration-300",
                      on ? "text-[var(--fb-strong)]" : "text-foreground/75",
                    )}
                  >
                    {on && (
                      <motion.span
                        layoutId={railId}
                        transition={{ type: "spring", stiffness: 380, damping: 34 }}
                        className="absolute inset-0 rounded-lg bg-[var(--cyan-tint)] shadow-[inset_0_0_0_1px_rgba(22,111,229,0.16)]"
                      />
                    )}
                    <span className="relative truncate">{p.name}</span>
                    <span
                      className={cn(
                        "relative shrink-0 text-[0.68rem] tabular-nums",
                        on ? "text-[var(--fb-strong)]" : "text-[var(--ink-3)]",
                      )}
                    >
                      {ready ? p.count : "–"}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 px-2 text-[0.68rem] leading-snug text-[var(--ink-3)]">
              Up to 3 profiles per agent · runs daily at 9:00
            </p>
          </aside>

          {/* The qualified prospects of the profile that's open */}
          <div className="min-w-0 p-4 lg:p-5">
            {/* On phones the rail becomes tabs */}
            <div className="mb-3 flex gap-1 overflow-hidden rounded-lg bg-[rgba(12,16,26,0.04)] p-1 md:hidden">
              {ICPS.map((p, i) => (
                <span
                  key={p.name}
                  className={cn(
                    "flex-1 whitespace-nowrap rounded-md px-1.5 py-1 text-center text-[0.68rem] font-medium transition-colors",
                    ready && i === active
                      ? "bg-white text-[var(--fb-strong)] shadow-[0_1px_2px_rgba(16,24,40,0.08)]"
                      : "text-[var(--ink-3)]",
                  )}
                >
                  {p.short}
                </span>
              ))}
            </div>

            <div className="flex items-center justify-between gap-3">
              <p className="truncate text-[0.82rem] font-semibold text-foreground">
                {ready ? icp.name : "Checking every profile against your fit rules"}
              </p>
              {ready && (
                <span className="shrink-0 rounded-md bg-[var(--cyan-tint)] px-1.5 py-0.5 text-[0.65rem] font-semibold tabular-nums text-[var(--cyan-strong)]">
                  {icp.count} qualified
                </span>
              )}
            </div>

            <div className={cn(COLS, "mt-3 px-3 text-[0.65rem] font-medium text-[var(--ink-3)]")}>
              <span>Prospect</span>
              <span className="hidden lg:block">Fit gate</span>
              <span className="hidden sm:block">Why now</span>
              <span className="text-right">Score</span>
            </div>

            <div className="relative mt-1.5 h-[13rem]">
              <AnimatePresence initial={false} mode="popLayout">
                {ready ? (
                  <motion.ul
                    key={icp.name}
                    className="space-y-1.5"
                    initial="enter"
                    animate="shown"
                    exit="gone"
                    variants={{
                      shown: { transition: { staggerChildren: 0.07 } },
                      gone: { opacity: 0, transition: { duration: 0.2 } },
                    }}
                  >
                    {icp.found.map((f, i) => (
                      <motion.li
                        key={f.person.name}
                        variants={{
                          enter: { opacity: 0, y: 10, filter: "blur(4px)" },
                          shown: {
                            opacity: 1,
                            y: 0,
                            filter: "blur(0px)",
                            transition: { duration: 0.45, ease: EASE },
                          },
                        }}
                        className={cn(
                          COLS,
                          "rounded-lg border bg-white px-3 py-2",
                          i === 0
                            ? "border-[rgba(22,111,229,0.3)] bg-[color-mix(in_oklab,var(--fb-strong)_4%,white)]"
                            : "border-[var(--hairline)]",
                        )}
                      >
                        <Who person={f.person} />
                        <span className="hidden gap-1 lg:flex">
                          <RuleChip label="Title" />
                          <RuleChip label="Industry" />
                          <RuleChip label="Size" />
                        </span>
                        <span className="hidden min-w-0 items-center gap-1.5 text-[0.72rem] text-[var(--ink-3)] sm:flex">
                          <Zap className="size-3 shrink-0 text-[var(--fb)]" />
                          <span className="truncate">{f.signal}</span>
                        </span>
                        <span className="flex justify-end">
                          <ScoreBadge score={f.score} />
                        </span>
                      </motion.li>
                    ))}
                  </motion.ul>
                ) : (
                  <motion.ul key="running" className="space-y-1.5" exit={{ opacity: 0, transition: { duration: 0.2 } }}>
                    {[0.72, 0.58, 0.8, 0.5].map((w, i) => (
                      <li
                        key={i}
                        className="flex h-[2.95rem] items-center gap-4 rounded-lg border border-[rgba(12,16,26,0.05)] px-3"
                      >
                        <span className="size-7 shrink-0 rounded-full bg-[rgba(12,16,26,0.06)] motion-safe:animate-pulse" />
                        <span className="block flex-1">
                          <Skeleton className="w-full" />
                        </span>
                        <span style={{ width: `${w * 40}%` }} className="block">
                          <Skeleton className="w-full" />
                        </span>
                      </li>
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </AppWindow>
    </div>
  );
}
