"use client";

import { useEffect, useReducer, useRef, useSyncExternalStore, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, ChevronDown, Clock, Radar, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { VanteraLogo } from "@/components/landing/vantera-logo";
import { CEILING_FACT } from "@/components/landing/claims";
import { POOL, openerLength, type Part, type Prospect } from "./autopilot-outreach.data";

/**
 * /features/autopilot-outreach, running: one workspace's outreach on autopilot. The
 * queue on the left is live: the prospect in the middle is being written to — the
 * opener types out from the signal it was written from, passes the humanizer, the
 * suppression check and today's pacing, and sends. Then the queue slides up, the next
 * prospect is written to, and the day's counts climb.
 *
 * Starts when nearly half of it is on screen, walks the queue once and rests there,
 * the way autopilot waits out its pacing; it starts over once it has fully left. The
 * server (and reduced motion) render the first message, sent. Every number is a
 * sample, and the window says so.
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

type Phase = "writing" | "checking" | "sent";

const SENT_TODAY = 31;
const DAILY_PACE = 50;
const SENT_WEEK = 74;
const REPLIES = 18;
const MEETINGS = 6;
/* Characters per tick while an opener types out, and the tick. */
const STEP = 3;
const TICK_MS = 28;
const CHECKS_MS = 1300;
const SENT_MS = 2300;
/* The queue shows five rows and the message is written to the middle one. One lap
   walks it until its last row is the last prospect, so no one is written to twice. */
const ROWS = 5;
const LAP = POOL.length - ROWS;
/* Minutes to the next send at each step of the lap, varied like the randomized pacing
   they stand for. */
const NEXT_MIN = [6, 4, 9, 5, 7, 3, 8, 11];
const CHECKS = ["Humanized", "Suppression checked", "Inside today's pacing"];

/** The prospect `offset` rows down the queue when `head` is its top row. */
function at(head: number, offset: number): Prospect {
  return POOL[head + offset];
}

interface Run {
  /** The queue's top row; the message is written to row 2. */
  head: number;
  sends: number;
  phase: Phase;
  typed: number;
  checks: number;
  running: boolean;
}

type Action =
  | { type: "enter" | "leave" | "written" | "sent" | "next" }
  | { type: "typed"; n: number }
  | { type: "checked"; n: number };

/* The server's render, and reduced motion's: the first message, sent. */
const FINISHED: Run = {
  head: 0,
  sends: 0,
  phase: "sent",
  typed: openerLength(at(0, 2)),
  checks: CHECKS.length,
  running: false,
};

function advance(r: Run, a: Action): Run {
  switch (a.type) {
    case "enter":
      return r.running ? r : { ...FINISHED, running: true };
    case "leave":
      return FINISHED;
    case "typed":
      return { ...r, typed: a.n };
    case "written":
      return { ...r, phase: "checking", checks: 0 };
    case "checked":
      return { ...r, checks: a.n };
    case "sent":
      return { ...r, phase: "sent", sends: r.sends + 1 };
    case "next":
      return { ...r, head: r.head + 1, typed: 0, checks: 0, phase: "writing" };
  }
}

/** The first `count` characters of an opener, its marked phrase still marked. */
function Typed({ parts, count }: { parts: Part[]; count: number }) {
  const shown: string[] = [];
  let left = count;
  for (const p of parts) {
    shown.push(p.text.slice(0, Math.max(0, left)));
    left -= p.text.length;
  }
  return (
    <>
      {parts.map((p, i) => {
        if (!shown[i]) return null;
        return p.mark ? (
          <mark
            key={i}
            className="rounded-[3px] bg-[var(--cyan-tint)] px-0.5 text-foreground underline decoration-[var(--fb)]/50 decoration-1 underline-offset-2"
          >
            {shown[i]}
          </mark>
        ) : (
          <span key={i}>{shown[i]}</span>
        );
      })}
    </>
  );
}

function Figure({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="bg-white px-4 py-3.5 lg:px-5">
      <p className="text-[0.7rem] font-medium text-[var(--ink-3)]">{label}</p>
      <div className="mt-1.5 flex h-7 items-baseline gap-1.5 text-[1.4rem] font-semibold leading-7 tracking-tight text-foreground tabular-nums">
        {children}
      </div>
    </div>
  );
}

/** A number that rolls up to its new value. */
function Roll({ value }: { value: number }) {
  return (
    <span className="relative inline-flex overflow-hidden">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={value}
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "-100%", opacity: 0 }}
          transition={{ duration: 0.35, ease: EASE }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function Status({ kind }: { kind: "sent" | "sending" | "queued" }) {
  if (kind === "sent")
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-[#e3f5ea] px-1.5 py-0.5 text-[0.62rem] font-semibold text-[#13824a]">
        <Check className="size-2.5" strokeWidth={3} />
        Sent
      </span>
    );
  if (kind === "sending")
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-[var(--cyan-tint)] px-1.5 py-0.5 text-[0.62rem] font-semibold text-[var(--cyan-strong)]">
        <span className="size-1.5 animate-pulse rounded-full bg-[var(--fb)] motion-reduce:animate-none" />
        Sending
      </span>
    );
  return (
    <span className="inline-flex shrink-0 items-center rounded-md bg-[rgba(12,16,26,0.05)] px-1.5 py-0.5 text-[0.62rem] font-semibold text-[var(--ink-3)]">
      Queued
    </span>
  );
}

function Avatar({ p, size = "md" }: { p: Prospect; size?: "sm" | "md" }) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-semibold text-white",
        size === "md" ? "size-8 text-[11px]" : "size-7 text-[10px]",
      )}
      style={{ backgroundColor: p.tint }}
    >
      {p.initials}
    </span>
  );
}

