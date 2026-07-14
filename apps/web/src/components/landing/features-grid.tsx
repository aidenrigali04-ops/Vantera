"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LandingHeading } from "./heading";
import { Reveal, RevealItem, CARD_INTERACTIVE } from "./surface";
import {
  ControlIcon,
  CrmSyncIcon,
  LearnIcon,
  OutreachIcon,
  ProspectingIcon,
  RepliesIcon,
  SafetyIcon,
  type ProductIcon,
} from "./product-icons";
import { BarChart, INSET_CARD_SHADOW, LegendRow, StatusDot, useInViewOnce } from "./viz";
import { cn } from "@/lib/utils";

/**
 * Feature grid — the pillars that make Vantera run an entire LinkedIn outreach
 * motion end to end. Built on the hero's light-card system (CARD_INTERACTIVE +
 * Reveal/RevealItem, one-accent Facebook-blue treatment on white cards with hairline
 * borders). TWO cards span both columns and carry the heavier --fb/blue wash plus a
 * "Vantera only" badge — SAFETY (anti-ban pacing) and LEARNING (tests, keeps winners,
 * gets sharper) — the differentiator pair no sequencer can claim. The grid closes on
 * a full-width CRM tile so the last row stays balanced (no dangling half-row).
 */

type Feature = {
  label: string;
  title: string;
  line: string;
  chips: string[];
  icon: ProductIcon;
};

const FEATURES: Feature[] = [
  {
    label: "Prospecting",
    title: "Finds and prioritizes your best buyers",
    line: "Agents watch LinkedIn for in-market behavior, then rank every match against your ICP so effort lands on the accounts most likely to close.",
    chips: ["intent signals", "lookalikes", "lead scoring", "ICP filtering"],
    icon: ProspectingIcon,
  },
  {
    label: "Outreach",
    title: "Human-quality LinkedIn messages at scale",
    line: "Every message starts from a play that's proven, then is written from the prospect's real activity — never a template — so it reads like you sat down and wrote it yourself.",
    chips: ["starts from proven plays", "context-aware", "personalized"],
    icon: OutreachIcon,
  },
  {
    label: "Control",
    title: "Full auto or approve before it sends",
    line: "Run hands-off, or keep a human in the loop and sign off on each message. No rigid sequences you have to fight — you set the level of control.",
    chips: ["human-in-the-loop default", "no rigid workflows"],
    icon: ControlIcon,
  },
  {
    label: "Replies",
    title: "100% reply visibility",
    line: "Every response is captured and surfaced in one place, with a suggested reply already drafted — one click to send, nothing slips through.",
    chips: ["every reply captured", "responses pre-drafted", "one click to send"],
    icon: RepliesIcon,
  },
  {
    label: "CRM",
    title: "Clean CRM handoff",
    line: "Qualified conversations flow straight into your CRM — no copy-paste, no lost context. Vantera fills the pipeline; your CRM keeps it.",
    chips: ["HubSpot", "Pipedrive", "syncs automatically"],
    icon: CrmSyncIcon,
  },
];

/** LinkedIn brand glyph — lucide dropped brand icons, so we inline it. */
function LinkedinMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z" />
    </svg>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[var(--hairline)] bg-[var(--tint)] px-2.5 py-1 text-[12px] font-medium text-[var(--ink-3)]">
      {children}
    </span>
  );
}

/** Shared icon well — rounded blue-tint square with a blue glyph and a soft inner highlight. */
function IconWell({ icon: Icon }: { icon: ProductIcon }) {
  return (
    <span className="grid size-11 place-items-center rounded-xl bg-[var(--cyan-tint)] text-[var(--cyan-strong)] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] ring-1 ring-inset ring-[rgba(24,119,242,0.2)] transition-transform duration-300 group-hover:scale-105">
      <Icon className="size-5" />
    </span>
  );
}

