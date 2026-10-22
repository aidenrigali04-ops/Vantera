import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BookCheck,
  ChartNoAxesColumnIncreasing,
  Check,
  Minus,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { VanteraLogo } from "@/components/landing/vantera-logo";
import { LiveMeta, ScreenCard, ScreenNote } from "@/components/landing/feature-row";
import type { FeatureVisuals } from "../types";
import { TargetingWindow } from "./machine-learned-targeting.window";

/**
 * The pictures on /features/machine-learned-targeting, drawn the way the landing draws
 * the product: white screens, hairline borders, soft blue for what's live. The window
 * (machine-learned-targeting.window.tsx) runs on the client; everything here is static
 * and server-rendered. Sample data throughout — the window carries a SAMPLE chip.
 *
 * This module stays a server module on purpose: the page reads `visuals.Window` etc.
 * on the server, which it can't do across a "use client" boundary.
 */

const ROW = "flex items-center justify-between gap-3 rounded-lg border border-[var(--hairline)] bg-white px-3 py-2";

type Trend = "up" | "down" | "flat";

function TrendChip({ trend }: { trend: Trend }) {
  if (trend === "up")
    return (
      <span className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-[#e3f5ea] px-1.5 py-0.5 text-[0.65rem] font-semibold text-[#13824a]">
        <ArrowUp className="size-3" strokeWidth={2.4} />
        More
      </span>
    );
  if (trend === "down")
    return (
      <span className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-[rgba(12,16,26,0.05)] px-1.5 py-0.5 text-[0.65rem] font-semibold text-[var(--ink-3)]">
        <ArrowDown className="size-3" strokeWidth={2.4} />
        Less
      </span>
    );
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-[rgba(12,16,26,0.04)] px-1.5 py-0.5 text-[0.65rem] font-semibold text-[var(--ink-4)]">
      <Minus className="size-3" strokeWidth={2.4} />
      Hold
    </span>
  );
}

/* ---------- Benefit screens ---------- */

const LEDGER = [
  { segment: "VP Sales · SaaS 11–50", accepted: 48, replied: 19, booked: 9 },
  { segment: "RevOps leads · Series A", accepted: 31, replied: 12, booked: 6 },
  { segment: "Head of Growth · agencies", accepted: 36, replied: 11, booked: 4 },
  { segment: "Enterprise · 1,000+", accepted: 14, replied: 2, booked: 0 },
];

/** 01 — Learns from real outcomes: the month's outcomes per segment. */
function OutcomesScreen() {
  return (
    <ScreenCard title="Outcomes · this month" meta={<LiveMeta>Learning</LiveMeta>}>
      <div className="mb-1.5 grid grid-cols-[1fr_3.4rem_3.4rem_3.4rem] gap-2 px-3 text-[0.62rem] font-medium text-[var(--ink-3)]">
        <span>Segment</span>
        <span className="text-right">Accepted</span>
        <span className="text-right">Replied</span>
        <span className="text-right">Booked</span>
      </div>
      <div className="space-y-1.5">
        {LEDGER.map((r) => (
          <div
            key={r.segment}
            className="grid grid-cols-[1fr_3.4rem_3.4rem_3.4rem] items-center gap-2 rounded-lg border border-[var(--hairline)] bg-white px-3 py-2 text-xs"
          >
            <span className="truncate font-medium text-foreground">{r.segment}</span>
            <span className="text-right tabular-nums text-[var(--ink-3)]">{r.accepted}</span>
            <span className="text-right tabular-nums text-[var(--ink-3)]">{r.replied}</span>
            <span
              className={cn(
                "text-right font-semibold tabular-nums",
                r.booked > 0 ? "text-[#13824a]" : "text-[var(--ink-4)]",
              )}
            >
              {r.booked}
            </span>
          </div>
        ))}
      </div>
      <ScreenNote>Opens and clicks don&rsquo;t count. Only accepted, replied, and booked.</ScreenNote>
    </ScreenCard>
  );
}

const WEIGHTS: { label: string; weight: number; trend: Trend }[] = [
  { label: "VP Sales · SaaS 11–50", weight: 0.82, trend: "up" },
  { label: "RevOps leads · Series A", weight: 0.72, trend: "up" },
  { label: "Head of Growth · agencies", weight: 0.67, trend: "up" },
  { label: "Changed jobs · 30d", weight: 0.52, trend: "flat" },
  { label: "Enterprise · 1,000+", weight: 0.2, trend: "down" },
];

/** 02 — Shifts weight toward who responds. */
function WeightsScreen() {
  return (
    <ScreenCard title="Segment weights" meta={<LiveMeta>Updated today</LiveMeta>}>
      <div className="space-y-1.5">
        {WEIGHTS.map((w) => (
          <div key={w.label} className={cn(ROW, "gap-2.5")}>
            <span className="w-[42%] truncate text-xs font-medium text-foreground">{w.label}</span>
            <span className="block h-1.5 flex-1 overflow-hidden rounded-full bg-[rgba(12,16,26,0.06)]">
              <span
                className={cn("block h-full rounded-full bg-[var(--fb)]", w.weight < 0.3 && "opacity-45")}
                style={{ width: `${Math.round(w.weight * 100)}%` }}
              />
            </span>
            <TrendChip trend={w.trend} />
          </div>
        ))}
      </div>
    </ScreenCard>
  );
}

