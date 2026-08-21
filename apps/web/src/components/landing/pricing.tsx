"use client";

import { Check, Sparkles, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { LandingHeading } from "./heading";
import { PrimaryCta, SecondaryCta } from "./cta";
import { Reveal, RevealItem, CARD_INTERACTIVE } from "./surface";
import { useCountUp, useInViewOnce } from "./viz";

/**
 * Landing pricing — kept in the exact shape `page.tsx` already passes: the real
 * `plans` array derived from the billing source of truth (`@vantera/billing`).
 * We take that array as an OPTIONAL prop and read Starter's real monthly price out
 * of it (`tier === "starter"`), so the number shown can never drift from Stripe.
 * When no billing data is supplied we fall back to a clearly-placeholder `$[X]/mo`
 * that is wired to be replaced — never a fabricated marketing price.
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

const STARTER_FEATURES = [
  "Agents prospecting 24/7",
  "500 prospects contacted / month",
  "Warm leads sourced automatically",
  "Unified inbox",
  "ICP lead scoring",
  "Approve-before-send",
  "CRM + MCP integrations",
  "Email & chat support",
];

const CUSTOM_FEATURES = [
  "Everything in Starter",
  "Custom agent + prospect volume",
  "More LinkedIn senders in parallel",
  "Dedicated customer success manager",
  "Deep CRM + workflow integrations",
  "Admin controls & team governance",
];

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

export function Pricing({ plans }: { plans?: LandingPlan[] }) {
  // Real Starter monthly price, straight from the billing-derived data. When it isn't
  // provided we render a clearly-placeholder token instead of inventing a number.
  const starter = plans?.find((p) => p.tier === "starter");
  const [priceRef, inView] = useInViewOnce();
  const priceCount = useCountUp(starter?.monthlyUsd ?? 0, inView);
  const starterPrice = starter ? `$${priceCount}` : "$[X]";

  return (
    <section id="pricing" className="relative border-t border-[var(--hairline)] bg-[var(--tint)] py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <LandingHeading
          eyebrow="Pricing"
          title="Simple, transparent pricing"
          subtitle="Start free. Pick a plan when you deploy your first agent. No contracts, no surprises — two plans, priced to your goals."
        />

        <Reveal className="mx-auto mt-14 grid max-w-4xl items-stretch gap-5 lg:grid-cols-2">
          {/* ── STARTER (highlighted) ─────────────────────────────────────── */}
          <RevealItem className="relative">
            {/* soft blue halo lifting the highlighted card — restrained, marks the one accent plan */}
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-x-4 -bottom-6 -top-4 -z-10 rounded-[2rem] blur-2xl"
              style={{
                background:
                  "radial-gradient(58% 70% at 50% 30%, rgba(24,119,242, 0.12), transparent 72%)",
              }}
            />
            <div
              className={cn(
                CARD_INTERACTIVE,
                "group relative flex h-full flex-col overflow-hidden p-8",
              )}
              style={{
                borderColor: "rgba(24,119,242, 0.5)",
                boxShadow:
                  "inset 0 1px 0 rgba(255,255,255,0.7), 0 1px 2px rgba(12,16,26,0.04), 0 10px 26px -14px rgba(24,119,242,0.16)",
              }}
            >
              {/* thin blue accent bar along the top edge — the calendar's accent-bar motif */}
              <span
                aria-hidden
                className="absolute inset-x-0 top-0 h-[3px]"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, var(--cyan) 22%, var(--cyan) 78%, transparent)",
                }}
              />

              <div className="flex items-center justify-between">
                <PlanBadge icon={Sparkles} label="Starter" />
                <span className="rounded-full bg-[var(--cyan-strong)] px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-white shadow-[0_4px_14px_-4px_rgba(24,119,242,0.6)]">
                  Most popular
                </span>
              </div>

              <h3 className="mt-6 text-[22px] font-semibold tracking-[-0.02em] text-foreground">
                Your first AI sales rep
              </h3>
              <p className="mt-2 min-h-[42px] text-[14px] leading-relaxed text-[var(--ink-3)]">
                For founders and operators running their own outbound.
              </p>

              <div ref={priceRef} className="mt-6 flex items-end gap-1.5">
                <span className="text-[3.25rem] font-semibold leading-none tabular-nums tracking-[-0.03em] text-foreground">
                  {starterPrice}
                </span>
                <span className="mb-2 text-[15px] font-medium text-[var(--ink-4)]">/mo</span>
              </div>
              <p className="mt-2 text-[12.5px] text-[var(--ink-4)]">
                Billed monthly · free 7-day trial · cancel anytime
              </p>

              <div className="my-7 h-px bg-[var(--hairline)]" />

              <ul className="flex flex-1 flex-col gap-3.5">
                {STARTER_FEATURES.map((f) => (
                  <FeatureItem key={f}>{f}</FeatureItem>
                ))}
              </ul>

              <PrimaryCta
                href="/signup"
                size="lg"
                className="mt-8 w-full !bg-[var(--fb)] !text-white !shadow-[0_1px_2px_rgba(24,119,242,0.2)] hover:!shadow-[0_8px_20px_-8px_rgba(24,119,242,0.4)]"
              >
                Start free
              </PrimaryCta>
            </div>
          </RevealItem>

          {/* ── CUSTOM ────────────────────────────────────────────────────── */}
          <RevealItem className={cn(CARD_INTERACTIVE, "group flex h-full flex-col p-8")}>
            <div className="flex items-center justify-between">
              <PlanBadge icon={Building2} label="Custom" />
              <span className="rounded-full border border-[var(--hairline)] bg-white px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-3)] shadow-[var(--shadow-sm)]">
                Teams & agencies
              </span>
            </div>

            <h3 className="mt-6 text-[22px] font-semibold tracking-[-0.02em] text-foreground">
              Talk to us
            </h3>
            <p className="mt-2 min-h-[42px] text-[14px] leading-relaxed text-[var(--ink-3)]">
              For teams (5+) and agencies scaling multichannel LinkedIn outreach.
            </p>

            <div className="mt-6 flex items-end gap-1.5">
              <span className="text-[3.25rem] font-semibold leading-none tracking-[-0.03em] text-foreground">
                Custom
              </span>
            </div>
            <p className="mt-2 text-[12.5px] text-[var(--ink-4)]">
              Volume-based pricing · built around your team & goals
            </p>

            <div className="my-7 h-px bg-[var(--hairline)]" />

            <ul className="flex flex-1 flex-col gap-3.5">
              {CUSTOM_FEATURES.map((f) => (
                <FeatureItem key={f}>{f}</FeatureItem>
              ))}
            </ul>

            <SecondaryCta href="/demo" size="lg" className="mt-8 w-full">
              Book a demo
            </SecondaryCta>
          </RevealItem>
        </Reveal>

        <p className="mt-8 text-center text-[13px] text-[var(--ink-4)]">
          Not sure which fits?{" "}
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
