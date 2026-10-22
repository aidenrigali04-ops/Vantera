"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { ArrowRight, ChevronDown, Sparkles, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { VanteraLogo } from "@/components/landing/vantera-logo";
import { LinkedinMark } from "@/components/landing/brand-glyphs";
import {
  Avatar,
  CRM,
  CRMS,
  DESTS,
  DestTile,
  DoneChip,
  EASE,
  ROW,
  RecordRow,
  SyncedMeta,
  WINS,
  WonChip,
  dealMessage,
  recordsFor,
  type DestId,
  type Win,
} from "./crm-sync.parts";

/** One closed win, in five beats: the deal closes, it crosses to the CRM on its own, the
    contact and the deal are written, Slack hears about it, and all is in sync. */
const STAGES = ["won", "sync", "record", "alert", "done"] as const;
type Stage = (typeof STAGES)[number];
const MS: Record<Stage, number> = { won: 1500, sync: 1100, record: 1400, alert: 1100, done: 2200 };

/** Where the counts stand before the sample starts; each finished win adds to them. */
const BASE = { wins: 22, records: 44, alerts: 22 };

interface Frame {
  n: number;
  step: number;
  /** Wins finished since the sample started. */
  done: number;
}

const START: Frame = { n: 0, step: 0, done: 0 };
/* Reduced motion: the first win, landed. */
const STILL: Frame = { n: 0, step: STAGES.length - 1, done: 1 };

function advance(f: Frame): Frame {
  if (f.step === STAGES.length - 1) return { ...f, n: (f.n + 1) % WINS.length, step: 0 };
  const step = f.step + 1;
  return { ...f, step, done: STAGES[step] === "done" ? f.done + 1 : f.done };
}

const at = (stage: Stage, from: Stage) => STAGES.indexOf(stage) >= STAGES.indexOf(from);

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

/** A count that rolls up to its next value. */
function Rolling({ value }: { value: number }) {
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

function Skeleton({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "block h-2 rounded-full bg-[rgba(12,16,26,0.06)] motion-safe:animate-pulse",
        className,
      )}
    />
  );
}

/** The won conversation, as the inbox shows it once the deal is closed. */
function ConversationCard({ win, lit }: { win: Win; lit: boolean }) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-xl border bg-white p-3.5 transition-[border-color,box-shadow] duration-500",
        lit
          ? "border-[rgba(22,111,229,0.3)] shadow-[0_0_0_4px_rgba(22,111,229,0.07)]"
          : "border-[var(--hairline)]",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-[0.66rem] font-medium text-[var(--ink-3)]">
          <LinkedinMark className="size-3.5 shrink-0 text-[#0a66c2]" />
          <span className="truncate">LinkedIn conversation</span>
        </span>
        <span className="shrink-0 text-[0.62rem] tabular-nums text-[var(--ink-4)]">Just now</span>
      </div>
      <div className="mt-3 flex items-center gap-2.5">
        <Avatar initials={win.initials} tint={win.tint} />
        <div className="min-w-0">
          <p className="truncate text-[0.8rem] font-semibold text-foreground">{win.name}</p>
          <p className="truncate text-[0.68rem] text-[var(--ink-3)]">
            {win.role} · {win.company}
          </p>
        </div>
      </div>
      <p className="mt-2.5 rounded-[10px] rounded-bl-[4px] bg-[#f1f3f6] px-2.5 py-1.5 text-[0.74rem] leading-snug text-foreground">
        {win.last}
      </p>
      <div className="mt-2.5">
        <WonChip value={win.value} />
      </div>
    </div>
  );
}

/** The wire from the conversation to the CRM: dashed at rest, drawn solid while the win
    crosses on its own, with the win travelling along it. */
