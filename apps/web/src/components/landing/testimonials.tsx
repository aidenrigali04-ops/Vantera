"use client";

import { Star } from "lucide-react";
import { LandingHeading } from "./heading";
import { Reveal, RevealItem, CARD_INTERACTIVE } from "./surface";
import { BarChart, DeltaChip, INSET_CARD_SHADOW, INSET_RIM, useCountUp, useInViewOnce } from "./viz";
import { cn } from "@/lib/utils";

/**
 * Testimonials — a balanced two-column wall of operator quotes in the hero's light
 * Poppins/blue system (CARD_INTERACTIVE, Reveal/RevealItem stagger, --fb accent chips).
 * Equal-height grid rows let every card's attribution sit on a shared baseline. Quotes
 * are PLACEHOLDER but specific to LinkedIn outbound, booked meetings, and safe pacing —
 * structured as data so real, attributed quotes drop straight in. The lead card carries
 * a small booked-meetings mockup built from the same light-card recipe as HeroCalendar.
 */
type Testimonial = {
  quote: string;
  name: string;
  role: string;
  company: string;
  initials: string;
  /** Optional headline stat — renders the lead card's mini mockup. */
  stat?: { value: string; label: string };
};

const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "We went from chasing a scattershot LinkedIn list to a calendar that fills itself. The agent only touches people who actually fit our ICP, so every booked call is a real conversation — not a favor someone did us.",
    name: "Marcus Deane",
    role: "Head of Growth",
    company: "Northlane",
    initials: "MD",
    stat: { value: "23", label: "meetings booked / month" },
  },
  {
    quote:
      "The pacing is the whole thing. My personal account has run outbound for four months and never hit a single restriction — it sends like I would if I had eight hours a day to do it by hand.",
    name: "Priya Natarajan",
    role: "Founder",
    company: "Cadence Labs",
    initials: "PN",
  },
  {
    quote:
      "Every draft reads like I wrote it. It pulls a real detail from their activity instead of a merge tag, so reply rates roughly tripled versus the templates we used to blast.",
    name: "Elliot Voss",
    role: "VP Sales",
    company: "Harborline",
    initials: "EV",
  },
  {
    quote:
      "I approve sends over morning coffee and closed deals land in HubSpot on their own. Two SDRs' worth of pipeline, and I never had to open another inbox to get it.",
    name: "Sofia Marchetti",
    role: "RevOps Lead",
    company: "Meridian",
    initials: "SM",
  },
];

/** Distinct-but-calm chip tints, cycled per card — reads as identity, never a rainbow. */
const CHIP_TINTS = [
  { bg: "var(--fb-tint)", fg: "var(--fb)" },
  { bg: "var(--cyan-tint)", fg: "var(--cyan-strong)" },
  { bg: "rgba(12,16,26,0.05)", fg: "var(--ink-2)" },
  { bg: "var(--fb-tint)", fg: "var(--fb)" },
] as const;

function Stars() {
  return (
    <div className="flex items-center gap-0.5" aria-label="5 out of 5 stars">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className="size-[15px] fill-[var(--cyan)] text-[var(--cyan)]" strokeWidth={0} />
      ))}
    </div>
  );
}

function Avatar({ t, index }: { t: Testimonial; index: number }) {
  const tint = CHIP_TINTS[index % CHIP_TINTS.length];
  return (
    <figcaption className="mt-6 flex items-center gap-3 border-t border-[var(--hairline)] pt-6">
      <span
        className="grid size-11 flex-none place-items-center rounded-full text-[13px] font-semibold tracking-[-0.01em] shadow-[var(--shadow-sm)] ring-1 ring-[var(--hairline)] transition-shadow duration-300 group-hover:ring-[var(--cyan-line)]"
        style={{ backgroundColor: tint.bg, color: tint.fg }}
        aria-hidden
      >
        {t.initials}
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-[14.5px] font-semibold tracking-[-0.01em] text-foreground">
          {t.name}
        </span>
        <span className="block truncate text-[13px] text-[var(--ink-3)]">
          {t.role} · {t.company}
        </span>
      </span>
    </figcaption>
  );
}

/** A booked-meetings trend panel for the lead card — an instrumented mini-chart with a
 *  real axis (y-ticks + gridlines + baseline), a labelled week scale, a value label and
 *  a count-up, matching the hero-calendar's depth. The `value` number is the honest
 *  claim; the chart is decorative (aria-hidden inside BarChart) and trends up to it. */
