"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import {
  BrainCircuit,
  Check,
  Gauge,
  Globe,
  Loader2,
  Lock,
  Radar,
  Send,
  ShieldCheck,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { VanteraLogo } from "@/components/landing/vantera-logo";
import { LinkedinMark } from "@/components/landing/brand-glyphs";
import { CEILING_FACT } from "@/components/landing/claims";
import type { OnboardingStep } from "@/lib/auth/onboarding-gate";

/**
 * The onboarding's right-hand panel, after rankbox.xyz's auth scene: the painted sky from
 * the landing's showcase, inset and rounded like a framed picture, with one white product
 * card floating on it that shows what the current step sets in motion.
 *
 *   1. Details   your site being read into a buyer profile, the ICP chips filling in.
 *   2. LinkedIn  the connection going live: hosted sign-in, then the safety limits.
 *   3. Plan      the agents lined up to start the moment the trial begins.
 *
 * Each card plays its sequence once when its step appears, then rests. The data is a
 * sample (the card says so) and the whole panel is decorative: aria-hidden, nothing
 * focusable. Reduced motion shows every card in its finished state.
 */

/* Expo-out: a quick move that spends most of its time settling. */
const SETTLE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const CAPTIONS: Record<OnboardingStep, string> = {
  1: "We read your site and build your buyer profile.",
  2: "Your LinkedIn connects in one secure step.",
  3: "Your agents start the moment you're in.",
};

/**
 * Counts up from 0 to `total`, one tick every `every` ms after `delay`. Starts at 0 on the
 * server and the first client render alike, so hydration matches; with reduced motion it
 * jumps straight to `total`.
 */
function useTicks(total: number, { delay = 550, every = 480 } = {}) {
  const [ticks, setTicks] = useState(0);
  useEffect(() => {
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timers = still
      ? [window.setTimeout(() => setTicks(total), 0)]
      : Array.from({ length: total }, (_, i) =>
          window.setTimeout(() => setTicks(i + 1), delay + i * every),
        );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [total, delay, every]);
  return ticks;
}

/* ---------- the card every step shares ---------- */

function SceneCard({
  icon,
  title,
  status,
  footer,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  status: React.ReactNode;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-[0_2px_6px_rgba(3,22,70,0.12),0_32px_64px_-28px_rgba(3,22,70,0.6)] ring-1 ring-black/5">
      <div className="flex items-center gap-3 border-b border-[var(--hairline)] px-5 py-3.5">
        {icon}
        <p className="min-w-0 truncate text-[0.9rem] font-semibold text-foreground">{title}</p>
        <span className="shrink-0 rounded-md border border-[rgba(12,16,26,0.08)] px-1.5 py-0.5 text-[0.6rem] font-medium uppercase tracking-[0.1em] text-[var(--ink-3)]">
          Sample
        </span>
        <span className="ml-auto shrink-0">{status}</span>
      </div>
      <div className="px-5 py-4">{children}</div>
      <div className="flex items-center justify-between gap-3 border-t border-[var(--hairline)] bg-[color-mix(in_oklab,var(--tint)_70%,white)] px-5 py-3 text-xs text-[var(--ink-3)]">
        {footer}
      </div>
    </div>
  );
}

/** The card's header status: a spinner while the step works, a green dot once it's done. */
function Status({ done, working, finished }: { done: boolean; working: string; finished: string }) {
  return (
    <span
      className={cn(
        "flex items-center gap-1.5 text-[0.72rem] font-medium",
        done ? "text-[#13824a]" : "text-[var(--fb-strong)]",
      )}
    >
      {done ? (
        <span className="size-1.5 rounded-full bg-[#13a05a]" />
      ) : (
        <Loader2 className="size-3 animate-spin motion-reduce:animate-none" />
      )}
      {done ? finished : working}
    </span>
  );
}

function IconTile({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", className)}>
      {children}
    </span>
  );
}

type RowState = "waiting" | "working" | "done";

/** One line of work in progress: rankbox's "Today's article" rows. */
function WorkRow({ label, value, state }: { label: string; value: string; state: RowState }) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border px-3 py-2.5 text-[0.8rem] transition-colors duration-300",
        state === "working"
          ? "border-[rgba(24,119,242,0.3)] bg-[color-mix(in_oklab,var(--cyan-tint)_55%,white)]"
          : "border-[var(--hairline)] bg-white",
      )}
    >
      <span className="grid size-4 shrink-0 place-items-center">
        {state === "done" ? (
          <Check className="size-3.5 text-[#13a05a]" strokeWidth={3} />
        ) : state === "working" ? (
          <Loader2 className="size-3.5 animate-spin text-[var(--fb)] motion-reduce:animate-none" />
        ) : (
          <span className="size-1.5 rounded-full bg-[rgba(12,16,26,0.18)]" />
        )}
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 truncate font-medium",
          state === "waiting" ? "text-[var(--ink-4)]" : "text-foreground",
        )}
      >
        {label}
      </span>
      <span className="shrink-0 tabular-nums text-[var(--ink-3)]">{state === "done" ? value : "—"}</span>
    </div>
  );
}

