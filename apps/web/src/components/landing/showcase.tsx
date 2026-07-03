"use client";

import { memo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Check,
  Inbox,
  MessageSquare,
  Pencil,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LandingHeading } from "./heading";
import { Gauge, Sparkline, useInViewOnce } from "./viz";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/* ── LinkedIn brand glyph — lucide dropped brand icons, so we render it inline. ── */
function LinkedinMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z" />
    </svg>
  );
}

/* ── Shared mockup shell — the hero-calendar light-card recipe: hairline border, a
   crisp inner top-highlight, layered soft shadow, and a tasteful hover lift. ── */
function MockChrome({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="group relative">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-3 -z-10 rounded-[28px] blur-2xl"
        style={{ background: "radial-gradient(60% 70% at 60% 25%, rgba(24,119,242,0.09), transparent 70%)" }}
      />
      <div
        className="overflow-hidden rounded-2xl border border-[#E6EAEE] bg-white transition-[transform,box-shadow,border-color] duration-300 group-hover:-translate-y-1 group-hover:border-[var(--cyan-line)]"
        style={{
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,.6), 0 1px 2px rgba(16,24,32,.04), 0 8px 20px -10px rgba(16,24,32,.1)",
        }}
      >
        <div className="flex items-center gap-2.5 border-b border-[var(--hairline)] bg-[#fbfbfc] px-3.5 py-2.5">
          <div className="flex gap-1.5">
            <span className="size-2 rounded-full bg-[#e5e6e8]" />
            <span className="size-2 rounded-full bg-[#e5e6e8]" />
            <span className="size-2 rounded-full bg-[#e5e6e8]" />
          </div>
          <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-4)]">
            {label}
          </span>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function Avatar({ initials, color }: { initials: string; color: string }) {
  return (
    <span
      className="grid size-9 shrink-0 place-items-center rounded-full text-[12px] font-semibold text-[#0a0c12]"
      style={{ backgroundColor: color }}
    >
      {initials}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   MOCKUP 1 — Prospect: an autopilot pipeline loop (Source → Score → Prioritize → repeat)
   ═══════════════════════════════════════════════════════════════════════════════ */
const LOOP_STAGES = [
  { label: "Source", sub: "In-market on LinkedIn", Icon: Target },
  { label: "Score", sub: "Matched to your ICP", Icon: Sparkles },
  { label: "Prioritize", sub: "Highest-intent first", Icon: ArrowRight },
];

const PipelineLoop = memo(function PipelineLoop() {
  const reduce = useReducedMotion();
  return (
    <MockChrome label="Autopilot pipeline">
      <div className="flex items-center justify-between px-1 pb-3">
        <div>
          <p className="text-[13px] font-semibold text-foreground">Always-on prospecting</p>
          <p className="text-[11px] text-[var(--ink-4)]">Runs on a loop, no manual research</p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-[var(--cyan-strong)]">
          <motion.span
            aria-hidden
            className="grid place-items-center"
            animate={reduce ? undefined : { rotate: 360 }}
            transition={{ duration: 6, ease: "linear", repeat: Infinity }}
          >
            <RefreshCw className="size-3" strokeWidth={2.4} />
          </motion.span>
          Live
        </span>
      </div>

      {/* the loop: three connected stages, a packet pulses around them */}
      <div className="relative rounded-2xl border border-[var(--hairline)] bg-[#fbfcfe] p-4">
        <div className="relative flex items-stretch justify-between gap-2">
          {LOOP_STAGES.map((s, i) => (
            <div key={s.label} className="flex flex-1 items-center gap-2">
              <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5 text-center">
                <motion.span
                  className="grid size-10 place-items-center rounded-xl border border-[var(--cyan-line)] bg-white text-[var(--cyan-strong)] shadow-[0_1px_2px_rgba(12,16,26,0.05)]"
                  animate={
                    reduce
                      ? undefined
                      : { boxShadow: ["0 0 0 0 rgba(24,119,242,0)", "0 0 0 6px rgba(24,119,242,0.14)", "0 0 0 0 rgba(24,119,242,0)"] }
                  }
                  transition={{ duration: 2.4, ease: EASE, repeat: Infinity, delay: i * 0.8 }}
                >
                  <s.Icon className="size-[18px]" strokeWidth={1.9} />
                </motion.span>
                <span className="text-[11.5px] font-semibold leading-none text-foreground">{s.label}</span>
                <span className="text-[9px] leading-tight text-[var(--ink-4)]">{s.sub}</span>
              </div>
              {i < LOOP_STAGES.length - 1 && (
                <ArrowRight className="mb-5 size-4 shrink-0 text-[var(--ink-4)]" strokeWidth={2} />
              )}
            </div>
          ))}
        </div>

        {/* repeat rail — a track with a travelling cyan packet closing the loop */}
        <div className="relative mt-4 h-6">
          <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[var(--hairline)]" />
          <span className="absolute left-0 top-1/2 size-1.5 -translate-y-1/2 rounded-full bg-[var(--cyan)]" />
          <span className="absolute right-0 top-1/2 size-1.5 -translate-y-1/2 rounded-full bg-[var(--cyan)]" />
          {!reduce && (
            <motion.span
              className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--cyan)] shadow-[0_0_6px_rgba(24,119,242,0.5)]"
              animate={{ left: ["0%", "100%", "0%"] }}
              transition={{ duration: 3.2, ease: EASE, repeat: Infinity }}
            />
          )}
          <span className="absolute inset-x-0 top-1/2 mt-2 flex justify-center text-[9px] font-medium uppercase tracking-[0.14em] text-[var(--ink-4)]">
            Repeat every day
          </span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between px-1">
        <span className="inline-flex items-center gap-2 text-[10.5px] font-semibold text-[var(--cyan-strong)]">
          128 sourced this week
          <Sparkline points={[70, 84, 96, 108, 120, 128]} width={44} height={14} />
        </span>
        <span className="text-[10px] text-[var(--ink-4)]">Best buyers first</span>
      </div>
    </MockChrome>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════════
   MOCKUP 2 — Intent: a prospect intent card (score ring + signal chips)
   ═══════════════════════════════════════════════════════════════════════════════ */
const SIGNALS = [
  { label: "Follows your company", tone: "cyan" as const },
  { label: "Engaged a competitor", tone: "cyan" as const },
  { label: "Active in your space", tone: "cyan" as const },
];

function ScoreRing({ score }: { score: number }) {
  const reduce = useReducedMotion();
  const R = 26;
  const C = 2 * Math.PI * R;
  const pct = Math.min(100, score) / 100;
  return (
    <div className="relative grid size-[64px] shrink-0 place-items-center">
      <svg viewBox="0 0 64 64" className="size-full -rotate-90">
        <circle cx="32" cy="32" r={R} fill="none" stroke="#eef0f3" strokeWidth="5" />
        <motion.circle
          cx="32"
          cy="32"
          r={R}
          fill="none"
          stroke="var(--cyan)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={C}
          initial={{ strokeDashoffset: reduce ? C * (1 - pct) : C }}
          whileInView={{ strokeDashoffset: C * (1 - pct) }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: reduce ? 0 : 1, ease: EASE, delay: 0.2 }}
        />
      </svg>
      <div className="absolute flex flex-col items-center leading-none">
        <span className="text-[17px] font-semibold tabular-nums text-[var(--cyan-strong)]">{score}</span>
        <span className="mt-0.5 text-[7.5px] font-bold uppercase tracking-[0.1em] text-[var(--ink-4)]">Match</span>
      </div>
    </div>
  );
}

const IntentCard = memo(function IntentCard() {
  return (
    <MockChrome label="Intent signals">
      <div className="flex items-center justify-between px-1 pb-3">
        <div>
          <p className="text-[13px] font-semibold text-foreground">Pre-filtered to a 70+ match</p>
          <p className="text-[11px] text-[var(--ink-4)]">Only in-market buyers reach you</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(24,119,242,0.3)] bg-[var(--cyan-tint)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--cyan-strong)]">
          Bar 70
        </span>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.5 }}
        className="rounded-2xl border border-[var(--hairline)] bg-[#fbfcfe] p-4"
      >
        <div className="flex items-center gap-3">
          <Avatar initials="RN" color="#1877f2" />
          <div className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-semibold text-foreground">Rachel Nguyen</span>
            <span className="block truncate text-[11.5px] text-[var(--ink-3)]">VP Revenue · Northwind Labs</span>
          </div>
          <ScoreRing score={92} />
        </div>

        <div className="mt-3.5 flex flex-wrap gap-1.5">
          {SIGNALS.map((s, i) => (
            <motion.span
              key={s.label}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.35, delay: 0.35 + i * 0.1, ease: EASE }}
              className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(24,119,242,0.3)] bg-[var(--cyan-tint)] px-2.5 py-1 text-[10px] font-medium text-[var(--cyan-strong)]"
            >
              <span className="size-1.5 rounded-full bg-[var(--cyan)]" />
              {s.label}
            </motion.span>
          ))}
        </div>
      </motion.div>

      <div className="mt-3 flex items-center justify-between px-1">
        <span className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold text-[var(--cyan-strong)]">
          <Check className="size-3.5" strokeWidth={2.6} />
          Clears the bar
        </span>
        <span className="text-[10px] text-[var(--ink-4)]">Below-bar leads never surface</span>
      </div>
    </MockChrome>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════════
   MOCKUP 3 — Outreach: a LinkedIn DM composer (grounded tag + safe-pacing meter)
   ═══════════════════════════════════════════════════════════════════════════════ */