export function OutreachWindow() {
  const ref = useRef<HTMLDivElement>(null);
  const still = useStill();
  const [run, dispatch] = useReducer(advance, FINISHED);

  // Start when nearly half of it shows; once it has fully left, back to the first
  // message, so the next visit walks the queue again. Reduced motion never starts it.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        if (!entry.isIntersecting) dispatch({ type: "leave" });
        else if (entry.intersectionRatio >= 0.45) dispatch({ type: "enter" });
      },
      { threshold: [0, 0.45] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // The timeline: write, check, send, move down the queue — until the lap is done.
  const { running, phase: livePhase, head: liveHead } = run;
  useEffect(() => {
    if (!running || still) return;
    if (livePhase === "writing") {
      const total = openerLength(at(liveHead, 2));
      let n = 0;
      const id = window.setInterval(() => {
        n = Math.min(total, n + STEP);
        dispatch({ type: "typed", n });
        if (n >= total) {
          window.clearInterval(id);
          dispatch({ type: "written" });
        }
      }, TICK_MS);
      return () => window.clearInterval(id);
    }
    if (livePhase === "checking") {
      const ids = CHECKS.map((_, i) =>
        window.setTimeout(
          () => dispatch({ type: "checked", n: i + 1 }),
          ((i + 1) * CHECKS_MS) / (CHECKS.length + 1),
        ),
      );
      ids.push(window.setTimeout(() => dispatch({ type: "sent" }), CHECKS_MS));
      return () => ids.forEach((id) => window.clearTimeout(id));
    }
    if (liveHead === LAP) return;
    const id = window.setTimeout(() => dispatch({ type: "next" }), SENT_MS);
    return () => window.clearTimeout(id);
  }, [running, still, livePhase, liveHead]);

  const { head, sends, phase, typed, checks } = still ? FINISHED : run;
  const current = at(head, 2);
  const sentToday = SENT_TODAY + sends;
  const rows = POOL.slice(head, head + ROWS);

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
        <span className="text-[0.82rem] font-semibold text-foreground">Outreach</span>
        <span className="hidden items-center gap-1 rounded-md border border-[rgba(12,16,26,0.08)] bg-white px-2 py-0.5 text-[0.7rem] font-medium text-foreground sm:flex">
          Northwind
          <ChevronDown className="size-3 text-[var(--ink-4)]" />
        </span>
        <span className="ml-auto flex items-center gap-2.5">
          <span className="flex items-center gap-1.5 text-[0.7rem] font-medium text-[var(--ink-3)]">
            <span className="relative flex size-1.5">
              {phase !== "sent" && (
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--fb)]/60" />
              )}
              <span
                className={cn(
                  "relative inline-flex size-1.5 rounded-full transition-colors duration-300",
                  phase === "sent" ? "bg-[#13a05a]" : "bg-[var(--fb)]",
                )}
              />
            </span>
            {phase === "sent" ? "On autopilot" : "Sending at a human pace"}
          </span>
          <span className="hidden rounded-md border border-[rgba(12,16,26,0.08)] px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.1em] text-[var(--ink-3)] sm:inline">
            Sample
          </span>
        </span>
      </div>

      {/* Today and this week */}
      <div className="grid grid-cols-2 gap-px border-b border-[var(--hairline)] bg-[rgba(12,16,26,0.06)] md:grid-cols-4">
        <div className="bg-white px-4 py-3.5 lg:px-5">
          <p className="text-[0.7rem] font-medium text-[var(--ink-3)]">Sent today</p>
          <div className="mt-1.5 flex h-7 items-baseline gap-1.5 text-[1.4rem] font-semibold leading-7 tracking-tight text-foreground tabular-nums">
            <Roll value={sentToday} />
            <span className="text-[0.8rem] font-medium text-[var(--ink-4)]">/ {DAILY_PACE}</span>
          </div>
          <span className="mt-2 block h-1 overflow-hidden rounded-full bg-[rgba(12,16,26,0.06)]">
            <motion.span
              className="block h-full rounded-full bg-[var(--fb)]"
              initial={false}
              animate={{ width: `${(sentToday / DAILY_PACE) * 100}%` }}
              transition={{ duration: 0.6, ease: EASE }}
            />
          </span>
        </div>
        <Figure label="This week">
          <Roll value={SENT_WEEK + sends} />
          <span className="text-[0.8rem] font-medium text-[var(--ink-4)]">of {CEILING_FACT.split(" ")[0]}</span>
        </Figure>
        <Figure label="Replies">
          <span>{REPLIES}</span>
        </Figure>
        <Figure label="Meetings booked">
          <span>{MEETINGS}</span>
        </Figure>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] md:grid-cols-[17rem_minmax(0,1fr)]">
        {/* The queue */}
        <aside className="hidden border-r border-[var(--hairline)] bg-[color-mix(in_oklab,var(--tint)_55%,white)] p-3 md:block">
          <p className="flex items-center justify-between px-2 pb-1.5 pt-1 text-[0.65rem] font-medium text-[var(--ink-3)]">
            Queue
            <span className="text-[var(--ink-4)]">fit 70+ only</span>
          </p>
          <ul className="relative space-y-1">
            <AnimatePresence initial={false} mode="popLayout">
              {rows.map((p, i) => {
                const kind = i < 2 ? "sent" : i === 2 ? (phase === "sent" ? "sent" : "sending") : "queued";
                return (
                  <motion.li
                    key={p.name}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.4, ease: EASE }}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-2 py-2",
                      i === 2 ? "bg-white shadow-[inset_0_0_0_1px_rgba(24,119,242,0.2)]" : "",
                    )}
                  >
                    <Avatar p={p} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.74rem] font-semibold text-foreground">{p.name}</span>
                      <span className="block truncate text-[0.65rem] text-[var(--ink-3)]">{p.signal}</span>
                    </span>
                    <Status kind={kind} />
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        </aside>

        {/* The message being written */}
        <div className="min-w-0 p-4 lg:p-5">
          <AnimatePresence initial={false} mode="wait">
            <motion.div
              key={current.name}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3, ease: EASE }}
            >
              <div className="flex items-center gap-3">
                <Avatar p={current} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.82rem] font-semibold text-foreground">{current.name}</p>
                  <p className="truncate text-[0.7rem] text-[var(--ink-3)]">{current.role}</p>
                </div>
                <span className="shrink-0 rounded-md bg-[var(--cyan-tint)] px-1.5 py-0.5 text-[0.65rem] font-semibold tabular-nums text-[var(--cyan-strong)]">
                  Fit {current.fit}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[0.68rem]">
                <span className="text-[var(--ink-3)]">Written from</span>
                <span className="inline-flex items-center gap-1 rounded-md border border-[rgba(12,16,26,0.08)] bg-white px-1.5 py-0.5 font-medium text-foreground">
                  <Radar className="size-3 text-[var(--fb)]" />
                  {current.signal}
                </span>
              </div>

              <div className="mt-3 rounded-xl border border-[var(--hairline)] bg-[color-mix(in_oklab,var(--tint)_45%,white)] p-3.5">
                <p className="text-[0.62rem] font-medium text-[var(--ink-4)]">Connection request note</p>
                <p className="mt-1.5 min-h-[4.5rem] text-[0.8rem] leading-relaxed text-[var(--ink-2)]">
                  <Typed parts={current.opener} count={typed} />
                  {phase === "writing" && (
                    <span className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[0.15em] animate-pulse rounded-full bg-[var(--fb)] motion-reduce:hidden" />
                  )}
                </p>
                <div className="mt-2.5 flex items-center gap-1.5 border-t border-[var(--hairline)] pt-2.5 text-[0.68rem]">
                  <Target className="size-3 text-[var(--fb)]" />
                  <span className="text-[var(--ink-3)]">Goal</span>
                  <span className="rounded-md bg-[var(--cyan-tint)] px-1.5 py-0.5 font-semibold text-[var(--cyan-strong)]">
                    Book a 20-min call
                  </span>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                {CHECKS.map((c, i) => (
                  <span
                    key={c}
                    className={cn(
                      "inline-flex items-center gap-1 text-[0.68rem] font-medium transition-colors duration-300",
                      checks > i ? "text-[#13824a]" : "text-[var(--ink-4)]",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-3.5 place-items-center rounded-full transition-colors duration-300",
                        checks > i ? "bg-[#e3f5ea]" : "bg-[rgba(12,16,26,0.05)]",
                      )}
                    >
                      <Check className="size-2" strokeWidth={3.4} />
                    </span>
                    {c}
                  </span>
                ))}
              </div>

              <p className="mt-3 flex h-5 items-center gap-1.5 text-[0.72rem] font-medium">
                {phase === "sent" ? (
                  <span className="flex items-center gap-1.5 text-[#13824a]">
                    <span className="size-1.5 rounded-full bg-[#13a05a]" />
                    Sent on autopilot · just now
                  </span>
                ) : phase === "checking" ? (
                  <span className="text-[var(--ink-3)]">Running checks before it sends…</span>
                ) : (
                  <span className="text-[var(--ink-3)]">Writing from the signal…</span>
                )}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Pacing */}
      <div className="flex items-center justify-between gap-3 border-t border-[var(--hairline)] bg-[color-mix(in_oklab,var(--tint)_55%,white)] px-4 py-3">
        <span className="flex min-w-0 items-center gap-2 text-[0.75rem] font-medium text-foreground">
          <Clock className="size-3.5 shrink-0 text-[var(--fb)]" />
          <span className="truncate">
            {phase === "sent" ? `Next send in ${NEXT_MIN[head % NEXT_MIN.length]} min` : "Sending now"}
            <span className="text-[var(--ink-3)]"> · randomized pacing</span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-[0.75rem] font-semibold text-[var(--fb-strong)]">
          Sent today <ArrowRight className="size-3.5" />
        </span>
      </div>
    </div>
  );
}