function StatMock({ value, label }: { value: string; label: string }) {
  const [ref, inView] = useInViewOnce();
  const target = parseInt(value, 10);
  const isNum = Number.isFinite(target);
  const counted = useCountUp(isNum ? target : 0, inView);
  const peak = isNum ? target : 23;
  return (
    <div
      ref={ref}
      className="mt-6 rounded-2xl border border-[var(--hairline)] bg-[var(--tint)] p-4"
      style={{ boxShadow: INSET_CARD_SHADOW }}
    >
      <div className="flex items-start gap-3.5">
        <span
          className="grid size-12 flex-none place-items-center rounded-[13px] bg-white text-[20px] font-semibold tabular-nums text-[var(--fb)] ring-1 ring-[var(--hairline)]"
          style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 2px rgba(16,24,32,0.06)" }}
        >
          {isNum ? counted : value}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <span className="text-[12.5px] font-medium leading-snug tracking-[-0.005em] text-[var(--ink-3)]">
              {label}
            </span>
            <DeltaChip value="+38%" dir="up" className="mt-0.5 shrink-0" />
          </div>
          <div className="mt-1 text-[10.5px] text-[var(--ink-4)]">last 6 weeks</div>
        </div>
      </div>

      <div
        className="mt-4 rounded-xl bg-white px-3 pb-3 pt-5 ring-1 ring-inset ring-[var(--hairline)]"
        style={{ boxShadow: INSET_RIM }}
      >
        <BarChart
          values={[9, 13, 12, 17, 20, peak]}
          max={24}
          yTicks={[0, 12, 24]}
          labels={["W1", "W2", "W3", "W4", "W5", "W6"]}
          mutedIndices={[0, 1, 2, 3]}
          valueLabel
          run={inView}
          height={60}
        />
      </div>
    </div>
  );
}

function TestimonialCard({ t, index }: { t: Testimonial; index: number }) {
  return (
    <RevealItem
      className={cn(
        CARD_INTERACTIVE,
        // grid cell — h-full lets equal-height rows push each attribution to a shared baseline
        "group flex h-full flex-col p-6 sm:p-7",
      )}
    >
      <div className="flex items-center justify-between">
        <Stars />
        <svg
          viewBox="0 0 24 24"
          className="size-6 flex-none text-[var(--cyan-line)] opacity-70 transition-all duration-300 group-hover:text-[var(--cyan-strong)] group-hover:opacity-100"
          fill="currentColor"
          aria-hidden
        >
          <path d="M9.5 6C6.5 7.4 5 9.8 5 13.2V18h5.2v-5.2H7.9c0-2.1 1-3.4 2.9-4.1L9.5 6zm9 0c-3 1.4-4.5 3.8-4.5 7.2V18h5.2v-5.2h-2.3c0-2.1 1-3.4 2.9-4.1L18.5 6z" />
        </svg>
      </div>

      <blockquote className="mt-5 text-pretty text-[16px] font-medium leading-relaxed tracking-[-0.005em] text-foreground sm:text-[16.5px]">
        {t.quote}
      </blockquote>

      {/* quote grows to fill, so the stat + attribution sit on a consistent baseline across cards */}
      <div className="mt-auto">
        {t.stat && <StatMock value={t.stat.value} label={t.stat.label} />}
        <Avatar t={t} index={index} />
      </div>
    </RevealItem>
  );
}

export function Testimonials() {
  return (
    <section className="relative border-t border-[var(--hairline)] bg-[var(--tint)] py-24 sm:py-28">
      <div className="relative mx-auto max-w-6xl px-6 lg:px-8">
        {/* NOTE (dev): quotes below are placeholders — swap in real, attributed stories as they land. */}
        <LandingHeading
          eyebrow="Loved by operators"
          title="Teams closing more, sooner"
          subtitle="Higher-quality meetings, a voice that sounds like them, and an account that stays safe. Here's what that looks like in practice."
        />

        <Reveal className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6">
          {TESTIMONIALS.map((t, i) => (
            <TestimonialCard key={t.name} t={t} index={i} />
          ))}
        </Reveal>
      </div>
    </section>
  );
}