const OutreachMock = memo(function OutreachMock() {
  return (
    <MockChrome label="LinkedIn message">
      <div className="flex items-center gap-3 px-1 pb-3">
        <span className="grid size-9 place-items-center rounded-full border border-[var(--hairline)] bg-white shadow-[var(--shadow-sm)]">
          <LinkedinMark className="size-[18px] text-[var(--fb)]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
            Rachel Nguyen
            <span className="rounded-full bg-[var(--cyan-tint)] px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-[0.1em] text-[var(--cyan-strong)]">
              1st
            </span>
          </p>
          <p className="text-[11px] text-[var(--ink-4)]">VP Revenue · Northwind Labs</p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(24,119,242,0.3)] bg-[var(--cyan-tint)] px-2 py-1 text-[9px] font-semibold text-[var(--cyan-strong)]">
          <Sparkles className="size-3" strokeWidth={1.9} />
          Grounded in their activity
        </span>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.5 }}
        className="rounded-2xl rounded-tl-md border border-[var(--hairline)] bg-[#f6faff] p-4"
      >
        <p className="text-[13.5px] leading-relaxed text-[var(--ink-2)]">
          Hi Rachel — your post on tightening rev ops as you scale really landed. Teams your size usually
          hit the same pipeline-visibility wall around now. We fixed exactly that for two others in your
          space — open to a quick look?
        </p>
      </motion.div>

      {/* composer bar */}
      <div className="mt-3 flex items-center gap-2 rounded-full border border-[var(--hairline)] bg-white px-3 py-2 shadow-[var(--shadow-sm)]">
        <MessageSquare className="size-4 shrink-0 text-[var(--ink-4)]" strokeWidth={1.9} />
        <span className="min-w-0 flex-1 truncate text-[11.5px] text-[var(--ink-4)]">Message ready to send…</span>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--fb-strong)] px-3 py-1.5 text-[11px] font-semibold text-white">
          Send
          <ArrowRight className="size-3.5" strokeWidth={2.4} />
        </span>
      </div>

      {/* safe-pacing indicator — a real gauge with tick marks */}
      <SafePacing />
    </MockChrome>
  );
});