function FeatureCard({ f, wide = false }: { f: Feature; wide?: boolean }) {
  // The wide close spans both columns and lays out horizontally on ≥sm so a single
  // full-width tile still reads dense — pitch on the left, chips gathered on the right.
  if (wide) {
    return (
      <RevealItem
        className={cn(CARD_INTERACTIVE, "group flex flex-col p-7 sm:col-span-2 sm:flex-row sm:items-center sm:gap-8")}
      >
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-3">
            <IconWell icon={f.icon} />
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-4)]">
              {f.label}
            </span>
          </div>
          <h3 className="mt-6 text-[18px] font-semibold leading-snug tracking-[-0.015em] text-foreground">
            {f.title}
          </h3>
          <p className="mt-2.5 max-w-md text-[14.5px] leading-relaxed text-[var(--ink-3)]">{f.line}</p>
        </div>

        <div className="mt-6 flex flex-wrap gap-1.5 sm:mt-0 sm:max-w-[280px] sm:flex-none sm:justify-end">
          {f.chips.map((c) => (
            <Chip key={c}>{c}</Chip>
          ))}
        </div>
      </RevealItem>
    );
  }

  return (
    <RevealItem className={cn(CARD_INTERACTIVE, "group flex flex-col p-7")}>
      <div className="flex items-center justify-between">
        <IconWell icon={f.icon} />
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-4)]">
          {f.label}
        </span>
      </div>

      <h3 className="mt-6 text-[18px] font-semibold leading-snug tracking-[-0.015em] text-foreground">
        {f.title}
      </h3>
      <p className="mt-2.5 text-[14.5px] leading-relaxed text-[var(--ink-3)]">{f.line}</p>

      {/* mt-auto floats the chip row to a shared baseline so cards in a row align */}
      <div className="mt-auto flex flex-wrap gap-1.5 pt-6">
        {f.chips.map((c) => (
          <Chip key={c}>{c}</Chip>
        ))}
      </div>
    </RevealItem>
  );
}

/** The Vantera-only card — safe pacing that keeps a user's account off LinkedIn's radar. */
function SafetyCard() {
  const chips = ["human-like limits", "smart timing", "multi-sender distribution"];
  return (
    <RevealItem
      className={cn(
        CARD_INTERACTIVE,
        "group relative flex flex-col overflow-hidden p-7 sm:col-span-2",
        "border-[var(--cyan-line)]",
        "hover:shadow-[0_1px_2px_rgba(12,16,26,0.04),0_12px_28px_-14px_rgba(24,119,242,0.16)]",
      )}
    >
      {/* signature blue wash, top-right — a single restrained lift marking the one accent card */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-0"
        style={{
          background:
            "radial-gradient(46% 85% at 100% 0%, rgba(24,119,242,0.07) 0%, transparent 60%)",
        }}
      />

      <div className="relative flex items-start gap-5 lg:gap-6">
        {/* left — the pitch */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-[var(--fb-tint)] text-[var(--fb)] shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] ring-1 ring-inset ring-[rgba(24,119,242,0.22)] transition-transform duration-300 group-hover:scale-105">
              <SafetyIcon className="size-5" />
            </span>
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-4)]">
              Safety
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--fb)] px-2.5 py-1 text-[11px] font-semibold text-white shadow-[0_4px_12px_-4px_rgba(24,119,242,0.35)]">
              <LinkedinMark className="size-3" />
              Vantera only
            </span>
          </div>

          <h3 className="mt-6 text-[20px] font-semibold leading-snug tracking-[-0.02em] text-foreground sm:text-[22px]">
            LinkedIn-safe, anti-ban pacing
          </h3>
          <p className="mt-2.5 max-w-md text-[14.5px] leading-relaxed text-[var(--ink-3)]">
            Volume that would flag any other tool is spread across human-like limits, realistic
            timing, and multiple senders — so you scale outreach without ever putting your account
            at risk. Built in, never a setting you can push past.
          </p>

          <div className="mt-6 flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <span
                key={c}
                className="inline-flex items-center rounded-full border border-[var(--cyan-line)] bg-[var(--cyan-tint)] px-2.5 py-1 text-[12px] font-medium text-[var(--cyan-strong)]"
              >
                {c}
              </span>
            ))}
          </div>

          <Link
            href="/safety"
            className="mt-5 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-[var(--cyan-strong)] transition-colors hover:text-foreground"
          >
            How your account is protected
            <ArrowRight className="size-3.5" />
          </Link>
        </div>

        {/* right — a small pacing mockup in the hero's light-card recipe (lg only) */}
        <div className="hidden w-[248px] flex-none lg:block">
          <PacingMock />
        </div>
      </div>
    </RevealItem>
  );
}

