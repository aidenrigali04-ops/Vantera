import { ListChecks, NotebookPen, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScreenCard, ScreenNote } from "@/components/landing/feature-row";
import type { FeatureVisuals } from "../types";
import { ScoringWindow } from "./fit-scoring.window";
import {
  AISHA,
  Avatar,
  JAMAL,
  MARCUS,
  PassMark,
  PeekFrame,
  RACHEL,
  ROW,
  ScoreRing,
  Who,
} from "./prospect-discovery.parts";

/**
 * The pictures on /features/fit-scoring: the scoring window on the painted sky, one
 * card per benefit, one small picture per step, and the peek that rises out of the
 * closing band. They share the "Find buyers" window vocabulary with prospect discovery
 * (prospect-discovery.parts.tsx). Every name and number is sample data.
 */

/* ---------- Benefit screens ---------- */

/* Three prospects against the same five rules; the middle one fails two. */
const RULES: { rule: string; marks: [boolean, boolean, boolean] }[] = [
  { rule: "Title", marks: [true, true, true] },
  { rule: "Seniority", marks: [true, true, true] },
  { rule: "Industry", marks: [true, false, true] },
  { rule: "Headcount", marks: [true, false, true] },
  { rule: "Region", marks: [true, true, true] },
];
const GATED = [RACHEL, JAMAL, MARCUS];
const GRID = "grid grid-cols-[minmax(0,1fr)_2.25rem_2.25rem_2.25rem] items-center gap-2";

/** 01 — A fit gate on hard rules. */
function GateRulesScreen() {
  return (
    <ScreenCard
      title="Fit gate"
      meta={<span className="text-[0.68rem] text-[var(--ink-3)]">5 rules · 3 prospects</span>}
    >
      <div className={cn(GRID, "mb-1.5 px-3")}>
        <span className="text-[0.62rem] font-medium text-[var(--ink-3)]">Rule</span>
        {GATED.map((p) => (
          <span key={p.name} className="flex justify-center">
            <Avatar person={p} size="sm" />
          </span>
        ))}
      </div>
      <div className="space-y-1.5">
        {RULES.map((r) => (
          <div key={r.rule} className={cn(GRID, "rounded-lg border border-[var(--hairline)] bg-white px-3 py-1.5")}>
            <span className="text-xs font-medium text-foreground">{r.rule}</span>
            {r.marks.map((ok, i) => (
              <span key={i} className="flex justify-center">
                <PassMark ok={ok} />
              </span>
            ))}
          </div>
        ))}
        <div className={cn(GRID, "px-3 pt-1 text-[0.62rem] font-semibold")}>
          <span className="text-[var(--ink-3)]">Result</span>
          <span className="text-center text-[#13824a]">In</span>
          <span className="text-center text-[#c0365a]">Out</span>
          <span className="text-center text-[#13824a]">In</span>
        </div>
      </div>
    </ScreenCard>
  );
}

const POINTS = [
  { label: "Posted about pipeline pain · 3d", pts: 30, signal: true },
  { label: "Active this week", pts: 15, signal: true },
  { label: "Fit gate points", pts: 46, signal: false },
];

/** 02 — An AI rank on buying signals. */
function SignalPointsScreen() {
  return (
    <ScreenCard
      title="AI rank · Rachel Nguyen"
      meta={<span className="text-[0.68rem] font-semibold tabular-nums text-[var(--fb-strong)]">+45 from signals</span>}
    >
      <div className="space-y-1.5">
        {POINTS.map((p) => (
          <div
            key={p.label}
            className={cn(
              ROW,
              p.signal && "border-[rgba(24,119,242,0.2)] bg-[var(--cyan-tint)]",
            )}
          >
            <span className="flex min-w-0 items-center gap-2 text-xs font-medium text-foreground">
              {p.signal && <Sparkles className="size-3 shrink-0 text-[var(--fb-strong)]" />}
              <span className="truncate">{p.label}</span>
            </span>
            <span
              className={cn(
                "shrink-0 text-[0.72rem] font-semibold tabular-nums",
                p.signal ? "text-[var(--fb-strong)]" : "text-[var(--ink-3)]",
              )}
            >
              +{p.pts}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-[var(--hairline)] pt-3">
        <span className="text-xs font-semibold text-foreground">Score</span>
        <span className="text-[1.15rem] font-semibold leading-none tracking-tight text-[#13824a] tabular-nums">
          91<span className="text-[0.75rem] font-medium text-[var(--ink-3)]">/100</span>
        </span>
      </div>
    </ScreenCard>
  );
}

const WHY = [
  { k: "Pain point", v: "Rebuilding pipeline after a reorg" },
  { k: "Trigger", v: "Posted about it 3 days ago" },
  { k: "Angle to open with", v: "Pipeline without adding SDRs" },
];

/** 03 — A rationale behind every score. */
function RationaleScreen() {
  return (
    <ScreenCard
      title="Why 91 · Rachel Nguyen"
      meta={
        <span className="rounded-md bg-[#e3f5ea] px-1.5 py-0.5 text-[0.65rem] font-semibold tabular-nums text-[#13824a]">
          91/100
        </span>
      }
    >
      <div className="space-y-1.5">
        {WHY.map((w) => (
          <div key={w.k} className="rounded-lg border border-[var(--hairline)] bg-white px-3 py-2">
            <p className="text-[0.62rem] font-medium text-[var(--ink-3)]">{w.k}</p>
            <p className="mt-0.5 text-xs font-medium text-foreground">{w.v}</p>
          </div>
        ))}
      </div>
      <ScreenNote>Written by the agent, kept with the score, and used to write the opener.</ScreenNote>
    </ScreenCard>
  );
}

/* ---------- Step pictures ---------- */

/** 1 — Check the fit: rules filter the list. */
function RulesStep() {
  const rows = [
    { person: RACHEL, ok: true },
    { person: JAMAL, ok: false },
    { person: MARCUS, ok: true },
  ];
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.person.name} className={cn(ROW, !r.ok && "opacity-55")}>
          <span className={cn("min-w-0", !r.ok && "line-through decoration-[rgba(12,16,26,0.3)]")}>
            <Who person={r.person} />
          </span>
          <span className={cn("shrink-0 text-[0.65rem] font-medium", r.ok ? "text-[#13824a]" : "text-[#c0365a]")}>
            {r.ok ? "Passes" : "Off-profile"}
          </span>
        </div>
      ))}
    </div>
  );
}