/** Pacing gauge, split out so it can gate its fill on scroll-into-view. */
function SafePacing() {
  const [ref, inView] = useInViewOnce();
  return (
    <div ref={ref} className="mt-3.5 rounded-xl border border-[var(--hairline)] bg-[#fbfcfe] p-3">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold text-[var(--ink-2)]">
          <ShieldCheck className="size-3.5 text-[var(--cyan-strong)]" strokeWidth={2} />
          LinkedIn-safe pacing
        </span>
        <span className="text-[10px] tabular-nums text-[var(--ink-4)]">62 / 100 · 3 senders</span>
      </div>
      <Gauge className="mt-2.5" pct={62} ticks={[25, 50, 75]} run={inView} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   MOCKUP 4 — Control + Visibility: approval action row + reply-capture inbox
   ═══════════════════════════════════════════════════════════════════════════════ */
const REPLIES = [
  { initials: "RN", name: "Rachel Nguyen", preview: "Happy to chat — how's Thursday?", tag: "Interested", color: "#1877f2" },
  { initials: "DM", name: "Devon Miles", preview: "Send me the details and I'll review.", tag: "New", color: "#7c8cff" },
  { initials: "AO", name: "Aisha Okafor", preview: "We're evaluating options now.", tag: "New", color: "#34d399" },
];

const ControlMock = memo(function ControlMock() {
  return (
    <MockChrome label="Approve & capture">
      {/* approval action row */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.5 }}
        className="rounded-2xl border border-[var(--hairline)] bg-[#fbfcfe] p-3.5"
      >
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
            <Sparkles className="size-3.5 text-[var(--cyan-strong)]" strokeWidth={1.9} />
            3 drafts waiting for you
          </span>
          <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--ink-4)]">
            You approve
          </span>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--hairline)] bg-white px-3 py-1.5 text-[12px] font-medium text-[var(--ink-2)] transition-colors hover:border-[var(--cyan-line)]"
          >
            <Pencil className="size-3.5" strokeWidth={1.9} />
            Edit
          </button>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--cyan-strong)] px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-[0_2px_8px_-2px_rgba(24,119,242,0.35)]">
            <Check className="size-3.5" strokeWidth={2.5} />
            Approve all
          </span>
        </div>
      </motion.div>

      {/* reply-capture inbox */}
      <div className="mt-3.5 flex items-center justify-between px-1 pb-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
          <Inbox className="size-3.5 text-[var(--cyan-strong)]" strokeWidth={1.9} />
          Every reply captured
        </span>
        <span className="text-[10px] tabular-nums text-[var(--ink-4)]">100% visibility</span>
      </div>

      <div className="flex flex-col gap-2">
        {REPLIES.map((r, i) => (
          <motion.div
            key={r.name}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.45, delay: 0.15 + i * 0.1 }}
            className="flex items-center gap-3 rounded-xl border border-[var(--hairline)] bg-[#fbfcfe] p-2.5"
          >
            <Avatar initials={r.initials} color={r.color} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-[13px] font-semibold text-foreground">{r.name}</span>
                <span
                  className={cn(
                    "ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-[0.1em]",
                    r.tag === "Interested"
                      ? "bg-[var(--cyan-tint)] text-[var(--cyan-strong)]"
                      : "bg-[#f1f2f4] text-[var(--ink-4)]",
                  )}
                >
                  {r.tag}
                </span>
              </div>
              <p className="mt-0.5 truncate text-[11.5px] text-[var(--ink-3)]">{r.preview}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </MockChrome>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════════
   Panels — the stepped feature reveal
   ═══════════════════════════════════════════════════════════════════════════════ */
type Panel = {
  step: string;
  tag: string;
  title: string;
  body: string;
  points: string[];
  visual: React.ReactNode;
};

const PANELS: Panel[] = [
  {
    step: "01",
    tag: "Prospect",
    title: "Finds and ranks your best buyers first.",
    body: "Your agent sources in-market prospects on LinkedIn and scores each one against your ICP, working the highest-intent people first. It runs on a loop, day after day, with no manual research.",
    points: ["Sourced from live LinkedIn activity", "Highest-intent buyers surfaced first"],
    visual: <PipelineLoop />,
  },
  {
    step: "02",
    tag: "Intent",
    title: "Only your best prospects. Nothing else.",
    body: "Every lead is pre-filtered to a 70+ ICP match and backed by real intent: engaged a competitor, follows your company, active in your space. If they don't clear the bar, they never reach you.",
    points: ["Pre-filtered to a 70+ ICP match", "Backed by verifiable intent signals"],
    visual: <IntentCard />,
  },
  {
    step: "03",
    tag: "Outreach",
    title: "Personal messages, never a template.",
    body: "Each message is written from that prospect's real activity, then sent on LinkedIn-safe pacing across multiple senders. You scale outreach without putting your accounts at risk.",
    points: ["Written from each prospect's activity", "Safe pacing keeps every account protected"],
    visual: <OutreachMock />,
  },
  {
    step: "04",
    tag: "Control",
    title: "You approve. Every reply is captured.",
    body: "Human-in-the-loop by default: nothing sends without your sign-off. You get full reply visibility, so every conversation lands in one place and no warm lead slips through.",
    points: ["Human-in-the-loop by default", "Full reply visibility, nothing missed"],
    visual: <ControlMock />,
  },
];

function StepPanel({ panel, index }: { panel: Panel; index: number }) {
  const flip = index % 2 === 1;
  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-100px" }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.12, delayChildren: 0.05 } } }}
      className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16"
    >
      {/* copy column */}
      <motion.div
        variants={{
          hidden: { opacity: 0, x: flip ? 28 : -28 },
          show: { opacity: 1, x: 0, transition: { duration: 0.7, ease: EASE } },
        }}
        className={flip ? "lg:order-2" : ""}
      >
        {/* step index + rule — crisp mono index, hairline fills the row, quiet tag label */}
        <div className="flex items-center gap-4">
          <span className="font-mono text-[12px] font-medium tabular-nums leading-none tracking-[0.04em]">
            <span className="text-[var(--cyan-strong)]">{panel.step}</span>
            <span className="text-[var(--ink-4)]"> / 04</span>
          </span>
          <span className="h-px flex-1 bg-[var(--hairline)]" />
          <span className="shrink-0 whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--cyan-strong)]">
            {panel.tag}
          </span>
        </div>
        <h3 className="mt-6 text-[1.75rem] font-semibold leading-[1.1] tracking-[-0.03em] text-foreground sm:text-[2.15rem]">
          {panel.title}
        </h3>
        <p className="mt-4 max-w-md text-[15px] leading-relaxed text-[var(--ink-3)] sm:text-[17px]">
          {panel.body}
        </p>
        <ul className="mt-7 flex flex-col gap-3.5">
          {panel.points.map((p) => (
            <li
              key={p}
              className="flex items-start gap-3 text-[14px] leading-6 text-[var(--ink-2)]"
            >
              <span className="mt-[3px] grid size-5 shrink-0 place-items-center rounded-full bg-[var(--cyan-strong)] text-white shadow-[0_1px_3px_rgba(24,119,242,0.35)]">
                <Check className="size-3" strokeWidth={3} />
              </span>
              {p}
            </li>
          ))}
        </ul>
      </motion.div>

      {/* visual column */}
      <motion.div
        variants={{
          hidden: { opacity: 0, y: 32 },
          show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: EASE } },
        }}
        className={flip ? "lg:order-1" : ""}
      >
        {panel.visual}
      </motion.div>
    </motion.div>
  );
}

export function Showcase() {
  return (
    <section
      id="showcase"
      className="relative border-t border-[var(--hairline)] py-24 sm:py-28 lg:py-32"
    >
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <LandingHeading
          eyebrow="The system"
          title="Everything an SDR does, running on its own"
          subtitle="Four steps, fully automated: your agents source in-market buyers, qualify them against your ICP, write every message from real activity, and route the reply to you."
        />

        <div className="mt-20 flex flex-col gap-20 lg:mt-24 lg:gap-24">
          {PANELS.map((panel, i) => (
            <StepPanel key={panel.step} panel={panel} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
