"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, LayoutGroup, motion, useInView, useReducedMotion } from "framer-motion";
import { ArrowRight, ArrowUp, Ban, ChevronDown, Hand, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { VanteraLogo } from "@/components/landing/vantera-logo";
import { LinkedinMark } from "@/components/landing/brand-glyphs";
import {
  ARRIVALS,
  Avatar,
  BASE,
  ClassifyingChip,
  EASE,
  LabelChip,
  SENDERS,
  type Label,
  type Thread,
} from "./unified-inbox.parts";

/* Warm first: the inbox sorts by this, then newest first. */
const RANK: Record<Label, number> = {
  Interested: 0,
  Question: 1,
  "Not now": 2,
  "Not interested": 3,
};

/* The counters before anything lands. */
const BASE_COUNTS = { replies: 15, interested: 6, booked: 4, suppressed: 2 };

/* One reply's beats: classifying → classified → answered, then the next lands. */
const BEATS = [1300, 1100, 3600] as const;

/** A number that rolls up to its new value. */
function Roll({ value }: { value: number }) {
  return (
    <span className="relative inline-flex overflow-hidden tabular-nums">
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

function Figure({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="bg-white px-4 py-3.5 lg:px-5">
      <p className="text-[0.7rem] font-medium text-[var(--ink-3)]">{label}</p>
      <div className="mt-1.5 flex h-7 items-center text-[1.4rem] font-semibold leading-none tracking-tight text-foreground tabular-nums">
        {children}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 rounded-[12px] rounded-br-[4px] bg-[#eef4fe] px-3 py-2.5">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="size-1.5 rounded-full bg-[var(--fb)]"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </span>
  );
}

type Phase = 0 | 1 | 2;

/**
 * The inbox, running. While about half of it is on screen a reply lands every few
 * seconds and plays its beats; off screen it goes back to the start, so every visit
 * sees the first reply arrive. With reduced motion it shows the finished state.
 */
export function InboxWindow() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.45 });
  const reduce = useReducedMotion();
  const group = useId();

  const [k, setK] = useState(0);
  const [phase, setPhase] = useState<Phase>(0);
  const [typed, setTyped] = useState(false);

  // Off screen: back to the first reply (adjusted while rendering, not in an effect).
  const [wasInView, setWasInView] = useState(inView);
  if (wasInView !== inView) {
    setWasInView(inView);
    if (!inView) {
      setK(0);
      setPhase(0);
      setTyped(false);
    }
  }

  // The beats of the reply that's landing.
  useEffect(() => {
    if (reduce || !inView) return;
    const ms = BEATS[phase];
    const id = window.setTimeout(() => {
      if (phase < 2) {
        setPhase((phase + 1) as Phase);
      } else {
        setTyped(false);
        setPhase(0);
        setK((n) => (n + 1) % ARRIVALS.length);
      }
    }, ms);
    return () => window.clearTimeout(id);
  }, [inView, reduce, phase, k]);

  // The agent "typing" before its answer appears.
  useEffect(() => {
    if (reduce || phase !== 2) return;
    const id = window.setTimeout(() => setTyped(true), 900);
    return () => window.clearTimeout(id);
  }, [phase, reduce, k]);

  // Reduced motion: every reply has landed and the first is answered.
  const still = !!reduce;
  const current = still ? ARRIVALS[0] : ARRIVALS[k];
  const curPhase: Phase = still ? 2 : phase;
  const answered = still || (phase === 2 && typed);
  const landed = still ? ARRIVALS : ARRIVALS.slice(0, k + 1);

  const classified = (a: Thread) => still || a.id !== current.id || curPhase >= 1;
  const done = landed.filter(classified);
  const counts = {
    replies: BASE_COUNTS.replies + landed.length,
    interested: BASE_COUNTS.interested + done.filter((a) => a.label === "Interested").length,
    booked: BASE_COUNTS.booked,
    suppressed:
      BASE_COUNTS.suppressed +
      landed.filter((a) => a.label === "Not interested" && (a.id !== current.id || answered || still)).length,
  };

  const rows = [...BASE, ...landed]
    .map((t) => ({ t, classifying: !classified(t) }))
    .sort((a, b) => {
      const ra = a.classifying ? -1 : RANK[a.t.label];
      const rb = b.classifying ? -1 : RANK[b.t.label];
      return ra - rb || b.t.t - a.t.t;
    })
    .slice(0, 6);

  const suppressedNow = current.label === "Not interested" && answered;

  return (
    <div
      ref={ref}
      className="overflow-hidden rounded-[14px] border border-white/70 bg-white text-left shadow-[0_2px_6px_rgba(3,22,58,0.16),0_40px_80px_-32px_rgba(3,22,58,0.55)]"
    >
      {/* Title bar */}
      <div className="flex h-12 items-center gap-3 border-b border-[var(--hairline)] px-4">
        <span className="grid size-6 shrink-0 place-items-center rounded-md bg-[var(--fb)]">
          <VanteraLogo className="size-3.5 text-white" />
        </span>
        <span className="text-[0.82rem] font-semibold text-foreground">Inbox</span>
        <span className="hidden items-center gap-1 rounded-md border border-[rgba(12,16,26,0.08)] bg-white px-2 py-0.5 text-[0.7rem] font-medium text-foreground sm:flex">
          All senders · {SENDERS.length}
          <ChevronDown className="size-3 text-[var(--ink-3)]" />
        </span>
        <span className="ml-auto flex items-center gap-2.5">
          <span className="flex items-center gap-1.5 text-[0.7rem] font-medium text-[var(--ink-3)]">
            <span className="relative flex size-1.5">
              {!still && curPhase === 2 && !answered && (
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--fb)]/60" />
              )}
              <span
                className={cn(
                  "relative inline-flex size-1.5 rounded-full transition-colors duration-300",
                  curPhase === 2 && !answered ? "bg-[var(--fb)]" : "bg-[#13a05a]",
                )}
              />
            </span>
            {curPhase === 2 && !answered ? "Agent answering" : "Agent live"}
          </span>
          <span className="hidden rounded-md border border-[rgba(12,16,26,0.08)] px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.1em] text-[var(--ink-3)] sm:inline">
            Sample
          </span>
        </span>
      </div>

      {/* The counters */}
      <div className="grid grid-cols-2 gap-px border-b border-[var(--hairline)] bg-[var(--hairline)] md:grid-cols-4">
        <Figure label="New replies">
          <Roll value={counts.replies} />
        </Figure>
        <Figure label="Interested">
          <Roll value={counts.interested} />
        </Figure>
        <Figure label="Meetings booked">
          <Roll value={counts.booked} />
        </Figure>
        <Figure label="Suppressed">
          <Roll value={counts.suppressed} />
        </Figure>
      </div>

      <div className="grid md:grid-cols-[19rem_1fr]">
        {/* The rail: senders, then every reply, warm first */}
        <aside className="min-w-0 border-[var(--hairline)] bg-[color-mix(in_oklab,var(--tint)_55%,white)] p-3 md:border-r">
          <p className="px-1 pb-1.5 pt-0.5 text-[0.65rem] font-medium text-[var(--ink-3)]">Senders</p>
          <div className="flex flex-wrap gap-1 px-1">
            <span className="rounded-md bg-white px-2 py-0.5 text-[0.68rem] font-semibold text-[var(--fb-strong)] shadow-[inset_0_0_0_1px_rgba(22,111,229,0.18)]">
              All · {SENDERS.length}
            </span>
            {SENDERS.map((s) => (
              <span
                key={s}
                className="inline-flex items-center gap-1 rounded-md border border-[var(--hairline)] bg-white px-2 py-0.5 text-[0.68rem] font-medium text-[var(--ink-2)]"
              >
                <LinkedinMark className="size-2.5 text-[var(--fb)]" />
                {s}
              </span>
            ))}
          </div>

          <p className="mt-3 flex items-center justify-between px-1 pb-1.5 text-[0.65rem] font-medium text-[var(--ink-3)]">
            Replies
            <span className="inline-flex items-center gap-0.5">
              <ArrowUp className="size-2.5" strokeWidth={2.6} />
              Warm first
            </span>
          </p>
          <LayoutGroup id={group}>
            <ul className="relative h-[18.6rem] space-y-1 overflow-hidden">
              <AnimatePresence initial={false}>
                {rows.map(({ t, classifying }) => {
                  const on = t.id === current.id;
                  const out = t.label === "Not interested" && !classifying;
                  return (
                    <motion.li
                      key={t.id}
                      layout={!still}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: out ? 0.62 : 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.45, ease: EASE }}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg border px-2.5 py-2 transition-colors duration-300",
                        on
                          ? "border-[rgba(22,111,229,0.28)] bg-white shadow-[0_0_0_3px_rgba(22,111,229,0.06)]"
                          : "border-transparent bg-white/70",
                      )}
                    >
                      <Avatar t={t} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-[0.76rem] font-semibold text-foreground">
                            {t.name}
                          </span>
                          {classifying ? <ClassifyingChip /> : <LabelChip label={t.label} />}
                          <span className="ml-auto shrink-0 text-[0.62rem] tabular-nums text-[var(--ink-4)]">
                            {t.when}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-[0.68rem] text-[var(--ink-3)]">{t.reply}</p>
                      </div>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          </LayoutGroup>
        </aside>

        {/* The open thread */}
        <div className="relative hidden min-w-0 flex-col p-4 md:flex lg:p-5">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={current.id}
              initial={still ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="flex h-full flex-col"
            >
              <div className="flex items-center gap-3">
                <Avatar t={current} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.82rem] font-semibold text-foreground">{current.name}</p>
                  <p className="truncate text-[0.68rem] text-[var(--ink-3)]">{current.role}</p>
                </div>
                {curPhase === 0 ? <ClassifyingChip /> : <LabelChip label={current.label} />}
                <span className="hidden shrink-0 items-center gap-1 text-[0.65rem] text-[var(--ink-3)] lg:inline-flex">
                  via
                  <LinkedinMark className="size-3 text-[var(--fb)]" />
                  {current.via}
                </span>
              </div>

              <span className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-full border border-[var(--hairline)] bg-[#fbfcfe] px-2 py-0.5 text-[0.65rem] font-medium text-[var(--ink-3)]">
                <span className="size-1 rounded-full bg-[var(--fb)]" />
                {current.signal}
              </span>

              <div className="mt-3 flex flex-1 flex-col gap-2.5">
                {/* The agent's opener */}
                <div className="ml-auto max-w-[84%]">
                  <p className="mb-1 text-right text-[0.6rem] font-medium text-[var(--ink-4)]">Your agent</p>
                  <div className="rounded-[12px] rounded-br-[4px] bg-[#eef4fe] px-3 py-2 text-[0.72rem] leading-relaxed text-[var(--ink-2)]">
                    {current.opener}
                  </div>
                </div>
                {/* Their reply */}
                <div className="max-w-[78%]">
                  <p className="mb-1 text-[0.6rem] font-medium text-[var(--ink-4)]">{current.name.split(" ")[0]}</p>
                  <div className="rounded-[12px] rounded-bl-[4px] bg-[#f1f3f6] px-3 py-2 text-[0.72rem] leading-relaxed text-foreground">
                    {current.reply}
                  </div>
                </div>

                {/* The next move */}
                <div className="mt-auto flex min-h-[4.6rem] flex-col items-end justify-end gap-1.5">
                  {curPhase === 2 &&
                    (current.answer ? (
                      answered ? (
                        <motion.div
                          initial={still ? false : { opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.35, ease: EASE }}
                          className="flex max-w-[84%] flex-col items-end gap-1.5"
                        >
                          <div className="rounded-[12px] rounded-br-[4px] bg-[var(--fb)] px-3 py-2 text-[0.72rem] leading-relaxed text-white">
                            {current.answer}
                          </div>
                          <span className="flex items-center gap-1.5 text-[0.62rem] font-medium text-[var(--cyan-strong)]">
                            <Sparkles className="size-3" strokeWidth={2.4} />
                            Replied on autopilot · just now
                          </span>
                        </motion.div>
                      ) : (
                        <TypingDots />
                      )
                    ) : answered ? (
                      <motion.div
                        initial={still ? false : { opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35, ease: EASE }}
                        className="mr-auto flex items-center gap-1.5 rounded-lg border border-[rgba(192,54,90,0.22)] bg-[#fdeef1] px-2.5 py-1.5 text-[0.68rem] font-medium text-[#c0365a]"
                      >
                        <Ban className="size-3" strokeWidth={2.4} />
                        Added to suppression · never messaged again
                      </motion.div>
                    ) : null)}
                </div>
              </div>

              <div className="mt-3 flex items-center justify-end border-t border-[var(--hairline)] pt-2.5">
                <span className="inline-flex items-center gap-1 rounded-md border border-[rgba(12,16,26,0.1)] bg-white px-2 py-0.5 text-[0.65rem] font-medium text-[var(--ink-2)]">
                  <Hand className="size-3" strokeWidth={2.2} />
                  Take over
                </span>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* The suppression hand-off */}
      <div className="flex items-center justify-between gap-3 border-t border-[var(--hairline)] bg-[color-mix(in_oklab,var(--tint)_55%,white)] px-4 py-3">
        <span className="flex min-w-0 items-center gap-2 text-[0.75rem] font-medium text-foreground">
          <Ban className="size-3.5 shrink-0 text-[#c0365a]" strokeWidth={2.4} />
          <span className="truncate">
            {suppressedNow ? (
              <>
                {current.name} added to suppression
                <span className="text-[var(--ink-3)]"> · never messaged again</span>
              </>
            ) : (
              <>
                Not interested <span className="text-[var(--ink-3)]">→</span> added to suppression
              </>
            )}
          </span>
        </span>
        <span className="hidden shrink-0 items-center gap-1 text-[0.75rem] font-semibold text-[var(--fb-strong)] sm:flex">
          Suppression list <ArrowRight className="size-3.5" />
        </span>
      </div>
    </div>
  );
}
