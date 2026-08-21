"use client";

import { LandingHeading } from "@/components/landing/heading";
import { Reveal, RevealItem, CARD_INTERACTIVE } from "@/components/landing/surface";
import { BarChart, Gauge, INSET_CARD_SHADOW, LegendRow, StatusDot, useInViewOnce } from "@/components/landing/viz";
import { UseCaseGlyph } from "./icons";
import type { FeatureItem, FeaturesContent } from "./types";
import { cn } from "@/lib/utils";

/**
 * Feature showcase — the product capabilities, in the homepage FeaturesGrid card system
 * (CARD_INTERACTIVE, blue icon well, mono label, chips). One item flagged `highlight`
 * becomes the wide accent "differentiator" card with a heavier blue wash and a live mock;
 * the remaining tiles pair two-up with a full-width close so the grid never dangles.
 */
export function FeatureShowcase({ content }: { content: FeaturesContent }) {
  const normal = content.items.filter((f) => !f.highlight);
  const highlight = content.items.find((f) => f.highlight);

  return (
    <section id="features" className="relative border-t border-[var(--hairline)] bg-[var(--tint)] py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <LandingHeading eyebrow={content.eyebrow} title={content.title} subtitle={content.subtitle} />

        <Reveal className="mt-14 grid gap-5 sm:grid-cols-2">
          {normal[0] && <FeatureCard f={normal[0]} />}
          {normal[1] && <FeatureCard f={normal[1]} />}
          {highlight && <HighlightCard f={highlight} mock={content.highlightMock} />}
          {normal[2] && <FeatureCard f={normal[2]} />}
          {normal[3] && <FeatureCard f={normal[3]} />}
          {normal[4] && <FeatureCard f={normal[4]} wide />}
          {normal[5] && <FeatureCard f={normal[5]} />}
        </Reveal>
      </div>
    </section>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[var(--hairline)] bg-[var(--tint)] px-2.5 py-1 text-[12px] font-medium text-[var(--ink-3)]">
      {children}
    </span>
  );
}

function IconWell({ f }: { f: FeatureItem }) {
  return (
    <span className="grid size-11 place-items-center rounded-xl bg-[var(--cyan-tint)] text-[var(--cyan-strong)] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] ring-1 ring-inset ring-[rgba(24,119,242,0.2)] transition-transform duration-300 group-hover:scale-105">
      <UseCaseGlyph name={f.icon} className="size-5" />
    </span>
  );
}

function FeatureCard({ f, wide = false }: { f: FeatureItem; wide?: boolean }) {
  if (wide) {
    return (
      <RevealItem
        className={cn(CARD_INTERACTIVE, "group flex flex-col p-7 sm:col-span-2 sm:flex-row sm:items-center sm:gap-8")}
      >
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-3">
            <IconWell f={f} />
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-4)]">
              {f.label}
            </span>
          </div>
          <h3 className="mt-6 text-[18px] font-semibold leading-snug tracking-[-0.015em] text-foreground">{f.title}</h3>
          <p className="mt-2.5 max-w-md text-[14.5px] leading-relaxed text-[var(--ink-3)]">{f.body}</p>
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
        <IconWell f={f} />
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-4)]">
          {f.label}
        </span>
      </div>
      <h3 className="mt-6 text-[18px] font-semibold leading-snug tracking-[-0.015em] text-foreground">{f.title}</h3>
      <p className="mt-2.5 text-[14.5px] leading-relaxed text-[var(--ink-3)]">{f.body}</p>
      <div className="mt-auto flex flex-wrap gap-1.5 pt-6">
        {f.chips.map((c) => (
          <Chip key={c}>{c}</Chip>
        ))}
      </div>
    </RevealItem>
  );
}

