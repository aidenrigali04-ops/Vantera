"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { Check, ChevronDown, CirclePause, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { VanteraLogo } from "@/components/landing/vantera-logo";
import {
  CEILING,
  CHECKS,
  CeilingBar,
  CheckRow,
  DAYS,
  SENDERS,
  StateChip,
  TICKS,
  TODAY,
  type Sender,
  type State,
} from "./account-safety.parts";

const EASE = [0.16, 1, 0.3, 1] as const;

/* The window's story: everything clear → a security check pauses one sender → cleared. */
const STORY = [3600, 3800, 2400] as const;

function Avatar({ s, size = "md" }: { s: Pick<Sender, "initials" | "tint">; size?: "sm" | "md" }) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-semibold text-white",
        size === "md" ? "size-8 text-[0.68rem]" : "size-6 text-[0.58rem]",
      )}
      style={{ backgroundColor: s.tint }}
    >
      {s.initials}
    </span>
  );
}

function Figure({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="bg-white px-4 py-3.5 lg:px-5">
      <p className="text-[0.7rem] font-medium text-[var(--ink-3)]">{label}</p>
      <div className="mt-1.5 flex h-7 items-center gap-1.5 text-[1.4rem] font-semibold leading-none tracking-tight text-foreground tabular-nums">
        {children}
      </div>
    </div>
  );
}

/**
 * The safety console, running. While about half of it is on screen the week's sends
 * appear across the days at uneven times, then LinkedIn asks one sender for a security
 * check and that account pauses on its own, until the check is cleared. Off screen it
 * goes back to the start; with reduced motion it shows the clear, finished week.
 */
