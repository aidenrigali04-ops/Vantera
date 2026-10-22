import {
  Activity,
  CalendarClock,
  Check,
  Clock,
  FileText,
  Globe,
  ListFilter,
  MessageCircle,
  Plus,
  Sparkles,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LiveMeta, ScreenCard, ScreenNote, ScreenRow } from "@/components/landing/feature-row";
import type { FeatureVisuals } from "../types";
import { ProspectingWindow } from "./prospect-discovery.window";
import {
  Chip,
  JAMAL,
  MARCUS,
  AISHA,
  PassMark,
  PeekFrame,
  RACHEL,
  ROW,
  ScoreBadge,
  Segmented,
  Who,
} from "./prospect-discovery.parts";

/**
 * The pictures on /features/prospect-discovery: the run window on the painted sky, one
 * card per benefit, one small picture per step, and the peek that rises out of the
 * closing band. Every name and number is sample data (the window says so).
 */

const ICP_CHIPS = ["VP Sales · B2B SaaS", "Head of Growth · Agencies", "Founders · Seed–Series A"];

/* ---------- Benefit screens ---------- */

/** 01 — Your ICP, searched on a schedule. */
function ScheduleScreen() {
  return (
    <ScreenCard title="Run schedule" meta={<LiveMeta>Live</LiveMeta>}>
      <Segmented options={["Daily", "Weekly"]} active="Daily" />
      <div className="mt-2.5 space-y-2">
        <ScreenRow label="Runs at" value="9:00 AM" />
        <ScreenRow label="Timezone" value="New York (ET)" />
      </div>
      <p className="mt-3.5 flex items-center justify-between text-[0.65rem] font-medium text-[var(--ink-3)]">
        Ideal customer profiles
        <span className="tabular-nums">3 of 3</span>
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {ICP_CHIPS.map((c) => (
          <Chip key={c} tone="blue">
            {c}
          </Chip>
        ))}
      </div>
    </ScreenCard>
  );
}

const GATE = [
  { rule: "Title", value: "VP Sales" },
  { rule: "Seniority", value: "VP" },
  { rule: "Industry", value: "B2B SaaS" },
  { rule: "Headcount", value: "140 · in 11–200" },
  { rule: "Region", value: "United States" },
];

/** 02 — A fit gate before anything else. */
function FitGateScreen() {
  return (
    <ScreenCard
      title="Fit gate · Rachel Nguyen"
      meta={
        <span className="rounded-md bg-[#e3f5ea] px-1.5 py-0.5 text-[0.65rem] font-semibold text-[#13824a]">
          Passed
        </span>
      }
    >
      <div className="space-y-1.5">
        {GATE.map((g) => (
          <div key={g.rule} className={ROW}>
            <span className="flex min-w-0 items-center gap-2 text-xs">
              <PassMark ok />
              <span className="font-medium text-foreground">{g.rule}</span>
            </span>
            <span className="truncate text-[0.7rem] text-[var(--ink-3)]">{g.value}</span>
          </div>
        ))}
        <div className={cn(ROW, "opacity-60")}>
          <span className="flex min-w-0 items-center gap-2 text-xs">
            <PassMark ok={false} />
            <span className="truncate font-medium text-foreground">{JAMAL.name} · headcount 2,400</span>
          </span>
          <span className="shrink-0 text-[0.68rem] font-medium text-[#c0365a]">Dropped</span>
        </div>
      </div>
    </ScreenCard>
  );
}

const SIGNALS = [
  { icon: FileText, text: "Posted about pipeline pain", age: "3d" },
  { icon: MessageCircle, text: "Commented on an outbound thread", age: "5d" },
  { icon: Activity, text: "Active on LinkedIn this week", age: "now" },
];

/** 03 — Signals that say why now. */
function SignalsScreen() {
  return (
    <ScreenCard
      title="Why now · Rachel Nguyen"
      meta={<span className="text-[0.68rem] text-[var(--ink-3)]">3 signals</span>}
    >
      <div className="space-y-1.5">
        {SIGNALS.map((s) => (
          <div key={s.text} className={ROW}>
            <span className="flex min-w-0 items-center gap-2 text-xs font-medium text-foreground">
              <span className="grid size-5 shrink-0 place-items-center rounded-md bg-[var(--cyan-tint)] text-[var(--fb-strong)]">
                <s.icon className="size-3" />
              </span>
              <span className="truncate">{s.text}</span>
            </span>
            <span className="shrink-0 text-[0.68rem] tabular-nums text-[var(--ink-4)]">{s.age}</span>
          </div>
        ))}
      </div>
      <ScreenNote>
        <span className="font-semibold">Agent&rsquo;s note: </span>
        Rachel is rebuilding pipeline after a reorg. Open with adding pipeline without adding
        SDRs.
      </ScreenNote>
    </ScreenCard>
  );
}