function Track({ axis, moving, run }: { axis: "x" | "y"; moving: boolean; run: boolean }) {
  const prop = axis === "x" ? "left" : "top";
  return (
    <div
      aria-hidden
      className={cn("relative", axis === "x" ? "h-8 w-full" : "mx-auto h-9 w-8")}
    >
      <span
        className={cn(
          "absolute border-dashed border-[rgba(22,111,229,0.3)]",
          axis === "x"
            ? "inset-x-0 top-1/2 h-0 -translate-y-1/2 border-t-[1.5px]"
            : "inset-y-0 left-1/2 w-0 -translate-x-1/2 border-l-[1.5px]",
        )}
      />
      <motion.span
        className={cn(
          "absolute bg-[var(--fb-strong)]/70",
          axis === "x"
            ? "inset-x-0 top-1/2 h-[1.5px] -translate-y-1/2"
            : "inset-y-0 left-1/2 w-[1.5px] -translate-x-1/2",
        )}
        animate={{ opacity: moving ? 1 : 0 }}
        transition={{ duration: 0.3 }}
      />
      {(["start", "end"] as const).map((end) => (
        <span
          key={end}
          className={cn(
            "absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[var(--fb-strong)] shadow-[0_0_0_1px_rgba(22,111,229,0.3)]",
            axis === "x"
              ? cn("top-1/2", end === "start" ? "left-0" : "left-full")
              : cn("left-1/2", end === "start" ? "top-0" : "top-full"),
          )}
        />
      ))}
      <AnimatePresence>
        {moving && (
          <motion.span
            key="win"
            className={cn(
              "absolute z-10 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 whitespace-nowrap rounded-md bg-[var(--fb-strong)] px-1.5 py-1 text-[0.6rem] font-semibold text-white shadow-[0_0_0_4px_rgba(22,111,229,0.1),0_6px_14px_-6px_rgba(4,24,72,0.4)]",
              axis === "x" ? "top-1/2" : "left-1/2",
            )}
            initial={{ [prop]: "0%", opacity: 0 }}
            animate={{ [prop]: run ? "100%" : "0%", opacity: [0, 1, 1, 0] }}
            exit={{ opacity: 0 }}
            transition={{
              duration: (MS.sync - 150) / 1000,
              ease: [0.45, 0, 0.2, 1],
              opacity: { duration: (MS.sync - 150) / 1000, times: [0, 0.12, 0.84, 1] },
            }}
          >
            <Zap className="size-2.5" strokeWidth={3} />
            Win
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

/** What the win becomes: the contact and the deal appear one by one in the CRM, then
    Slack's "deal closed" message, in the words the integration posts. */
function Destination({ win, stage, reduce }: { win: Win; stage: Stage; reduce: boolean }) {
  const writing = stage === "record";
  const written = at(stage, "record");
  const alerted = at(stage, "alert");
  return (
    <div className="min-w-0 space-y-2">
      <div
        className={cn(
          "rounded-xl border bg-white p-3.5 transition-[border-color,box-shadow] duration-500",
          stage === "done"
            ? "border-[rgba(19,130,74,0.28)] shadow-[0_0_0_4px_rgba(19,130,74,0.06)]"
            : "border-[var(--hairline)]",
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2 text-[0.78rem] font-semibold text-foreground">
            <DestTile id={CRM} />
            <span className="truncate">{DESTS[CRM].name}</span>
          </span>
          {alerted ? (
            <SyncedMeta />
          ) : writing ? (
            <span className="flex items-center gap-1.5 text-[0.68rem] font-medium text-[var(--fb)]">
              <span className="size-1.5 animate-pulse rounded-full bg-[var(--fb)] motion-reduce:animate-none" />
              Writing
            </span>
          ) : (
            <span className="text-[0.68rem] text-[var(--ink-4)]">Waiting</span>
          )}
        </div>
        <div className="mt-3 space-y-2">
          {recordsFor(win).map((r, i) =>
            written ? (
              <motion.div
                key={r.kind}
                initial={reduce ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: EASE, delay: reduce ? 0 : i * 0.45 }}
              >
                <RecordRow record={r} />
              </motion.div>
            ) : (
              <div key={r.kind} className={cn(ROW, "border-dashed")}>
                <span className="flex flex-1 items-center gap-2">
                  <span className="min-w-[3.25rem] text-[0.66rem] text-[var(--ink-4)]">{r.kind}</span>
                  <Skeleton className="w-20" />
                </span>
                <Skeleton className="w-12" />
              </div>
            ),
          )}
        </div>
      </div>

      {/* Slack hears about it. */}
      {alerted ? (
        <motion.div
          key="alert"
          className="rounded-lg border border-[var(--hairline)] bg-white px-3 py-2"
          initial={reduce ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE }}
        >
          <span className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-[0.72rem] font-semibold text-foreground">
              <DestTile id="slack" className="size-5" />
              #wins
            </span>
            <DoneChip>Posted</DoneChip>
          </span>
          <p className="mt-1 pl-7 text-[0.7rem] leading-snug text-[var(--ink-2)]">{dealMessage(win)}</p>
        </motion.div>
      ) : (
        <div className="rounded-lg border border-dashed border-[var(--hairline)] bg-white px-3 py-2">
          <span className="flex items-center gap-2">
            <DestTile id="slack" className="size-5 opacity-40" />
            <Skeleton className="w-14" />
          </span>
          <span className="mt-2 block pl-7">
            <Skeleton className="w-40 max-w-full" />
          </span>
        </div>
      )}
    </div>
  );
}

/** A rail row: a destination, its detail, and whether it's connected. */
function RailRow({
  id,
  detail,
  connected = true,
  on,
  layoutId,
}: {
  id: DestId;
  detail?: string;
  connected?: boolean;
  on: boolean;
  layoutId: string;
}) {
  return (
    <li className="relative flex items-center gap-2.5 rounded-lg px-2 py-1.5">
      {on && (
        <motion.span
          layoutId={layoutId}
          transition={{ type: "spring", stiffness: 380, damping: 34 }}
          className="absolute inset-0 rounded-lg bg-[var(--cyan-tint)] shadow-[inset_0_0_0_1px_rgba(22,111,229,0.16)]"
        />
      )}
      <DestTile id={id} className="relative" />
      <span className="relative min-w-0 flex-1">
        <span className="block truncate text-[0.76rem] font-medium text-foreground">{DESTS[id].name}</span>
        {detail && <span className="block truncate text-[0.62rem] text-[var(--ink-3)]">{detail}</span>}
      </span>
      {connected ? (
        <span className="relative size-1.5 shrink-0 rounded-full bg-[#13a05a]" />
      ) : (
        <span className="relative shrink-0 text-[0.62rem] font-medium text-[var(--fb-strong)]">Connect</span>
      )}
    </li>
  );
}

function RailGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <p className="px-2 pb-1 pt-3 text-[0.65rem] font-medium text-[var(--ink-3)] first:pt-1">{label}</p>
      <ul className="space-y-0.5">{children}</ul>
    </>
  );
}

/**
 * CRM sync, running: a LinkedIn conversation closes, the win crosses on its own, and it
 * lands in HubSpot as a contact and a won deal, with a "deal closed" message in Slack;
 * the counts tick up each time and the rail lights each destination as the win reaches
 * it. Runs only while about half of it is on screen; with reduced motion it shows the
 * first win, landed.
 */
export function CrmSyncWindow() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.45 });
  const reduce = useReducedMotion() ?? false;
  const railId = useId();
  const [frame, setFrame] = useState<Frame>(START);
  const run = inView && !reduce;

  useEffect(() => {
    if (!run) return;
    const id = window.setTimeout(() => setFrame(advance), MS[STAGES[frame.step]]);
    return () => window.clearTimeout(id);
  }, [run, frame]);

  const f = reduce ? STILL : frame;
  const win = WINS[f.n];
  const stage = STAGES[f.step];
  const busy = stage !== "won" && stage !== "done";
  const lit: DestId = at(stage, "alert") ? "slack" : CRM;
  /* The two wins before this one, newest first. */
  const recent = [1, 2].map((k) => WINS[(f.n - k + WINS.length) % WINS.length]);
  const others = CRMS.filter((id) => id !== CRM);

  return (
    <div
      ref={ref}
      className="overflow-hidden rounded-[14px] border border-white/70 bg-white text-left shadow-[0_2px_6px_rgba(3,22,58,0.16),0_40px_80px_-32px_rgba(3,22,58,0.55)]"
    >
      {/* Title bar */}
      <div className="flex h-12 items-center gap-3 border-b border-[var(--hairline)] px-4">
        <span className="grid size-7 shrink-0 place-items-center rounded-[8px] bg-[var(--fb)]">
          <VanteraLogo className="size-4 text-white" />
        </span>
        <span className="text-[0.82rem] font-semibold text-foreground">CRM sync</span>
        <span className="hidden items-center gap-1 rounded-md border border-[rgba(12,16,26,0.08)] bg-white px-2 py-0.5 text-[0.7rem] font-medium text-foreground sm:flex">
          Your workspace
          <ChevronDown className="size-3 text-[var(--ink-3)]" />
        </span>
        <span className="ml-auto flex items-center gap-2.5">
          <span className="flex items-center gap-1.5 text-[0.7rem] font-medium text-[var(--ink-3)]">
            <span className="relative flex size-1.5">
              {busy && (
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--fb-strong)]/60 motion-reduce:animate-none" />
              )}
              <span
                className={cn(
                  "relative inline-flex size-1.5 rounded-full transition-colors duration-300",
                  busy ? "bg-[var(--fb-strong)]" : "bg-[#13a05a]",
                )}
              />
            </span>
            {busy ? "Syncing a win" : "In sync"}
          </span>
          <span className="hidden rounded-md border border-[rgba(12,16,26,0.08)] px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.1em] text-[var(--ink-3)] sm:inline">
            Sample
          </span>
        </span>
      </div>

      {/* The figures */}
      <div className="grid grid-cols-2 gap-px border-b border-[var(--hairline)] bg-[var(--hairline)] md:grid-cols-4">
        <Figure label="Closed wins">
          <Rolling value={BASE.wins + f.done} />
        </Figure>
        <Figure label="CRM records written">
          <Rolling value={BASE.records + f.done * 2} />
        </Figure>
        <Figure label="Slack alerts">
          <Rolling value={BASE.alerts + f.done} />
        </Figure>
        <Figure label="Copied by hand">0</Figure>
      </div>

      <div className="grid md:grid-cols-[13rem_minmax(0,1fr)]">
        {/* Destinations rail */}
        <aside className="hidden border-r border-[var(--hairline)] bg-[color-mix(in_oklab,var(--tint)_70%,white)] p-3 md:block">
          <RailGroup label="CRM">
            <RailRow id={CRM} detail="Sales pipeline" on={lit === CRM} layoutId={railId} />
            {others.map((id) => (
              <RailRow key={id} id={id} connected={false} on={false} layoutId={railId} />
            ))}
          </RailGroup>
          <RailGroup label="Win alerts">
            <RailRow id="slack" detail="#wins" on={lit === "slack"} layoutId={railId} />
            <RailRow id="monday" connected={false} on={false} layoutId={railId} />
          </RailGroup>
          <RailGroup label="Assistant">
            <RailRow id="claude" detail="via MCP" on={false} layoutId={railId} />
          </RailGroup>
        </aside>

        {/* The win, landing */}
        <div className="min-w-0 p-4 lg:p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[0.82rem] font-semibold text-foreground">Latest closed win</p>
            <span className="flex items-center gap-1 rounded-md bg-[var(--cyan-tint)] px-1.5 py-0.5 text-[0.65rem] font-semibold text-[var(--cyan-strong)]">
              <Zap className="size-3" strokeWidth={2.4} />
              Lands automatically
            </span>
          </div>

          <AnimatePresence initial={false} mode="popLayout">
            <motion.div
              key={f.n}
              className="mt-3 grid items-start md:grid-cols-[minmax(0,1fr)_3rem_minmax(0,1.1fr)]"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.2 } }}
              transition={{ duration: 0.45, ease: EASE }}
            >
              <ConversationCard win={win} lit={stage === "won" || stage === "sync"} />
              {/* Level with the middle of both cards. */}
              <div className="hidden pt-16 md:block">
                <Track axis="x" moving={stage === "sync"} run={run} />
              </div>
              <div className="md:hidden">
                <Track axis="y" moving={stage === "sync"} run={run} />
              </div>
              <Destination win={win} stage={stage} reduce={reduce} />
            </motion.div>
          </AnimatePresence>

          {/* What landed before */}
          <p className="mt-4 text-[0.65rem] font-medium text-[var(--ink-3)]">Recent wins</p>
          <ul className="mt-1.5 space-y-1.5">
            {recent.map((w, i) => (
              <li key={w.name} className={cn(ROW, "py-1.5")}>
                <span className="flex min-w-0 items-center gap-2">
                  <Avatar initials={w.initials} tint={w.tint} className="size-6 text-[9px]" />
                  <span className="truncate text-[0.74rem] font-medium text-foreground">
                    {w.name}
                    <span className="font-normal text-[var(--ink-3)]"> · {w.company}</span>
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="hidden text-[0.68rem] tabular-nums text-[var(--ink-3)] sm:inline">
                    {w.value}
                  </span>
                  <DestTile id={CRM} className="size-5" />
                  <DestTile id="slack" className="size-5" />
                  <span className="w-14 whitespace-nowrap text-right text-[0.62rem] tabular-nums text-[var(--ink-4)]">
                    {i === 0 ? "2h ago" : "Yesterday"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* The hand-off, with nothing to click */}
      <div className="flex items-center justify-between gap-3 border-t border-[var(--hairline)] bg-[color-mix(in_oklab,var(--tint)_70%,white)] px-4 py-3">
        <span className="flex min-w-0 items-center gap-2 text-[0.75rem] font-medium text-foreground">
          <Sparkles className="size-3.5 shrink-0 text-[var(--fb-strong)]" />
          <span className="truncate">Existing contacts are matched by email</span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-[0.75rem] font-semibold text-[var(--fb-strong)]">
          7 fields mapped <ArrowRight className="size-3.5" />
        </span>
      </div>
    </div>
  );
}