/* ---------- step 1: the buyer profile ---------- */

const READS = [
  { label: "Reading your site", value: "18 pages" },
  { label: "Finding what you sell", value: "3 offers" },
  { label: "Mapping who buys it", value: "4 roles" },
];
const ICP = ["VP Sales", "Head of Growth", "B2B SaaS", "11–200 employees", "US & Canada"];

function ProfileScene() {
  // Ticks 1–3 work through the reads (each one finishes as the next starts), 4 closes the
  // last, 5–9 fill the chips in, 10 marks the profile ready.
  const total = READS.length + 1 + ICP.length + 1;
  const t = useTicks(total);
  const rowState = (i: number): RowState => (t > i + 1 ? "done" : t === i + 1 ? "working" : "waiting");
  const chipsFrom = READS.length + 2;
  const ready = t >= total;

  return (
    <SceneCard
      icon={
        <IconTile className="bg-[var(--tint)] text-[var(--ink-3)]">
          <Globe className="size-4" />
        </IconTile>
      }
      title="yoursite.com"
      status={<Status done={ready} working="Reading" finished="Profile ready" />}
      footer={
        <>
          <span>Your agents start from this profile</span>
          <span className="font-medium text-foreground">Edit anytime</span>
        </>
      }
    >
      <div className="space-y-2">
        {READS.map((r, i) => (
          <WorkRow key={r.label} label={r.label} value={r.value} state={rowState(i)} />
        ))}
      </div>
      <p className="mb-2 mt-4 text-[0.72rem] font-medium text-[var(--ink-3)]">Your buyer profile</p>
      {/* Every chip is laid out from the start, so the card never jumps as they appear. */}
      <div className="flex flex-wrap gap-1.5">
        {ICP.map((chip, i) => {
          const shown = t >= chipsFrom + i;
          return (
            <motion.span
              key={chip}
              initial={false}
              animate={{ opacity: shown ? 1 : 0, y: shown ? 0 : 4, scale: shown ? 1 : 0.94 }}
              transition={{ duration: 0.35, ease: SETTLE }}
              className={cn(
                "rounded-md border px-2 py-1 text-[0.75rem] font-medium",
                i < 2
                  ? "border-[rgba(24,119,242,0.22)] bg-[var(--cyan-tint)] text-[var(--fb-strong)]"
                  : "border-[rgba(12,16,26,0.08)] bg-white text-foreground",
              )}
            >
              {chip}
            </motion.span>
          );
        })}
      </div>
    </SceneCard>
  );
}

/* ---------- step 2: the LinkedIn connection ---------- */