/** The second Vantera-only card — the learning loop: starts proven, keeps winners, gets sharper. */
function LearningCard() {
  const chips = ["starts from proven plays", "keeps winners, drops losers", "rolls back anything that hurts"];
  return (
    <RevealItem
      className={cn(
        CARD_INTERACTIVE,
        "group relative flex flex-col overflow-hidden p-7 sm:col-span-2",
        "border-[var(--cyan-line)]",
        "hover:shadow-[0_1px_2px_rgba(12,16,26,0.04),0_12px_28px_-14px_rgba(24,119,242,0.16)]",
      )}
    >
      {/* signature blue wash, top-right — mirrors the Safety card so the pair reads as the differentiators */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-0"
        style={{
          background:
            "radial-gradient(46% 85% at 100% 0%, rgba(24,119,242,0.07) 0%, transparent 60%)",
        }}
      />

      <div className="relative flex items-start gap-5 lg:gap-6">
        {/* left — the pitch */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-[var(--fb-tint)] text-[var(--fb)] shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] ring-1 ring-inset ring-[rgba(24,119,242,0.22)] transition-transform duration-300 group-hover:scale-105">
              <LearnIcon className="size-5" />
            </span>
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-4)]">
              Learning
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--fb)] px-2.5 py-1 text-[11px] font-semibold text-white shadow-[0_4px_12px_-4px_rgba(24,119,242,0.35)]">
              <LinkedinMark className="size-3" />
              Vantera only
            </span>
          </div>

          <h3 className="mt-6 text-[20px] font-semibold leading-snug tracking-[-0.02em] text-foreground sm:text-[22px]">
            It learns what works — and gets sharper every week
          </h3>
          <p className="mt-2.5 max-w-md text-[14.5px] leading-relaxed text-[var(--ink-3)]">
            Every other tool is frozen the day you configure it. Vera starts from proven plays,
            tests careful improvements on real conversations, keeps what wins, and drops what
            doesn&apos;t — so your outreach compounds instead of going stale.
          </p>

          <div className="mt-6 flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <span
                key={c}
                className="inline-flex items-center rounded-full border border-[var(--cyan-line)] bg-[var(--cyan-tint)] px-2.5 py-1 text-[12px] font-medium text-[var(--cyan-strong)]"
              >
                {c}
              </span>
            ))}
          </div>

          <Link
            href="/how-it-learns"
            className="mt-5 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-[var(--cyan-strong)] transition-colors hover:text-foreground"
          >
            See how the learning works
            <ArrowRight className="size-3.5" />
          </Link>
        </div>

        {/* right — a "what's working" mockup in the hero's light-card recipe (lg only) */}
        <div className="hidden w-[248px] flex-none lg:block">
          <LearningMock />
        </div>
      </div>
    </RevealItem>
  );
}

/** A "what's working" instrument — plays being kept, tested, and dropped, in the
 *  hero-calendar's white-card language. Shows the loop deciding, not just claiming it. */