/** 2 — Read the signals: each weighed, strongest first. */
function SignalsStep() {
  const weights = [
    { label: "Pipeline post", pts: 30 },
    { label: "Hiring", pts: 18 },
    { label: "Active this week", pts: 12 },
  ];
  return (
    <div className="space-y-2.5 rounded-lg border border-[var(--hairline)] bg-white px-3 py-2.5">
      {weights.map((w) => (
        <div key={w.label} className="grid grid-cols-[6.5rem_minmax(0,1fr)_1.8rem] items-center gap-2">
          <span className="truncate text-[0.68rem] font-medium text-foreground">{w.label}</span>
          <span className="block h-1.5 overflow-hidden rounded-full bg-[rgba(12,16,26,0.06)]">
            <span className="block h-full rounded-full bg-[var(--fb)]" style={{ width: `${(w.pts / 30) * 100}%` }} />
          </span>
          <span className="text-right text-[0.68rem] font-semibold tabular-nums text-[var(--fb-strong)]">
            +{w.pts}
          </span>
        </div>
      ))}
    </div>
  );
}

/** 3 — Clear the bar: 70 and above enters outreach. */
function ThresholdStep() {
  const dots = [
    { score: 58, held: true },
    { score: 74, held: false },
    { score: 86, held: false },
    { score: 91, held: false },
  ];
  return (
    <div className="rounded-lg border border-[var(--hairline)] bg-white px-3 pb-3 pt-6">
      <div className="relative h-1.5 rounded-full bg-[linear-gradient(90deg,rgba(12,16,26,0.06)_0%,rgba(12,16,26,0.06)_70%,rgba(24,119,242,0.2)_70%,rgba(24,119,242,0.2)_100%)]">
        {/* The bar */}
        <span className="absolute -top-4 bottom-[-0.5rem] left-[70%] w-px bg-[var(--fb-strong)]" />
        <span className="absolute -top-[1.35rem] left-[70%] -translate-x-1/2 rounded bg-[var(--fb-strong)] px-1 text-[0.58rem] font-semibold leading-tight text-white">
          70
        </span>
        {dots.map((d) => (
          <span
            key={d.score}
            className={cn(
              "absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white",
              d.held ? "bg-[#9aa0a8]" : "bg-[var(--fb)]",
            )}
            style={{ left: `${d.score}%` }}
          />
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between text-[0.62rem] font-medium">
        <span className="text-[var(--ink-3)]">Held back</span>
        <span className="text-[var(--fb-strong)]">To outreach</span>
      </div>
    </div>
  );
}

/* ---------- The closing band's screen ---------- */

/** The top of the scored list, rising out of the closing band. */
function ScoredPeek() {
  const rows = [
    { person: RACHEL, score: 91, why: "Pipeline post · 3d" },
    { person: MARCUS, score: 88, why: "Hiring two SDRs · 6d" },
    { person: AISHA, score: 86, why: "Seed round · 2w" },
  ];
  return (
    <PeekFrame
      title="Scored prospects"
      meta={
        <>
          <span className="size-1.5 rounded-full bg-[#16a34a]" />
          37 at 70+
        </>
      }
    >
      {rows.map((r) => (
        <div key={r.person.name} className={ROW}>
          <Who person={r.person} />
          <span className="flex shrink-0 items-center gap-2.5">
            <span className="hidden text-[0.68rem] text-[var(--ink-3)] sm:inline">{r.why}</span>
            <ScoreRing score={r.score} size="sm" />
          </span>
        </div>
      ))}
    </PeekFrame>
  );
}

export const visuals: FeatureVisuals = {
  Window: ScoringWindow,
  Peek: ScoredPeek,
  benefits: [GateRulesScreen, SignalPointsScreen, RationaleScreen],
  benefitIcons: [ListChecks, Sparkles, NotebookPen],
  steps: [RulesStep, SignalsStep, ThresholdStep],
};
