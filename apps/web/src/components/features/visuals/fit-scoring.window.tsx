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
import { ArrowRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AISHA,
  AppWindow,
  Figure,
  JAMAL,
  LUIS,
  MARCUS,
  PRIYA,
  RACHEL,
  RuleChip,
  ScoreRing,
  Skeleton,
  SOFT,
  StatusDot,
  Who,
  type Person,
} from "./prospect-discovery.parts";

/**
 * Fit scoring, running: the run's prospects are scored, then it opens one at a time —
 * the fit gate's rules and points, the AI rank's signal points, the total, and the
 * written rationale behind it. Only 70+ enters outreach; the prospect under the bar is
 * shown held back.
 *
 * Runs only while half of it is on screen and starts over once it leaves. With reduced
 * motion it shows the first prospect, opened, still.
 */

interface Breakdown {
  person: Person;
  fit: { label: string; pts: number }[];
  signals: { label: string; pts: number }[];
  why: { pain: string; trigger: string; angle: string };
}

/* Each total is the sum of its fit and signal points. */
const OPENED: Breakdown[] = [
  {
    person: RACHEL,
    fit: [
      { label: "Title match", pts: 24 },
      { label: "Seniority", pts: 12 },
      { label: "Headcount 11–200", pts: 10 },
    ],
    signals: [
      { label: "Posted about pipeline pain · 3d", pts: 30 },
      { label: "Active this week", pts: 15 },
    ],
    why: {
      pain: "Rebuilding pipeline after a reorg",
      trigger: "Posted about it 3 days ago",
      angle: "Pipeline without adding SDRs",
    },
  },
  {
    person: MARCUS,
    fit: [
      { label: "Title match", pts: 22 },
      { label: "Seniority", pts: 10 },
      { label: "Headcount 11–200", pts: 10 },
    ],
    signals: [
      { label: "Hiring two SDRs · 6d", pts: 28 },
      { label: "Commented on outbound tooling · 2d", pts: 18 },
    ],
    why: {
      pain: "Ramping new SDRs",
      trigger: "Two SDR roles opened last week",
      angle: "Close the ramp gap",
    },
  },
  {
    person: AISHA,
    fit: [
      { label: "Title match", pts: 24 },
      { label: "Seniority", pts: 12 },
      { label: "Headcount 11–50", pts: 8 },
    ],
    signals: [
      { label: "Raised a seed round · 2w", pts: 26 },
      { label: "Active this week", pts: 16 },
    ],
    why: {
      pain: "Outbound slips after a raise",
      trigger: "Seed round, two weeks ago",
      angle: "Outbound that runs in minutes a day",
    },
  },
];

const total = (b: Breakdown) =>
  [...b.fit, ...b.signals].reduce((n, r) => n + r.pts, 0);

/* The list on the left: the three that open, two more qualified, one held back. */
const LIST: { person: Person; score: number }[] = [
  ...OPENED.map((b) => ({ person: b.person, score: total(b) })),
  { person: LUIS, score: 79 },
  { person: PRIYA, score: 74 },
  { person: JAMAL, score: 58 },
];

const SCORED = 412;
const PASSED = 128;
const QUALIFIED = 37;
const AVG = 84;
const OPEN_MS = 4800;
const EASE = [0.16, 1, 0.3, 1] as const;

/** The opened panel's shape while the run is still scoring. */
function OpenedSkeleton() {
  return (
    <div aria-hidden className="space-y-4">
      <div className="flex items-center gap-2.5">
        <span className="size-9 rounded-full bg-[rgba(12,16,26,0.06)] motion-safe:animate-pulse" />
        <span className="w-40 space-y-1.5">
          <Skeleton className="w-full" />
          <Skeleton className="w-2/3" />
        </span>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="space-y-2.5 rounded-xl border border-[rgba(12,16,26,0.05)] p-3">
            <Skeleton className="w-1/3" />
            <Skeleton className="w-full" />
            <Skeleton className="w-5/6" />
            <Skeleton className="w-2/3" />
          </div>
        ))}
      </div>
      <div className="space-y-2.5 rounded-xl border border-[rgba(12,16,26,0.05)] p-3">
        <Skeleton className="w-1/4" />
        <Skeleton className="w-full" />
      </div>
    </div>
  );
}