export function SafetyWindow() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.45 });
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState(0);
  const [cycle, setCycle] = useState(0);

  // Off screen: back to the start of the story (adjusted while rendering, not in an effect).
  const [wasInView, setWasInView] = useState(inView);
  if (wasInView !== inView) {
    setWasInView(inView);
    if (!inView) setPhase(0);
  }

  useEffect(() => {
    if (reduce || !inView) return;
    const id = window.setTimeout(() => {
      if (phase < STORY.length - 1) setPhase(phase + 1);
      else {
        setPhase(0);
        setCycle((c) => c + 1);
      }
    }, STORY[phase]);
    return () => window.clearTimeout(id);
  }, [inView, reduce, phase]);

  const paused = !reduce && phase === 1;
  const senders = SENDERS.map((s) =>
    s.name === "Alex Morgan" && paused ? { ...s, state: "Auto-paused" as State } : s,
  );
  const focus = SENDERS[0];
  // Draw the sends on the first pass only; later passes keep the finished week.
  const drawn = reduce || inView || cycle > 0;

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
        <span className="text-[0.82rem] font-semibold text-foreground">Account safety</span>
        <span className="hidden items-center gap-1 rounded-md border border-[rgba(12,16,26,0.08)] bg-white px-2 py-0.5 text-[0.7rem] font-medium text-foreground sm:flex">
          {focus.name}
          <ChevronDown className="size-3 text-[var(--ink-3)]" />
        </span>
        <span className="ml-auto flex items-center gap-2.5">
          <span className="flex items-center gap-1.5 text-[0.7rem] font-medium text-[var(--ink-3)]">
            <span className="relative flex size-1.5">
              {paused && (
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#f59e0b]/60" />
              )}
              <span
                className={cn(
                  "relative inline-flex size-1.5 rounded-full transition-colors duration-300",
                  paused ? "bg-[#f59e0b]" : "bg-[#13a05a]",
                )}
              />
            </span>
            {paused ? "1 sender paused" : "All clear"}
          </span>
          <span className="hidden rounded-md border border-[rgba(12,16,26,0.08)] px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.1em] text-[var(--ink-3)] sm:inline">
            Sample
          </span>
        </span>
      </div>

      {/* The figures */}
      <div className="grid grid-cols-2 gap-px border-b border-[var(--hairline)] bg-[var(--hairline)] md:grid-cols-4">
        <Figure label="Invites this week">
          {focus.used}
          <span className="text-[0.82rem] font-medium tracking-normal text-[var(--ink-3)]">of {CEILING}</span>
          <Lock className="size-3 text-[var(--ink-4)]" strokeWidth={2.4} />
        </Figure>
        <Figure label="Newest account">
          Week 2
          <span className="text-[0.82rem] font-medium tracking-normal text-[var(--ink-3)]">of ramp</span>
        </Figure>
        <Figure label="Senders connected">{SENDERS.length}</Figure>
        <Figure label="Status">
          <span
            className={cn(
              "text-[1.15rem] transition-colors duration-300",
              paused ? "text-[#9a6a00]" : "text-[#13824a]",
            )}
          >
            {paused ? "1 paused" : "All clear"}
          </span>
        </Figure>
      </div>

      <div className="grid md:grid-cols-[15rem_1fr]">
        {/* The senders */}
        <aside className="hidden border-r border-[var(--hairline)] bg-[color-mix(in_oklab,var(--tint)_55%,white)] p-3 md:block">
          <p className="px-1 pb-1.5 pt-0.5 text-[0.65rem] font-medium text-[var(--ink-3)]">Connected senders</p>
          <ul className="space-y-1">
            {senders.map((s) => {
              const on = s.name === focus.name;
              return (
                <li
                  key={s.name}
                  className={cn(
                    "rounded-lg border px-2.5 py-2 transition-colors duration-300",
                    on
                      ? "border-[rgba(22,111,229,0.28)] bg-white shadow-[0_0_0_3px_rgba(22,111,229,0.06)]"
                      : s.state === "Auto-paused"
                        ? "border-[rgba(245,158,11,0.35)] bg-[#fffbf2]"
                        : "border-transparent bg-white/70",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Avatar s={s} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-[0.74rem] font-semibold text-foreground">
                      {s.name}
                    </span>
                    <StateChip state={s.state} />
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <CeilingBar used={s.used} className={s.state === "Auto-paused" ? "opacity-50" : ""} />
                    <span className="shrink-0 text-[0.6rem] tabular-nums text-[var(--ink-3)]">
                      {s.used} / {CEILING}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-2.5 px-1 text-[0.62rem] leading-snug text-[var(--ink-3)]">
            Volume is spread across senders, so no account carries it alone.
          </p>
        </aside>

        {/* The week, and the checks */}
        <div className="grid min-w-0 gap-4 p-4 lg:grid-cols-[1fr_14.5rem] lg:p-5">
          <div className="min-w-0">
            {/* On phones the rail becomes one line */}
            <div className="mb-3 flex flex-wrap gap-1 md:hidden">
              {senders.map((s) => (
                <span
                  key={s.name}
                  className="inline-flex items-center gap-1 rounded-md border border-[var(--hairline)] bg-white px-1.5 py-0.5 text-[0.62rem] font-medium text-[var(--ink-2)]"
                >
                  {s.name.split(" ")[0]}
                  <StateChip state={s.state} />
                </span>
              ))}
            </div>

            <div className="flex items-center justify-between gap-3">
              <p className="text-[0.82rem] font-semibold text-foreground">This week&rsquo;s sends</p>
              <span className="rounded-md bg-[var(--cyan-tint)] px-1.5 py-0.5 text-[0.65rem] font-semibold text-[var(--cyan-strong)]">
                Randomized
              </span>
            </div>

            <div className="mt-3 grid grid-cols-7 gap-1.5">
              {DAYS.map((d, day) => {
                const future = day > TODAY;
                return (
                  <div key={d} className="flex flex-col items-center gap-1.5">
                    <div
                      className={cn(
                        "relative h-[8.5rem] w-full overflow-hidden rounded-md border",
                        day === TODAY
                          ? "border-[rgba(22,111,229,0.25)] bg-[#f7faff]"
                          : future
                            ? "border-dashed border-[rgba(12,16,26,0.1)] bg-white"
                            : "border-[var(--hairline)] bg-[color-mix(in_oklab,var(--tint)_45%,white)]",
                      )}
                    >
                      {TICKS.filter((t) => t.day === day).map((t) => (
                        <motion.span
                          key={t.i}
                          className="absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--fb)]"
                          style={{ left: `${t.x * 100}%`, top: `${t.y * 100}%` }}
                          initial={reduce ? false : { opacity: 0, scale: 0 }}
                          animate={drawn ? { opacity: 0.85, scale: 1 } : { opacity: 0, scale: 0 }}
                          transition={{ duration: 0.3, ease: EASE, delay: reduce ? 0 : t.i * 0.022 }}
                        />
                      ))}
                      {day === TODAY && (
                        <span className="absolute inset-x-1 top-[64%] border-t border-dashed border-[rgba(22,111,229,0.45)]" />
                      )}
                    </div>
                    <span
                      className={cn(
                        "text-[0.6rem] font-medium",
                        day === TODAY ? "text-[var(--fb-strong)]" : "text-[var(--ink-4)]",
                      )}
                    >
                      {day === TODAY ? "Today" : d}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-[0.65rem] text-[var(--ink-3)]">
              Human-like gaps between every action, never fired on the second.
            </p>
          </div>

          <div className="min-w-0">
            <p className="text-[0.82rem] font-semibold text-foreground">Checks</p>
            <div className="mt-3 space-y-1.5">
              {CHECKS.map((c) => (
                <CheckRow key={c.label} {...c} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* The rule */}
      <div className="flex items-center justify-between gap-3 border-t border-[var(--hairline)] bg-[color-mix(in_oklab,var(--tint)_55%,white)] px-4 py-3">
        <span className="flex min-w-0 items-center gap-2 text-[0.75rem] font-medium text-foreground">
          <Lock className="size-3.5 shrink-0 text-[var(--ink-3)]" strokeWidth={2.4} />
          <span className="truncate">Ceilings can&rsquo;t be raised — not by you, not by us.</span>
        </span>
        <motion.span
          key={paused ? "paused" : "clear"}
          initial={reduce ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: EASE }}
          className={cn(
            "hidden shrink-0 items-center gap-1 text-[0.75rem] font-semibold sm:flex",
            paused ? "text-[#9a6a00]" : "text-[#13824a]",
          )}
        >
          {paused ? (
            <>
              <CirclePause className="size-3.5" strokeWidth={2.4} />
              Alex Morgan paused · security check
            </>
          ) : (
            <>
              <Check className="size-3.5" strokeWidth={2.8} />
              Every sender inside its ceiling
            </>
          )}
        </motion.span>
      </div>
    </div>
  );
}