const SAFEGUARDS: { icon: LucideIcon; label: string; value: string }[] = [
  { icon: Lock, label: "Signed in on LinkedIn itself", value: "Hosted" },
  { icon: ShieldCheck, label: "Your password", value: "Never stored" },
  { icon: Gauge, label: "Weekly ceiling", value: CEILING_FACT },
  { icon: TrendingUp, label: "New accounts", value: "Gradual ramp" },
];

function ConnectScene() {
  // Tick 1 starts the handshake, 2 lands it, 3–6 confirm the safeguards one by one.
  const total = 2 + SAFEGUARDS.length;
  const t = useTicks(total, { delay: 650, every: 560 });
  const connected = t >= 2;

  return (
    <SceneCard
      icon={
        <IconTile className="bg-[var(--cyan-tint)] text-[#0a66c2]">
          <LinkedinMark className="size-4" />
        </IconTile>
      }
      title="LinkedIn connection"
      status={<Status done={connected} working="Connecting" finished="Connected" />}
      footer={
        <>
          <span>Your agents send from this account</span>
          <span className="font-medium text-foreground">Auto-pause on checks</span>
        </>
      }
    >
      {/* The handshake: Vantera and LinkedIn, a signal crossing the line between them. */}
      <div className="flex items-center justify-center gap-3 rounded-xl border border-[var(--hairline)] bg-[color-mix(in_oklab,var(--tint)_60%,white)] py-5">
        <IconTile className="size-10 rounded-xl bg-[var(--fb)] text-white shadow-[0_6px_16px_-8px_rgba(24,119,242,0.8)]">
          <VanteraLogo className="size-5" />
        </IconTile>
        <span className="relative h-px w-24 overflow-visible">
          <span
            className={cn(
              "absolute inset-0 transition-colors duration-500",
              connected
                ? "bg-[var(--fb)]"
                : "bg-[repeating-linear-gradient(90deg,rgba(12,16,26,0.22)_0_4px,transparent_4px_8px)]",
            )}
          />
          {!connected && t >= 1 && (
            <motion.span
              className="absolute -top-[3px] size-[7px] rounded-full bg-[var(--fb)] shadow-[0_0_0_3px_rgba(24,119,242,0.18)]"
              initial={{ left: "0%" }}
              animate={{ left: ["0%", "92%"] }}
              transition={{ duration: 0.55, ease: "easeInOut", repeat: Infinity, repeatType: "loop" }}
            />
          )}
          <span
            className={cn(
              "absolute left-1/2 top-1/2 grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border bg-white transition-colors duration-500",
              connected
                ? "border-[rgba(19,160,90,0.35)] text-[#13a05a]"
                : "border-[rgba(12,16,26,0.1)] text-[var(--ink-3)]",
            )}
          >
            {connected ? <Check className="size-3.5" strokeWidth={3} /> : <Lock className="size-3" />}
          </span>
        </span>
        <IconTile className="size-10 rounded-xl border border-[rgba(12,16,26,0.08)] bg-white text-[#0a66c2]">
          <LinkedinMark className="size-5" />
        </IconTile>
      </div>

      <div className="mt-3 space-y-2">
        {SAFEGUARDS.map((s, i) => {
          const shown = t >= 3 + i;
          return (
            <div
              key={s.label}
              className={cn(
                "flex items-center gap-3 rounded-lg border px-3 py-2.5 text-[0.8rem] transition-[opacity,border-color] duration-300",
                shown ? "border-[var(--hairline)] opacity-100" : "border-transparent opacity-40",
              )}
            >
              <s.icon className="size-3.5 shrink-0 text-[var(--fb)]" />
              <span className="min-w-0 flex-1 truncate font-medium text-foreground">{s.label}</span>
              <span className="shrink-0 text-[var(--ink-3)]">{s.value}</span>
              <span className="grid size-4 shrink-0 place-items-center">
                {shown && <Check className="size-3.5 text-[#13a05a]" strokeWidth={3} />}
              </span>
            </div>
          );
        })}
      </div>
    </SceneCard>
  );
}

/* ---------- step 3: the agents, lined up ---------- */

