import type { ReactNode } from "react";
import { ArrowDown, Check, Gauge, Link2, Lock, Paperclip, Radar, ShieldCheck, Target, WandSparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { VanteraLogo } from "@/components/landing/vantera-logo";
import { LiveMeta, ScreenCard, ScreenNote } from "@/components/landing/feature-row";
import { CEILING_FACT } from "@/components/landing/claims";
import type { FeatureVisuals } from "../types";
import { POOL, type Part, type Prospect } from "./autopilot-outreach.data";
import { OutreachWindow } from "./autopilot-outreach.window";

/**
 * The pictures on /features/autopilot-outreach, drawn the way the landing draws the
 * product: white screens, hairline borders, soft blue for what's live. The window
 * (autopilot-outreach.window.tsx) runs on the client; everything here is static and
 * server-rendered. Sample data throughout — the window carries a SAMPLE chip.
 *
 * This module stays a server module on purpose: the page reads `visuals.Window` etc.
 * on the server, which it can't do across a "use client" boundary.
 */

const ROW = "flex items-center justify-between gap-3 rounded-lg border border-[var(--hairline)] bg-white px-3 py-2";

const byName = (name: string) => POOL.find((p) => p.name === name) as Prospect;
const AISHA = byName("Aisha Okafor");
const ELENA = byName("Elena Petrova");

function Avatar({ p }: { p: Prospect }) {
  return (
    <span
      className="grid size-6 shrink-0 place-items-center rounded-full text-[9.5px] font-semibold text-white"
      style={{ backgroundColor: p.tint }}
    >
      {p.initials}
    </span>
  );
}

function Opener({ parts }: { parts: Part[] }) {
  return (
    <>
      {parts.map((p, i) =>
        p.mark ? (
          <mark
            key={i}
            className="rounded-[3px] bg-[var(--cyan-tint)] px-0.5 text-foreground underline decoration-[var(--fb)]/50 decoration-1 underline-offset-2"
          >
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}

function Chip({ children, tone = "blue" }: { children: ReactNode; tone?: "blue" | "grey" }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.65rem] font-semibold",
        tone === "blue"
          ? "bg-[var(--cyan-tint)] text-[var(--cyan-strong)]"
          : "border border-[rgba(12,16,26,0.08)] bg-white text-foreground",
      )}
    >
      {children}
    </span>
  );
}

/* ---------- Benefit screens ---------- */

/** 01 — Written from real activity: the post, then the opener it became. */
function SignalScreen() {
  return (
    <ScreenCard title="Written from a signal" meta={<LiveMeta>Live</LiveMeta>}>
      <div className="rounded-lg border border-[var(--hairline)] bg-[color-mix(in_oklab,var(--tint)_45%,white)] px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Avatar p={ELENA} />
          <span className="truncate text-[0.7rem] font-semibold text-foreground">{ELENA.name}</span>
          <span className="shrink-0 text-[0.65rem] text-[var(--ink-4)]">posted · 2d</span>
        </div>
        <p className="mt-1.5 text-[0.72rem] leading-snug text-[var(--ink-2)]">
          &ldquo;
          <mark className="rounded-[3px] bg-[var(--cyan-tint)] px-0.5 text-foreground">Pipeline coverage</mark> is
          the number I watch most, and ours slipped this quarter.&rdquo;
        </p>
      </div>
      <div className="flex justify-center py-1.5 text-[var(--ink-4)]">
        <ArrowDown className="size-3.5" />
      </div>
      <div className="rounded-lg border border-[rgba(24,119,242,0.25)] bg-white px-3 py-2.5 text-[0.75rem] leading-relaxed text-[var(--ink-2)] shadow-[0_0_0_3px_rgba(24,119,242,0.06)]">
        <Opener parts={ELENA.opener} />
      </div>
    </ScreenCard>
  );
}

/** 02 — Your goal, your content: the context every message is written with. */
function ContextScreen() {
  return (
    <ScreenCard title="Message context" meta={<span className="text-[0.68rem] text-[var(--ink-3)]">Set once</span>}>
      <div className="space-y-2">
        <div className={ROW}>
          <span className="flex items-center gap-2 text-xs font-medium text-foreground">
            <Target className="size-3.5 text-[var(--fb)]" />
            Call to action
          </span>
          <Chip>Book a 20-min call</Chip>
        </div>
        <div className="rounded-lg border border-[var(--hairline)] bg-white px-3 py-2.5">
          <span className="text-xs font-medium text-foreground">Your content</span>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Chip tone="grey">
              <Paperclip className="size-3 text-[var(--ink-3)]" />
              case-study.pdf
            </Chip>
            <Chip tone="grey">
              <Link2 className="size-3 text-[var(--ink-3)]" />
              pricing page
            </Chip>
            <Chip tone="grey">
              <Link2 className="size-3 text-[var(--ink-3)]" />
              customer story
            </Chip>
          </div>
        </div>
      </div>
      <ScreenNote>Every message is written with these as context, in your own words.</ScreenNote>
    </ScreenCard>
  );
}

/* Gaps between today's sends, in minutes — uneven on purpose. */
const GAPS = [0, 7, 11, 24, 29, 41, 52, 58, 71, 83, 90];

/** 03 — Sent at a human pace: today, the week's ceiling, the uneven gaps. */
function PacingScreen() {
  return (
    <ScreenCard title="Pacing" meta={<LiveMeta>On autopilot</LiveMeta>}>
      <div className="space-y-2">
        <div className="rounded-lg border border-[var(--hairline)] bg-white px-3 py-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-foreground">Today</span>
            <span className="tabular-nums text-[var(--ink-3)]">31 / 50</span>
          </div>
          <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-[rgba(12,16,26,0.06)]">
            <span className="block h-full w-[62%] rounded-full bg-[var(--fb)]" />
          </span>
          <div className="relative mt-2.5 h-3">
            {GAPS.map((m) => (
              <span
                key={m}
                className="absolute top-0 h-3 w-[2px] rounded-full bg-[var(--fb)]/70"
                style={{ left: `${(m / 90) * 100}%` }}
              />
            ))}
          </div>
          <p className="mt-1.5 text-[0.62rem] text-[var(--ink-4)]">Randomized gaps between sends</p>
        </div>
        <div className={ROW}>
          <span className="flex items-center gap-2 text-xs font-medium text-foreground">
            <Lock className="size-3.5 text-[var(--ink-3)]" />
            Weekly ceiling
          </span>
          <span className="text-[0.68rem] tabular-nums text-[var(--ink-3)]">74 of {CEILING_FACT}</span>
        </div>
        <div className={ROW}>
          <span className="flex items-center gap-2 text-xs font-medium text-foreground">
            <WandSparkles className="size-3.5 text-[var(--fb)]" />
            Humanizer
          </span>
          <span className="text-[0.68rem] text-[var(--ink-3)]">1 line rewritten</span>
        </div>
      </div>
    </ScreenCard>
  );
}

/* ---------- Step pictures ---------- */

/** 1 — Pick up the signal. */
function SignalStep() {
  return (
    <div className="space-y-2">
      <div className={ROW}>
        <span className="flex min-w-0 items-center gap-2">
          <Avatar p={AISHA} />
          <span className="truncate text-xs font-medium text-foreground">{AISHA.name}</span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-[var(--cyan-tint)] px-1.5 py-0.5 text-[0.62rem] font-semibold text-[var(--cyan-strong)]">
          <span className="size-1.5 rounded-full bg-[var(--fb)]" />
          New signal
        </span>
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-[var(--hairline)] bg-white px-3 py-2 text-xs font-medium text-foreground">
        <Radar className="size-3.5 shrink-0 text-[var(--fb)]" />
        Raised a seed round · fit {AISHA.fit}
      </div>
    </div>
  );
}

/** 2 — Write the opener. */
function WriteStep() {
  return (
    <div className="rounded-lg border border-[var(--hairline)] bg-white px-3 py-2.5">
      <p className="text-[0.62rem] font-medium text-[var(--ink-4)]">Writing to {AISHA.name.split(" ")[0]}</p>
      <p className="mt-1 text-[0.72rem] leading-relaxed text-[var(--ink-2)]">
        Congrats on{" "}
        <mark className="rounded-[3px] bg-[var(--cyan-tint)] px-0.5 text-foreground">the seed round</mark>, Aisha.
        Outbound is usually the first
        <span className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[0.15em] rounded-full bg-[var(--fb)]" />
      </p>
    </div>
  );
}

/** 3 — Send it safely. */
function SendStep() {
  return (
    <div className="space-y-2">
      {[
        { icon: ShieldCheck, text: "Suppression checked" },
        { icon: Gauge, text: "Inside today's pacing" },
      ].map(({ icon: Icon, text }) => (
        <div key={text} className={ROW}>
          <span className="flex items-center gap-2 text-xs font-medium text-foreground">
            <Icon className="size-3.5 text-[var(--ink-3)]" />
            {text}
          </span>
          <span className="grid size-4 shrink-0 place-items-center rounded-full bg-[#e3f5ea] text-[#13824a]">
            <Check className="size-2.5" strokeWidth={3} />
          </span>
        </div>
      ))}
    </div>
  );
}

/* ---------- The closing band's screen ---------- */

/** The top of the queue, rising out of the closing band. */
function OutreachPeek() {
  const rows: { p: Prospect; kind: "Sent" | "Sending" | "Queued" }[] = [
    { p: POOL[0], kind: "Sent" },
    { p: AISHA, kind: "Sending" },
    { p: POOL[3], kind: "Queued" },
  ];
  return (
    <div className="rounded-t-xl border border-b-0 border-white/20 bg-white p-4 text-left shadow-[0_-12px_48px_-16px_rgba(4,24,72,0.55)] sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-[0.8rem] font-semibold text-foreground">
          <VanteraLogo className="size-4 text-[var(--fb)]" />
          Outreach
        </span>
        <span className="flex items-center gap-1.5 text-[0.7rem] font-medium text-[var(--ink-3)]">
          <span className="size-1.5 rounded-full bg-[#13a05a]" />
          On autopilot
        </span>
      </div>
      <div className="mt-3.5 space-y-2">
        {rows.map(({ p, kind }) => (
          <div key={p.name} className={ROW}>
            <span className="flex min-w-0 items-center gap-2">
              <Avatar p={p} />
              <span className="min-w-0">
                <span className="block truncate text-xs font-medium text-foreground">{p.name}</span>
              </span>
            </span>
            <span className="flex min-w-0 items-center gap-2">
              <span className="hidden truncate text-[0.65rem] text-[var(--ink-3)] sm:inline">{p.signal}</span>
              <span
                className={cn(
                  "shrink-0 rounded-md px-1.5 py-0.5 text-[0.62rem] font-semibold",
                  kind === "Sent"
                    ? "bg-[#e3f5ea] text-[#13824a]"
                    : kind === "Sending"
                      ? "bg-[var(--cyan-tint)] text-[var(--cyan-strong)]"
                      : "bg-[rgba(12,16,26,0.05)] text-[var(--ink-3)]",
                )}
              >
                {kind}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const visuals: FeatureVisuals = {
  Window: OutreachWindow,
  Peek: OutreachPeek,
  benefits: [SignalScreen, ContextScreen, PacingScreen],
  benefitIcons: [Radar, Target, Gauge],
  steps: [SignalStep, WriteStep, SendStep],
};