/** The differentiator — heavier blue wash, "Vantera edge" badge, live pacing/senders mock. */
function HighlightCard({ f, mock }: { f: FeatureItem; mock?: "senders" | "pace" }) {
  return (
    <RevealItem
      className={cn(
        CARD_INTERACTIVE,
        "group relative flex flex-col overflow-hidden p-7 sm:col-span-2",
        "border-[var(--cyan-line)] hover:shadow-[0_1px_2px_rgba(12,16,26,0.04),0_12px_28px_-14px_rgba(24,119,242,0.16)]",
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-0"
        style={{ background: "radial-gradient(46% 85% at 100% 0%, rgba(24,119,242,0.07) 0%, transparent 60%)" }}
      />
      <div className="relative flex items-start gap-5 lg:gap-6">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-[var(--fb-tint)] text-[var(--fb)] shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] ring-1 ring-inset ring-[rgba(24,119,242,0.22)] transition-transform duration-300 group-hover:scale-105">
              <UseCaseGlyph name={f.icon} className="size-5" />
            </span>
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-4)]">
              {f.label}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--fb)] px-2.5 py-1 text-[11px] font-semibold text-white shadow-[0_4px_12px_-4px_rgba(24,119,242,0.35)]">
              Vantera edge
            </span>
          </div>
          <h3 className="mt-6 text-[20px] font-semibold leading-snug tracking-[-0.02em] text-foreground sm:text-[22px]">
            {f.title}
          </h3>
          <p className="mt-2.5 max-w-md text-[14.5px] leading-relaxed text-[var(--ink-3)]">{f.body}</p>
          <div className="mt-6 flex flex-wrap gap-1.5">
            {f.chips.map((c) => (
              <span
                key={c}
                className="inline-flex items-center rounded-full border border-[var(--cyan-line)] bg-[var(--cyan-tint)] px-2.5 py-1 text-[12px] font-medium text-[var(--cyan-strong)]"
              >
                {c}
              </span>
            ))}
          </div>
        </div>

        <div className="hidden w-[248px] flex-none lg:block">
          {mock === "pace" ? <PaceMock /> : <SenderDistributionMock />}
        </div>
      </div>
    </RevealItem>
  );
}

/** A "senders spread" instrument — three connected senders each working under their own
 *  safe daily cap, proving volume is distributed rather than piled onto one account. */
const SENDERS = [
  { name: "Sender A", pct: 68, val: "34 / 50" },
  { name: "Sender B", pct: 54, val: "27 / 50" },
  { name: "Sender C", pct: 46, val: "23 / 50" },
];

function SenderDistributionMock() {
  const [ref, inView] = useInViewOnce();
  return (
    <div
      ref={ref}
      className="overflow-hidden rounded-[14px] border border-[#E6EAEE] bg-white"
      style={{ boxShadow: INSET_CARD_SHADOW }}
    >
      <div className="flex items-center justify-between border-b border-[#EFF2F5] px-3.5 pb-2.5 pt-3">
        <span className="text-[12px] font-semibold tracking-[-0.01em] text-[#0C1620]">Volume, spread safely</span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(24,119,242,0.1)] px-2 py-[3px] text-[10px] font-semibold tabular-nums text-[#1461d1]">
          <StatusDot size="sm" pulse />
          3 senders
        </span>
      </div>
      <div className="flex flex-col gap-3 px-3.5 pb-3.5 pt-3">
        {SENDERS.map((s) => (
          <div key={s.name}>
            <div className="flex items-center justify-between text-[10.5px]">
              <span className="font-medium text-[#475569]">{s.name}</span>
              <span className="font-semibold tabular-nums text-[#64748B]">{s.val}</span>
            </div>
            <Gauge className="mt-1.5" pct={s.pct} ticks={[50]} threshold={{ pct: 100 }} run={inView} />
          </div>
        ))}
        <div className="mt-0.5 text-center text-[9.5px] font-medium text-[var(--ink-4)]">
          No account past its safe daily limit
        </div>
      </div>
    </div>
  );
}

/** Single-account pacing proof — a weekly bar chart that ramps up toward the hard
 *  ~100/wk ceiling, for solo personas where "multi-sender" would misrepresent one account. */
function PaceMock() {
  const [ref, inView] = useInViewOnce();
  const bars = [26, 40, 52, 61, 70, 77, 84];
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