const AGENTS: { icon: LucideIcon; name: string; what: string; live: string; learning?: boolean }[] = [
  { icon: Radar, name: "Prospect agent", what: "Finds in-market buyers every day", live: "Ready" },
  { icon: Send, name: "Outreach agent", what: "Writes and sends each opener on autopilot", live: "Ready" },
  {
    icon: BrainCircuit,
    name: "Targeting model",
    what: "Learns who replies and who books",
    live: "Learning",
    learning: true,
  },
];

function LaunchScene({ trialDays }: { trialDays: number }) {
  const t = useTicks(AGENTS.length, { delay: 700, every: 650 });
  const ready = t >= AGENTS.length;

  return (
    <SceneCard
      icon={
        <IconTile className="bg-[var(--fb)] text-white">
          <VanteraLogo className="size-4" />
        </IconTile>
      }
      title="Your agents"
      status={<Status done={ready} working="Setting up" finished="Ready to launch" />}
      footer={
        <>
          <span>{trialDays} days free</span>
          <span className="font-medium text-foreground">Cancel anytime</span>
        </>
      }
    >
      <div className="space-y-2">
        {AGENTS.map((a, i) => {
          const live = t >= i + 1;
          return (
            <div
              key={a.name}
              className="flex items-center gap-3 rounded-lg border border-[var(--hairline)] bg-white px-3 py-2.5"
            >
              <IconTile className="bg-[var(--cyan-tint)] text-[var(--fb-strong)]">
                <a.icon className="size-4" />
              </IconTile>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.82rem] font-semibold text-foreground">{a.name}</p>
                <p className="truncate text-[0.72rem] text-[var(--ink-3)]">{a.what}</p>
              </div>
              <span
                className={cn(
                  "flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.68rem] font-semibold transition-colors duration-300",
                  !live
                    ? "bg-[rgba(12,16,26,0.05)] text-[var(--ink-3)]"
                    : a.learning
                      ? "bg-[var(--cyan-tint)] text-[var(--fb-strong)]"
                      : "bg-[#e3f5ea] text-[#13824a]",
                )}
              >
                {live && a.learning ? (
                  <span className="size-1.5 animate-pulse rounded-full bg-[var(--fb)] motion-reduce:animate-none" />
                ) : live ? (
                  <Check className="size-3" strokeWidth={3} />
                ) : null}
                {live ? a.live : "Queued"}
              </span>
            </div>
          );
        })}
      </div>
    </SceneCard>
  );
}

/* ---------- the panel ---------- */

export function OnboardingScene({
  step,
  trialDays,
  className,
}: {
  step: OnboardingStep;
  trialDays: number;
  className?: string;
}) {
  return (
    <MotionConfig reducedMotion="user">
      <div aria-hidden className={cn("relative isolate overflow-hidden bg-[#1563d6]", className)}>
        {/* The landing showcase's painted sky, so setup continues the picture the
            visitor scrolled past on the way in. */}
        <Image
          src="/landing/painting.webp"
          alt=""
          fill
          sizes="(min-width: 1024px) 50vw, 1px"
          draggable={false}
          className="select-none object-cover"
        />
        <div className="absolute inset-0 grid place-items-center p-8">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              className="w-[min(88%,28rem)]"
              initial={{ opacity: 0, y: 18, scale: 0.98, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -12, filter: "blur(4px)" }}
              transition={{ duration: 0.6, ease: SETTLE }}
            >
              {step === 1 ? <ProfileScene /> : step === 2 ? <ConnectScene /> : <LaunchScene trialDays={trialDays} />}
            </motion.div>
          </AnimatePresence>
        </div>
        <p className="absolute inset-x-6 bottom-6 text-center text-[0.8rem] font-medium text-white/90 [text-shadow:0_1px_8px_rgba(3,22,70,0.45)]">
          {CAPTIONS[step]}
        </p>
      </div>
    </MotionConfig>
  );
}
