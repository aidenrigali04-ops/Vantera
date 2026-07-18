"use client";

import { Check, Sparkles, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { LandingHeading } from "./heading";
import { PrimaryCta, SecondaryCta } from "./cta";
import { Reveal, RevealItem, CARD_INTERACTIVE } from "./surface";

/**
 * Landing pricing — renders the REAL two-plan structure (All Access + the enterprise
 * lane) straight from the billing source of truth (`@vantera/billing` PLAN_DISPLAY /
 * PLAN_DISPLAY_ORDER, passed in by `page.tsx` as the `plans` prop): names, prices,
 * taglines, and feature bullets all come from that data so this teaser can never drift
 * from Stripe or from /pricing. When no billing data is supplied we render a
 * clearly-placeholder `$[X]/mo` — never a fabricated marketing price. Enterprise and the
 * annual toggle live on /pricing; this section links there.
 */
export interface LandingPlan {
  tier: string;
  name: string;
  tagline: string;
  monthlyUsd: number;
  annualMonthlyUsd: number;
  annualYearlyUsd: number;
  highlight: boolean;
  features: string[];
}

// Two-plan reality: only `growth` (All Access) renders self-serve; Sparkles is the fallback.
const TIER_ICONS: Record<string, typeof Sparkles> = {
  growth: Zap,
};

/** A blue-accented plan chip that mirrors the hero-calendar light-card recipe. */
function PlanBadge({
  icon: Icon,
  label,
}: {
  icon: typeof Sparkles;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[var(--hairline)] bg-[#fbfbfc] px-3 py-1 text-[11.5px] font-semibold tracking-[-0.01em] text-[var(--ink-3)] shadow-[var(--shadow-sm)]">
      <span className="grid size-[18px] place-items-center rounded-[6px] bg-[var(--cyan-tint)] ring-1 ring-inset ring-[rgba(24,119,242,0.22)]">
        <Icon className="size-3 text-[var(--cyan-strong)]" strokeWidth={2.4} />
      </span>
      {label}
    </span>
  );
}

/** Checkmark bullet — blue tick in a soft tinted chip, matching the hero accent language. */
function FeatureItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-[14px] leading-snug text-[var(--ink-2)]">
      <span className="mt-px grid size-[18px] shrink-0 place-items-center rounded-full bg-[var(--cyan-tint)] ring-1 ring-inset ring-[rgba(24,119,242,0.22)]">
        <Check className="size-3 text-[var(--cyan-strong)]" strokeWidth={3} />
      </span>
      {children}
    </li>
  );
}