/* ---------- Step pictures ---------- */

/** 1 — Paste your website: the site read into a buyer profile. */
function WebsiteStep() {
  return (
    <div className="space-y-2">
      <div className={ROW}>
        <span className="flex items-center gap-2 text-xs font-medium text-foreground">
          <Globe className="size-3.5 text-[var(--ink-4)]" />
          acme.io
        </span>
        <span className="text-[0.65rem] font-medium text-[var(--fb-strong)]">Read</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {["B2B SaaS", "11–200 people", "VP Sales", "United States"].map((c) => (
          <Chip key={c}>
            <Check className="size-3 text-[#16a34a]" strokeWidth={3} />
            {c}
          </Chip>
        ))}
      </div>
    </div>
  );
}

/** 2 — Confirm your ICP: up to three profiles. */
function IcpStep() {
  return (
    <div className="space-y-2">
      <div className={ROW}>
        <span className="truncate text-xs font-medium text-foreground">VP Sales · B2B SaaS</span>
        <span className="shrink-0 rounded-md bg-[var(--cyan-tint)] px-1.5 py-0.5 text-[0.62rem] font-semibold text-[var(--cyan-strong)]">
          Suggested
        </span>
      </div>
      <div className={ROW}>
        <span className="truncate text-xs font-medium text-foreground">Head of Growth · Agencies</span>
        <span className="shrink-0 text-[0.62rem] font-medium text-[var(--ink-3)]">Added</span>
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-dashed border-[rgba(12,16,26,0.16)] px-3 py-2 text-xs font-medium text-[var(--ink-3)]">
        <Plus className="size-3.5" />
        Add a third profile
        <span className="ml-auto text-[0.65rem] tabular-nums">2 of 3</span>
      </div>
    </div>
  );
}

/** 3 — Pick a schedule. */
function ScheduleStep() {
  return (
    <div className="space-y-2">
      <Segmented options={["Daily", "Weekly"]} active="Daily" />
      <div className={ROW}>
        <span className="flex items-center gap-2 text-xs font-medium text-foreground">
          <Clock className="size-3.5 text-[var(--ink-4)]" />
          9:00 AM · ET
        </span>
        <span className="text-[0.65rem] font-medium text-[#13824a]">Scheduled</span>
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-[rgba(24,119,242,0.25)] bg-[var(--cyan-tint)] px-3 py-2 text-xs font-medium text-foreground">
        <Sparkles className="size-3.5 text-[var(--fb-strong)]" />
        First run starts within minutes
      </div>
    </div>
  );
}

/* ---------- The closing band's screen ---------- */

/** The top of a finished run, rising out of the closing band. */
function RunPeek() {
  const rows = [
    { person: RACHEL, signal: "Pipeline post · 3d", score: 94 },
    { person: MARCUS, signal: "Outbound comment · 2d", score: 91 },
    { person: AISHA, signal: "Seed round · 2w", score: 89 },
  ];
  return (
    <PeekFrame
      title="Qualified this run"
      meta={
        <>
          <span className="size-1.5 rounded-full bg-[#16a34a]" />
          37 to outreach
        </>
      }
    >
      {rows.map((r) => (
        <div key={r.person.name} className={ROW}>
          <Who person={r.person} />
          <span className="flex shrink-0 items-center gap-2.5">
            <span className="hidden items-center gap-1 text-[0.68rem] text-[var(--ink-3)] sm:flex">
              <Zap className="size-3 text-[var(--fb)]" />
              {r.signal}
            </span>
            <ScoreBadge score={r.score} />
          </span>
        </div>
      ))}
    </PeekFrame>
  );
}

export const visuals: FeatureVisuals = {
  Window: ProspectingWindow,
  Peek: RunPeek,
  benefits: [ScheduleScreen, FitGateScreen, SignalsScreen],
  benefitIcons: [CalendarClock, ListFilter, Zap],
  steps: [WebsiteStep, IcpStep, ScheduleStep],
};