function LearningMock() {
  const rows = [
    { label: "Peer-reference opener", state: "Kept", cls: "bg-[rgba(24,119,242,0.1)] text-[#1461d1]" },
    { label: "Problem-first note", state: "Testing", cls: "bg-[var(--tint)] text-[var(--ink-3)]" },
    { label: "Generic intro", state: "Dropped", cls: "bg-[var(--tint)] text-[var(--ink-4)] line-through" },
  ];
  return (
    <div
      className="overflow-hidden rounded-[14px] border border-[#E6EAEE] bg-white"
      style={{ boxShadow: INSET_CARD_SHADOW }}
    >
      <div className="flex items-center justify-between border-b border-[#EFF2F5] px-3.5 pb-2.5 pt-3">
        <div>
          <span className="text-[12px] font-semibold tracking-[-0.01em] text-[#0C1620]">What&apos;s working</span>
          <div className="mt-0.5 text-[9.5px] font-medium text-[var(--ink-4)]">This week · openers</div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(24,119,242,0.1)] px-2 py-[3px] text-[10px] font-semibold text-[#1461d1]">
          <StatusDot size="sm" />
          Live test
        </span>
      </div>

      <div className="flex flex-col gap-1 px-2 py-2">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex items-center justify-between gap-2 rounded-[9px] px-1.5 py-1.5"
          >
            <span className="truncate text-[11px] font-medium text-[#0C1620]">{r.label}</span>
            <span
              className={cn(
                "inline-flex shrink-0 items-center rounded-full px-2 py-[2px] text-[9.5px] font-semibold",
                r.cls,
              )}
            >
              {r.state}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** A "safe send pace" instrument — a gridlined weekly bar chart with a real weekly-cap
 *  threshold line, y-axis ticks, a value label, and a legend, in the hero-calendar's
 *  white-card language. Proves the pacing headroom rather than gesturing at it. */
function PacingMock() {
  const [ref, inView] = useInViewOnce();
  const bars = [28, 42, 55, 63, 71, 78, 84];
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  return (
    <div
      ref={ref}
      className="overflow-hidden rounded-[14px] border border-[#E6EAEE] bg-white"
      style={{ boxShadow: INSET_CARD_SHADOW }}
    >
      <div className="flex items-center justify-between border-b border-[#EFF2F5] px-3.5 pb-2.5 pt-3">
        <div>
          <span className="text-[12px] font-semibold tracking-[-0.01em] text-[#0C1620]">Safe send pace</span>
          <div className="mt-0.5 text-[9.5px] font-medium text-[var(--ink-4)]">This week · invites sent</div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(24,119,242,0.1)] px-2 py-[3px] text-[10px] font-semibold tabular-nums text-[#1461d1]">
          <StatusDot size="sm" />
          84 / 100
        </span>
      </div>

      <div className="px-3.5 pb-3 pt-4">
        <BarChart
          values={bars}
          max={100}
          yTicks={[0, 50, 100]}
          labels={days}
          ceiling={{ at: 100, label: "100 / wk cap" }}
          valueLabel
          run={inView}
          height={84}
        />
        <LegendRow
          className="mt-3 border-t border-[#EFF2F5] pt-2.5"
          items={[
            { label: "invites sent", kind: "fill" },
            { label: "weekly cap", kind: "dashed" },
          ]}
        />
      </div>
    </div>
  );
}

export function FeaturesGrid() {
  return (
    <section id="features" className="relative border-t border-[var(--hairline)] py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <LandingHeading
          eyebrow="Capabilities"
          title="Built to run outbound end to end"
          subtitle="From finding the right buyer to a clean CRM handoff — every part of the motion, working as one system that keeps getting sharper, with you in control."
        />

        <Reveal className="mt-14 grid gap-5 sm:grid-cols-2">
          {/* PROSPECTING + OUTREACH */}
          <FeatureCard f={FEATURES[0]} />
          <FeatureCard f={FEATURES[1]} />

          {/* SAFETY — differentiator #1, full-width */}
          <SafetyCard />

          {/* CONTROL + REPLIES */}
          <FeatureCard f={FEATURES[2]} />
          <FeatureCard f={FEATURES[3]} />

          {/* LEARNING — differentiator #2, full-width, mirrors the Safety card */}
          <LearningCard />

          {/* CRM — full-width close so the grid ends balanced (no dangling half-row) */}
          <FeatureCard f={FEATURES[4]} wide />
        </Reveal>
      </div>
    </section>
  );
}
