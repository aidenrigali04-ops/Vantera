"use client";

import { useEffect, useReducer, useRef, useSyncExternalStore, type ReactNode } from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { ArrowDown, ArrowRight, ArrowUp, ChevronDown, FlaskConical, Minus, RotateCcw, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { VanteraLogo } from "@/components/landing/vantera-logo";

/**
 * /features/machine-learned-targeting, running: the targeting model on one workspace.
 * The month's outcomes count up, a test runs on a 10% slice of new conversations, and
 * when it's decided the segment weights shift: a winner is kept and weighted up, a
 * loser is rolled back. Two tests alternate so both endings show.
 *
 * Starts when nearly half of it is on screen and starts over once it has fully left.
 * The server (and reduced motion) render the finished state of the first test. Every
 * number is a sample, and the window says so.
 */

const EASE = [0.16, 1, 0.3, 1] as const;

const noSubscribe = () => () => {};

/** Reduced motion, but only once hydrated: the server can't know the preference, so the
    first client render must match the server's. */
function useStill() {
  const reduce = useReducedMotion();
  const hydrated = useSyncExternalStore(noSubscribe, () => true, () => false);
  return hydrated && Boolean(reduce);
}

type Frame = "count" | "test" | "decided";
interface Timeline {
  test: number;
  frame: Frame;
  running: boolean;
}
type Step = "enter" | "leave" | "tested" | "decided" | "next";

/* The server's render, and reduced motion's: the first test, decided. */
const FINISHED: Timeline = { test: 0, frame: "decided", running: false };

function advance(t: Timeline, step: Step): Timeline {
  switch (step) {
    case "enter":
      return t.running ? t : { test: 0, frame: "count", running: true };
    case "leave":
      return { test: 0, frame: "count", running: false };
    case "tested":
      return { ...t, frame: "test" };
    case "decided":
      return { ...t, frame: "decided" };
    case "next":
      return { ...t, test: (t.test + 1) % TESTS.length, frame: "test" };
  }
}

type Trend = "up" | "down" | "flat";

interface Segment {
  label: string;
  /** The direction the segment was last moved, before the first test here. */
  start: Trend;
  /** Weight before test #12, after it, and after #13, as a share of the bar. A test
      that's rolled back leaves its segment where it was. */
  weights: [number, number, number];
}

const SEGMENTS: Segment[] = [
  { label: "VP Sales · SaaS 11–50", start: "up", weights: [0.78, 0.8, 0.82] },
  { label: "RevOps leads · Series A", start: "flat", weights: [0.44, 0.71, 0.72] },
  { label: "Head of Growth · agencies", start: "up", weights: [0.66, 0.66, 0.67] },
  { label: "Posted about hiring · 14d", start: "up", weights: [0.58, 0.6, 0.61] },
  { label: "Changed jobs · 30d", start: "flat", weights: [0.52, 0.52, 0.52] },
  { label: "Enterprise · 1,000+", start: "down", weights: [0.24, 0.21, 0.2] },
];

interface Test {
  id: string;
  name: string;
  control: { label: string; sent: number; interested: number };
  challenger: { label: string; sent: number; interested: number };
  kept: boolean;
  /** The segment the decision moves. */
  moves: number;
  result: string;
}

const TESTS: Test[] = [
  {
    id: "Test #12",
    name: "Weight up RevOps leads at Series A",
    control: { label: "Current mix", sent: 412, interested: 58 },
    challenger: { label: "+ RevOps · Series A", sent: 46, interested: 10 },
    kept: true,
    moves: 1,
    result: "Kept · RevOps · Series A weighted up",
  },
  {
    id: "Test #13",
    name: "Prioritise recent job changes",
    control: { label: "Current mix", sent: 398, interested: 56 },
    challenger: { label: "+ Changed jobs · 30d", sent: 44, interested: 3 },
    kept: false,
    moves: 4,
    result: "Rolled back automatically",
  },
];

const FIGURES = { replies: 214, meetings: 38, accept: 41, segments: 7 };

/* Frame lengths: counting (first pass only), testing, decided. */
const COUNT_MS = 1900;
const TEST_MS = 2600;
const DECIDED_MS = 4200;

function rate(interested: number, sent: number) {
  return Math.round((interested / sent) * 100);
}

/** The segment's last real move as of weight state `k`: a move under 0.05 keeps the
    chip it had. */
function trendOf(segment: Segment, k: number): Trend {
  let trend = segment.start;
  for (let j = 1; j <= k; j++) {
    const delta = segment.weights[j] - segment.weights[j - 1];
    if (delta > 0.05) trend = "up";
    else if (delta < -0.05) trend = "down";
  }
  return trend;
}

function TrendChip({ trend }: { trend: Trend }) {
  if (trend === "up")
    return (
      <span className="inline-flex items-center gap-0.5 rounded-md bg-[#e3f5ea] px-1.5 py-0.5 text-[0.62rem] font-semibold text-[#13824a]">
        <ArrowUp className="size-2.5" strokeWidth={2.6} />
        More
      </span>
    );
  if (trend === "down")
    return (
      <span className="inline-flex items-center gap-0.5 rounded-md bg-[rgba(12,16,26,0.05)] px-1.5 py-0.5 text-[0.62rem] font-semibold text-[var(--ink-3)]">
        <ArrowDown className="size-2.5" strokeWidth={2.6} />
        Less
      </span>
    );
  return (
    <span className="inline-flex items-center gap-0.5 rounded-md bg-[rgba(12,16,26,0.04)] px-1.5 py-0.5 text-[0.62rem] font-semibold text-[var(--ink-4)]">
      <Minus className="size-2.5" strokeWidth={2.6} />
      Hold
    </span>
  );
}

function Figure({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="bg-white px-4 py-3.5 lg:px-5">
      <p className="text-[0.7rem] font-medium text-[var(--ink-3)]">{label}</p>
      <div className="mt-1.5 flex h-7 items-center gap-2 text-[1.4rem] font-semibold leading-none tracking-tight text-foreground tabular-nums">
        {children}
      </div>
    </div>
  );
}

/** A count that climbs from zero while `progress` runs 0 → 1. */
function Count({ progress, to }: { progress: MotionValue<number>; to: number }) {
  const shown = useTransform(progress, (p) => Math.round(p * to).toLocaleString("en-US"));
  return <motion.span>{shown}</motion.span>;
}

/** A variant's numbers, filling in while the test runs (`run` 0 → 1). */
function Variant({
  tag,
  label,
  sent,
  interested,
  run,
  outcome,
}: {
  tag: string;
  label: string;
  sent: number;
  interested: number;
  run: MotionValue<number>;
  outcome: "kept" | "rolled" | "control" | null;
}) {
  const shownSent = useTransform(run, (p) => Math.round(sent * (0.35 + 0.65 * p)).toLocaleString("en-US"));
  const shownInterested = useTransform(run, (p) => Math.round(interested * (0.35 + 0.65 * p)));
  const pct = rate(interested, sent);
  const width = useTransform(run, (p) => `${Math.min(100, pct * 3.4 * (0.35 + 0.65 * p))}%`);
  return (
    <div
      className={cn(
        "rounded-lg border bg-white px-3 py-2.5 transition-[border-color,background-color] duration-500",
        outcome === "kept"
          ? "border-[rgba(19,130,74,0.3)] bg-[color-mix(in_oklab,#13824a_4%,white)]"
          : outcome === "rolled"
            ? "border-[rgba(225,29,72,0.25)] bg-[color-mix(in_oklab,#e11d48_3%,white)]"
            : "border-[var(--hairline)]",
      )}
    >
      <div className="flex items-center gap-2">
        <span className="grid size-5 shrink-0 place-items-center rounded-md bg-[rgba(12,16,26,0.05)] text-[0.62rem] font-semibold text-[var(--ink-2)]">
          {tag}
        </span>
        <span className="truncate text-[0.76rem] font-medium text-foreground">{label}</span>
        <span className="ml-auto shrink-0">
          <AnimatePresence initial={false} mode="popLayout">
            {outcome === "kept" && (
              <motion.span
                key="kept"
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 520, damping: 24 }}
                className="inline-flex items-center gap-1 rounded-md bg-[#13824a] px-1.5 py-0.5 text-[0.62rem] font-semibold text-white"
              >
                <ArrowUp className="size-2.5" strokeWidth={3} />
                Kept
              </motion.span>
            )}
            {outcome === "rolled" && (
              <motion.span
                key="rolled"
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 520, damping: 24 }}
                className="inline-flex items-center gap-1 rounded-md bg-[#fdedf1] px-1.5 py-0.5 text-[0.62rem] font-semibold text-[#be123c]"
              >
                <RotateCcw className="size-2.5" strokeWidth={3} />
                Rolled back
              </motion.span>
            )}
            {outcome === "control" && (
              <motion.span
                key="control"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-[0.62rem] font-medium text-[var(--ink-4)]"
              >
                Baseline
              </motion.span>
            )}
          </AnimatePresence>
        </span>
      </div>
      <div className="mt-2 grid grid-cols-[1fr_auto] items-center gap-3">
        <span className="block h-1.5 overflow-hidden rounded-full bg-[rgba(12,16,26,0.06)]">
          <motion.span
            className={cn("block h-full rounded-full", outcome === "rolled" ? "bg-[#f43f5e]" : "bg-[var(--fb)]")}
            style={{ width }}
          />
        </span>
        <span className="text-[0.68rem] tabular-nums text-[var(--ink-3)]">
          <motion.span>{shownInterested}</motion.span> interested of <motion.span>{shownSent}</motion.span>
          <span className="ml-1.5 font-semibold text-foreground">{pct}%</span>
        </span>
      </div>
    </div>
  );
}