/** 03 — Rolls back what doesn't work. */
function RollbackScreen() {
  return (
    <ScreenCard
      title="Test #13 · recent job changes"
      meta={
        <span className="inline-flex items-center gap-1 rounded-md bg-[#fdedf1] px-1.5 py-0.5 text-[0.65rem] font-semibold text-[#be123c]">
          <RotateCcw className="size-3" strokeWidth={2.6} />
          Rolled back
        </span>
      }
    >
      <div className="space-y-1.5">
        {[
          { tag: "A", label: "Current mix", rate: 14, note: "Baseline", bar: "bg-[var(--fb)]" },
          { tag: "B", label: "+ Changed jobs · 30d", rate: 7, note: "Underperformed", bar: "bg-[#f43f5e]" },
        ].map((v) => (
          <div key={v.tag} className="rounded-lg border border-[var(--hairline)] bg-white px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span className="grid size-5 shrink-0 place-items-center rounded-md bg-[rgba(12,16,26,0.05)] text-[0.62rem] font-semibold text-[var(--ink-2)]">
                {v.tag}
              </span>
              <span className="truncate text-xs font-medium text-foreground">{v.label}</span>
              <span className="ml-auto shrink-0 text-[0.65rem] text-[var(--ink-4)]">{v.note}</span>
            </div>
            <div className="mt-2 grid grid-cols-[1fr_auto] items-center gap-3">
              <span className="block h-1.5 overflow-hidden rounded-full bg-[rgba(12,16,26,0.06)]">
                <span className={cn("block h-full rounded-full", v.bar)} style={{ width: `${v.rate * 3.4}%` }} />
              </span>
              <span className="text-[0.68rem] font-semibold tabular-nums text-foreground">{v.rate}% interested</span>
            </div>
          </div>
        ))}
      </div>
      <ScreenNote>
        Variant B underperformed on 44 conversations, so it was rolled back automatically.
        Nothing for you to undo.
      </ScreenNote>
    </ScreenCard>
  );
}

/* ---------- Step pictures ---------- */

/** 1 — Start from proven plays. */
function ProvenStep() {
  return (
    <div className="space-y-2">
      {["Open with their hiring post", "Open with a peer result"].map((play) => (
        <div key={play} className={ROW}>
          <span className="truncate text-xs font-medium text-foreground">{play}</span>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-[#e3f5ea] px-1.5 py-0.5 text-[0.62rem] font-semibold text-[#13824a]">
            <Check className="size-2.5" strokeWidth={3} />
            Proven
          </span>
        </div>
      ))}
    </div>
  );
}

/** 2 — Test on a small slice. */
function SliceStep() {
  return (
    <div className="space-y-2.5">
      <div className="flex h-7 overflow-hidden rounded-lg border border-[var(--hairline)] bg-white text-[0.65rem] font-semibold">
        <span className="flex w-[90%] items-center px-2.5 text-[var(--ink-3)]">90% · current targeting</span>
        <span className="flex w-[10%] min-w-[2.6rem] items-center justify-center bg-[var(--cyan-tint)] text-[var(--cyan-strong)] [background-image:repeating-linear-gradient(135deg,transparent_0_4px,rgba(24,119,242,0.12)_4px_6px)]">
          10%
        </span>
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-[var(--hairline)] bg-white px-3 py-2 text-xs font-medium text-foreground">
        <ShieldCheck className="size-3.5 shrink-0 text-[#13824a]" />
        Same safety limits on every test
      </div>
    </div>
  );
}

/** 3 — Keep what wins. */
function KeepStep() {
  return (
    <div className="space-y-2">
      <div className={ROW}>
        <span className="truncate text-xs font-medium text-foreground">+ RevOps leads · Series A</span>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-[#13824a] px-1.5 py-0.5 text-[0.62rem] font-semibold text-white">
          <ArrowUp className="size-2.5" strokeWidth={3} />
          Kept
        </span>
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-[rgba(24,119,242,0.25)] bg-[var(--cyan-tint)] px-3 py-2 text-xs font-medium text-foreground">
        <BookCheck className="size-3.5 shrink-0 text-[var(--fb)]" />
        Remembered for every conversation after
      </div>
    </div>
  );
}

/* ---------- The closing band's screen ---------- */

/** The top of the model, rising out of the closing band. */
function TargetingPeek() {
  return (
    <div className="rounded-t-xl border border-b-0 border-white/20 bg-white p-4 text-left shadow-[0_-12px_48px_-16px_rgba(4,24,72,0.55)] sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-[0.8rem] font-semibold text-foreground">
          <VanteraLogo className="size-4 text-[var(--fb)]" />
          Targeting model
        </span>
        <span className="flex items-center gap-1.5 text-[0.7rem] font-medium text-[var(--ink-3)]">
          <span className="size-1.5 rounded-full bg-[#13a05a]" />
          Updated today
        </span>
      </div>
      <div className="mt-3.5 space-y-2">
        {WEIGHTS.slice(0, 3).map((w) => (
          <div key={w.label} className={ROW}>
            <span className="truncate text-xs font-medium text-foreground">{w.label}</span>
            <TrendChip trend={w.trend} />
          </div>
        ))}
      </div>
    </div>
  );
}

export const visuals: FeatureVisuals = {
  Window: TargetingWindow,
  Peek: TargetingPeek,
  benefits: [OutcomesScreen, WeightsScreen, RollbackScreen],
  benefitIcons: [ChartNoAxesColumnIncreasing, ArrowUpDown, RotateCcw],
  steps: [ProvenStep, SliceStep, KeepStep],
};