function PlanCard({ plan }: { plan: LandingPlan }) {
  // Real monthly price straight from billing-derived data, rendered static (no count-up:
  // the animation initialised at 0, so SSR / no-JS / pre-scroll paints showed "$0" — a
  // false free-price flash). Placeholder token when billing data is somehow absent.
  const price = plan.monthlyUsd ? `$${plan.monthlyUsd}` : "$[X]";
  const Icon = TIER_ICONS[plan.tier] ?? Sparkles;

  const card = (
    <div
      className={cn(CARD_INTERACTIVE, "group relative flex h-full flex-col overflow-hidden p-7")}
      style={
        plan.highlight
          ? {
              borderColor: "rgba(24,119,242, 0.5)",
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.7), 0 1px 2px rgba(12,16,26,0.04), 0 10px 26px -14px rgba(24,119,242,0.16)",
            }
          : undefined
      }
    >
      {/* thin blue accent bar along the top edge — the calendar's accent-bar motif */}
      {plan.highlight && (
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-[3px]"
          style={{
            background:
              "linear-gradient(90deg, transparent, var(--cyan) 22%, var(--cyan) 78%, transparent)",
          }}
        />
      )}

      <div className="flex items-center justify-between">
        <PlanBadge icon={Icon} label={plan.name} />
        {plan.highlight && (
          <span className="rounded-full bg-[var(--cyan-strong)] px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-white shadow-[0_4px_14px_-4px_rgba(24,119,242,0.6)]">
            Most popular
          </span>
        )}
      </div>

      <div className="mt-6 flex items-end gap-1.5">
        <span className="text-[2.9rem] font-semibold leading-none tabular-nums tracking-[-0.03em] text-foreground">
          {price}
        </span>
        <span className="mb-1.5 text-[15px] font-medium text-[var(--ink-4)]">/mo</span>
      </div>
      <p className="mt-2 min-h-[60px] text-[13.5px] leading-relaxed text-[var(--ink-3)]">
        {plan.tagline}
      </p>

      <div className="my-6 h-px bg-[var(--hairline)]" />

      <ul className="flex flex-1 flex-col gap-3">
        {plan.features.map((f) => (
          <FeatureItem key={f}>{f}</FeatureItem>
        ))}
      </ul>

      {plan.highlight ? (
        <PrimaryCta
          href="/signup"
          size="lg"
          className="mt-7 w-full !bg-[var(--fb)] !text-white !shadow-[0_1px_2px_rgba(24,119,242,0.2)] hover:!shadow-[0_8px_20px_-8px_rgba(24,119,242,0.4)]"
        >
          Start free
        </PrimaryCta>
      ) : (
        <SecondaryCta href="/signup" size="lg" className="mt-7 w-full">
          Start free
        </SecondaryCta>
      )}
    </div>
  );

  if (!plan.highlight) return <RevealItem className="relative">{card}</RevealItem>;

  return (
    <RevealItem className="relative">
      {/* soft blue halo lifting the highlighted card — restrained, marks the one accent plan */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-4 -bottom-6 -top-4 -z-10 rounded-[2rem] blur-2xl"
        style={{
          background: "radial-gradient(58% 70% at 50% 30%, rgba(24,119,242, 0.12), transparent 72%)",
        }}
      />
      {card}
    </RevealItem>
  );
}

export function Pricing({ plans }: { plans?: LandingPlan[] }) {
  const ordered = plans ?? [];

  return (
    <section id="pricing" className="relative border-t border-[var(--hairline)] bg-[var(--tint)] py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <LandingHeading
          eyebrow="Pricing"
          title="Start free. Pay when it's paying off."
          subtitle="Start free. One plan with everything in it, and an enterprise lane when you outgrow it. No contracts, no surprises."
        />

        <Reveal className="mx-auto mt-14 grid max-w-4xl items-stretch gap-5 lg:grid-cols-2">
          {ordered.map((p) => (
            <PlanCard key={p.tier} plan={p} />
          ))}
          {/* L5: the second plan is a conversation, not a checkout. */}
          <RevealItem className="relative h-full">
            <div className="flex h-full flex-col gap-5 rounded-2xl border border-[var(--hairline)] bg-white p-6 shadow-[var(--shadow-sm)]">
              <div>
                <h3 className="text-[1.15rem] font-semibold tracking-[-0.01em] text-foreground">Enterprise</h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-[var(--ink-3)]">
                  Custom volume, senders, and seats — the same system, built around your team.
                </p>
              </div>
              <p className="text-[2rem] font-semibold tracking-[-0.02em] text-foreground">Let&apos;s talk</p>
              <a
                href="/demo"
                className="mt-auto inline-flex items-center justify-center rounded-[10px] border border-[var(--hairline)] px-5 py-2.5 text-[14px] font-semibold transition-colors hover:bg-[var(--cyan-tint)]/50"
              >
                Book a meeting
              </a>
            </div>
          </RevealItem>
        </Reveal>

        <p className="mt-8 text-center text-[13px] text-[var(--ink-4)]">
          Annual billing saves two months —{" "}
          <a
            href="/pricing"
            className="font-medium text-[var(--cyan-strong)] underline-offset-4 hover:underline"
          >
            see full pricing
          </a>
          . Need enterprise volume?{" "}
          <a
            href="/demo"
            className="font-medium text-[var(--cyan-strong)] underline-offset-4 hover:underline"
          >
            Book a demo
          </a>{" "}
          and we&rsquo;ll map it to your goals.
        </p>
      </div>
    </section>
  );
}