export function TargetingWindow() {
  const ref = useRef<HTMLDivElement>(null);
  const still = useStill();
  const [timeline, step] = useReducer(advance, FINISHED);
  const counted = useMotionValue(1);
  const run = useMotionValue(1);
  const done = useMotionValue(1);

  // Start when nearly half of it shows; once it has fully left, back to the start, so
  // the next visit sees the model at work. Reduced motion never starts it.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        if (!entry.isIntersecting) {
          counted.jump(0);
          run.jump(0);
          step("leave");
        } else if (entry.intersectionRatio >= 0.45) {
          step("enter");
        }
      },
      { threshold: [0, 0.45] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [counted, run]);

  // The timeline.
  const { running, frame: liveFrame } = timeline;
  useEffect(() => {
    if (!running || still) return;
    if (liveFrame === "count") {
      counted.jump(0);
      const controls = animate(counted, 1, { duration: COUNT_MS / 1000, ease: [0.33, 0, 0.2, 1] });
      const id = window.setTimeout(() => step("tested"), COUNT_MS);
      return () => {
        controls.stop();
        window.clearTimeout(id);
      };
    }
    if (liveFrame === "test") {
      run.jump(0);
      const controls = animate(run, 1, { duration: (TEST_MS - 300) / 1000, ease: "linear" });
      const id = window.setTimeout(() => step("decided"), TEST_MS);
      return () => {
        controls.stop();
        window.clearTimeout(id);
      };
    }
    const id = window.setTimeout(() => step("next"), DECIDED_MS);
    return () => window.clearTimeout(id);
  }, [running, still, liveFrame, timeline.test, counted, run]);

  const { test, frame } = still ? FINISHED : timeline;
  /* Reduced motion shows the finished numbers, whatever the motion values were left at. */
  const counts = still ? done : counted;
  const fill = still ? done : run;
  const t = TESTS[test];
  const decided = frame === "decided";
  const status =
    frame === "count" ? "Learning from outcomes" : frame === "test" ? "Testing on 10%" : "Model updated · just now";

  return (
    <div
      ref={ref}
      className="overflow-hidden rounded-[14px] border border-white/70 bg-white text-left shadow-[0_2px_6px_rgba(3,22,58,0.16),0_40px_80px_-32px_rgba(3,22,58,0.55)]"
    >
      {/* Title bar */}
      <div className="flex h-12 items-center gap-3 border-b border-[var(--hairline)] px-4">
        <span className="grid size-6 shrink-0 place-items-center rounded-[7px] bg-[var(--fb)]">
          <VanteraLogo className="size-3.5 text-white" />
        </span>
        <span className="text-[0.82rem] font-semibold text-foreground">Targeting model</span>
        <span className="hidden items-center gap-1 rounded-md border border-[rgba(12,16,26,0.08)] bg-white px-2 py-0.5 text-[0.7rem] font-medium text-foreground sm:flex">
          Northwind
          <ChevronDown className="size-3 text-[var(--ink-4)]" />
        </span>
        <span className="ml-auto flex items-center gap-2.5">
          <span className="flex items-center gap-1.5 text-[0.7rem] font-medium text-[var(--ink-3)]">
            <span className="relative flex size-1.5">
              {!decided && (
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--fb)]/60" />
              )}
              <span
                className={cn(
                  "relative inline-flex size-1.5 rounded-full transition-colors duration-300",
                  decided ? "bg-[#13a05a]" : "bg-[var(--fb)]",
                )}
              />
            </span>
            {status}
          </span>
          <span className="hidden rounded-md border border-[rgba(12,16,26,0.08)] px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.1em] text-[var(--ink-3)] sm:inline">
            Sample
          </span>
        </span>
      </div>

      {/* The month's outcomes */}
      <div className="grid grid-cols-2 gap-px border-b border-[var(--hairline)] bg-[rgba(12,16,26,0.06)] md:grid-cols-4">
        <Figure label="Replies learned from">
          <Count progress={counts} to={FIGURES.replies} />
        </Figure>
        <Figure label="Meetings booked">
          <Count progress={counts} to={FIGURES.meetings} />
        </Figure>
        <Figure label="Accept rate">
          <Count progress={counts} to={FIGURES.accept} />%
          <span className="inline-flex items-center gap-0.5 rounded-md bg-[#e3f5ea] px-1.5 py-0.5 text-[0.62rem] font-semibold tracking-normal text-[#13824a]">
            <ArrowUp className="size-2.5" strokeWidth={2.6} />6 pts
          </span>
        </Figure>
        <Figure label="Segments reweighted">
          <Count progress={counts} to={FIGURES.segments} />
        </Figure>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] md:grid-cols-[17rem_minmax(0,1fr)]">
        {/* Segment weights */}
        <aside className="hidden border-r border-[var(--hairline)] bg-[color-mix(in_oklab,var(--tint)_55%,white)] p-3 md:block">
          <p className="flex items-center justify-between px-2 pb-1.5 pt-1 text-[0.65rem] font-medium text-[var(--ink-3)]">
            Segment weights
            <span className="text-[var(--ink-4)]">within your ICP</span>
          </p>
          <ul className="space-y-1">
            {SEGMENTS.map((s, i) => {
              const k = decided ? test + 1 : test;
              const weight = s.weights[k];
              const moving = decided && i === t.moves;
              return (
                <li
                  key={s.label}
                  className={cn(
                    "rounded-lg px-2 py-1.5 transition-colors duration-500",
                    moving ? "bg-white shadow-[inset_0_0_0_1px_rgba(24,119,242,0.18)]" : "",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[0.74rem] font-medium text-foreground/85">{s.label}</span>
                    <TrendChip trend={trendOf(s, k)} />
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="block h-1 flex-1 overflow-hidden rounded-full bg-[rgba(12,16,26,0.06)]">
                      <motion.span
                        className="block h-full rounded-full bg-[var(--fb)]"
                        initial={false}
                        animate={{ width: `${Math.round(weight * 100)}%`, opacity: weight < 0.3 ? 0.45 : 1 }}
                        transition={{ duration: 0.9, ease: EASE }}
                      />
                    </span>
                    <span className="w-6 text-right text-[0.62rem] tabular-nums text-[var(--ink-4)]">
                      {weight.toFixed(2).slice(1)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* What it's testing */}
        <div className="min-w-0 p-4 lg:p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-[0.82rem] font-semibold text-foreground">
              <FlaskConical className="size-3.5 text-[var(--fb)]" />
              What it&rsquo;s testing
            </p>
            <span className="rounded-md bg-[var(--cyan-tint)] px-1.5 py-0.5 text-[0.65rem] font-semibold text-[var(--cyan-strong)]">
              10% of new conversations
            </span>
          </div>

          <AnimatePresence initial={false} mode="wait">
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="mt-3 rounded-xl border border-[var(--hairline)] bg-[color-mix(in_oklab,var(--tint)_45%,white)] p-3"
            >
              <p className="flex items-baseline justify-between gap-3 px-0.5">
                <span className="truncate text-[0.78rem] font-semibold text-foreground">{t.name}</span>
                <span className="shrink-0 text-[0.65rem] tabular-nums text-[var(--ink-4)]">{t.id}</span>
              </p>
              <div className="mt-2.5 space-y-1.5">
                <Variant
                  tag="A"
                  label={t.control.label}
                  sent={t.control.sent}
                  interested={t.control.interested}
                  run={fill}
                  outcome={decided ? "control" : null}
                />
                <Variant
                  tag="B"
                  label={t.challenger.label}
                  sent={t.challenger.sent}
                  interested={t.challenger.interested}
                  run={fill}
                  outcome={decided ? (t.kept ? "kept" : "rolled") : null}
                />
              </div>
              <div className="mt-2.5 flex h-5 items-center gap-1.5 px-0.5 text-[0.7rem] font-medium">
                {decided ? (
                  <span className={cn("flex items-center gap-1.5", t.kept ? "text-[#13824a]" : "text-[#be123c]")}>
                    {t.kept ? <ArrowUp className="size-3" strokeWidth={2.6} /> : <RotateCcw className="size-3" strokeWidth={2.6} />}
                    {t.result}
                  </span>
                ) : (
                  <span className="text-[var(--ink-3)]">Measuring accepted, replied, and booked…</span>
                )}
              </div>
            </motion.div>
          </AnimatePresence>

          <p className="mt-4 px-0.5 text-[0.65rem] font-medium text-[var(--ink-3)]">Recently learned</p>
          <ul className="mt-1.5 space-y-1.5">
            {[
              { text: "Openers that mention their own post", tag: "Kept", good: true },
              { text: "Agencies under 10 people", tag: "Weighted down", good: false },
              { text: "Follow-up on day 4, not day 2", tag: "Kept", good: true },
            ].map((r) => (
              <li
                key={r.text}
                className="flex items-center justify-between gap-3 rounded-lg border border-[var(--hairline)] bg-white px-3 py-2"
              >
                <span className="truncate text-[0.74rem] font-medium text-foreground">{r.text}</span>
                <span
                  className={cn(
                    "shrink-0 rounded-md px-1.5 py-0.5 text-[0.62rem] font-semibold",
                    r.good ? "bg-[#e3f5ea] text-[#13824a]" : "bg-[rgba(12,16,26,0.05)] text-[var(--ink-3)]",
                  )}
                >
                  {r.tag}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* The log */}
      <div className="flex items-center justify-between gap-3 border-t border-[var(--hairline)] bg-[color-mix(in_oklab,var(--tint)_55%,white)] px-4 py-3">
        <span className="flex min-w-0 items-center gap-2 text-[0.75rem] font-medium text-foreground">
          <Sparkles className="size-3.5 shrink-0 text-[var(--fb)]" />
          <span className="truncate">
            Learned from {FIGURES.replies} replies and {FIGURES.meetings} meetings
            <span className="hidden text-[var(--ink-3)] sm:inline"> · Updated today</span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-[0.75rem] font-semibold text-[var(--fb-strong)]">
          Learning log <ArrowRight className="size-3.5" />
        </span>
      </div>
    </div>
  );
}