export function ScoringWindow() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.45 });
  const reduce = useReducedMotion();
  const listId = useId();

  const [ran, setRan] = useState(false);
  const [active, setActive] = useState(0);

  const progress = useMotionValue(0);
  const scored = useTransform(progress, (p) => Math.round(p * SCORED));
  const passed = useTransform(progress, (p) => Math.round(p * PASSED));
  const qualified = useTransform(progress, (p) => Math.round(p * QUALIFIED));
  const avg = useTransform(progress, (p) => Math.round(p * AVG));

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
      duration: 1.8,
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

  useEffect(() => {
    if (!live || !ready) return;
    const next = window.setTimeout(() => setActive((i) => (i + 1) % OPENED.length), OPEN_MS);
    return () => window.clearTimeout(next);
  }, [live, ready, active]);

  const open = OPENED[active];
  const fitPts = open.fit.reduce((n, r) => n + r.pts, 0);
  const sigPts = open.signals.reduce((n, r) => n + r.pts, 0);

  return (
    <div ref={ref}>
      <AppWindow
        title="Fit scoring"
        context="Scout · Northwind"
        label="Sample scoring view: prospects scored on a fit gate and an AI rank of their buying signals, one opened to show its points, its total, and the written rationale. Only 70 and above enters outreach."
        status={
          <>
            <StatusDot done={ready} />
            <span className="truncate">{ready ? "Scored" : "Scoring this run"}</span>
          </>
        }
        footer={
          <>
            <span className="flex items-center gap-2 text-[0.75rem] font-medium text-foreground">
              <Sparkles className="size-3.5 text-[var(--fb-strong)]" />
              Only 70+ enters outreach
              <span className="hidden text-[var(--ink-3)] sm:inline">· {QUALIFIED} this run</span>
            </span>
            <span className="flex items-center gap-1 text-[0.75rem] font-semibold text-[var(--fb-strong)]">
              Sent to outreach <ArrowRight className="size-3.5" />
            </span>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-px border-b border-[var(--hairline)] bg-[var(--hairline)] md:grid-cols-4">
          <Figure label="Scored">
            <motion.span>{scored}</motion.span>
          </Figure>
          <Figure label="Passed fit gate">
            <motion.span>{passed}</motion.span>
          </Figure>
          <Figure label="70+ to outreach">
            <motion.span>{qualified}</motion.span>
          </Figure>
          <Figure label="Avg. qualified score">
            <motion.span>{avg}</motion.span>
          </Figure>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)] md:grid-cols-[15rem_minmax(0,1fr)]">
          {/* The scored list */}
          <aside className={cn("hidden border-r border-[var(--hairline)] p-3 md:block", SOFT)}>
            <p className="px-2 pb-1.5 pt-1 text-[0.65rem] font-medium text-[var(--ink-3)]">Scored prospects</p>
            <ul className="space-y-0.5">
              {LIST.map((row, i) => {
                const on = ready && i === active;
                const held = row.score < 70;
                return (
                  <li
                    key={row.person.name}
                    className={cn(
                      "relative flex items-center justify-between gap-2 rounded-lg px-2 py-1.5",
                      held && "opacity-55",
                    )}
                  >
                    {on && (
                      <motion.span
                        layoutId={listId}
                        transition={{ type: "spring", stiffness: 380, damping: 34 }}
                        className="absolute inset-0 rounded-lg bg-white shadow-[0_1px_2px_rgba(16,24,40,0.06),inset_0_0_0_1px_rgba(22,111,229,0.2)]"
                      />
                    )}
                    <span className="relative min-w-0">
                      <Who person={row.person} />
                    </span>
                    <span className="relative shrink-0">
                      {ready ? (
                        <ScoreRing score={row.score} size="sm" />
                      ) : (
                        <span className="block size-8 rounded-full bg-[rgba(12,16,26,0.06)] motion-safe:animate-pulse" />
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 px-2 text-[0.68rem] text-[var(--ink-3)]">
              Under 70 is held back from outreach
            </p>
          </aside>

          {/* One prospect, opened (skeleton while the run is still scoring) */}
          <div className="relative min-h-[19rem] min-w-0 p-4 lg:p-5">
            {!ready && <OpenedSkeleton />}
            {ready && (
              <AnimatePresence initial={false} mode="wait">
                <motion.div
                  key={open.person.name}
                  initial={reduce ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? undefined : { opacity: 0, y: -6 }}
                  transition={{ duration: 0.3, ease: EASE }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <Who person={open.person} size="lg" />
                    <span className="shrink-0 text-right">
                      <span className="text-[1.6rem] font-semibold leading-none tracking-tight text-[#13824a] tabular-nums">
                        {total(open)}
                      </span>
                      <span className="text-[0.8rem] font-medium text-[var(--ink-3)]">/100</span>
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    {/* Stage 1 */}
                    <div className="rounded-xl border border-[var(--hairline)] p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-[0.7rem] font-semibold text-foreground">1 · Fit gate</p>
                        <span className="rounded-md bg-[#e3f5ea] px-1.5 py-0.5 text-[0.62rem] font-semibold text-[#13824a]">
                          Passed
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {["Title", "Seniority", "Industry", "Size", "Region"].map((r) => (
                          <RuleChip key={r} label={r} />
                        ))}
                      </div>
                      <div className="mt-2.5 space-y-1">
                        {open.fit.map((r) => (
                          <div key={r.label} className="flex items-center justify-between text-[0.72rem]">
                            <span className="truncate text-[var(--ink-3)]">{r.label}</span>
                            <span className="font-semibold tabular-nums text-foreground">+{r.pts}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Stage 2 */}
                    <div className="rounded-xl border border-[var(--hairline)] p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-[0.7rem] font-semibold text-foreground">2 · AI rank on signals</p>
                        <span className="text-[0.68rem] font-semibold tabular-nums text-[var(--fb-strong)]">
                          +{sigPts}
                        </span>
                      </div>
                      <div className="mt-2.5 space-y-1.5">
                        {open.signals.map((r, i) => (
                          <motion.div
                            key={r.label}
                            initial={reduce ? false : { opacity: 0, x: -6 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.35, delay: reduce ? 0 : 0.15 + i * 0.1, ease: EASE }}
                            className="flex items-center justify-between gap-2 rounded-lg bg-[var(--cyan-tint)] px-2 py-1.5 text-[0.72rem]"
                          >
                            <span className="truncate text-foreground">{r.label}</span>
                            <span className="shrink-0 font-semibold tabular-nums text-[var(--fb-strong)]">+{r.pts}</span>
                          </motion.div>
                        ))}
                      </div>
                      <p className="mt-2 text-[0.65rem] text-[var(--ink-4)]">Fit points {fitPts} · signals {sigPts}</p>
                    </div>
                  </div>

                  {/* The rationale */}
                  <div className="mt-3 rounded-xl border border-[rgba(24,119,242,0.25)] bg-[#f8fbff] p-3">
                    <p className="text-[0.68rem] font-semibold text-[var(--fb-strong)]">Why {total(open)}</p>
                    <dl className="mt-1.5 grid gap-1.5 text-[0.72rem] sm:grid-cols-3">
                      {(
                        [
                          ["Pain point", open.why.pain],
                          ["Trigger", open.why.trigger],
                          ["Angle to open with", open.why.angle],
                        ] as const
                      ).map(([k, v]) => (
                        <div key={k}>
                          <dt className="text-[0.62rem] font-medium text-[var(--ink-3)]">{k}</dt>
                          <dd className="mt-0.5 font-medium leading-snug text-foreground">{v}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </div>
      </AppWindow>
    </div>
  );
}
