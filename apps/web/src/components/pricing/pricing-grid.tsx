"use client";

import * as React from "react";
import { useState } from "react";
import { Check } from "lucide-react";
import { breakEvenCloses, type PlanTier } from "@vantera/billing";
import { cn } from "@/lib/utils";
import { Reveal, RevealItem, Eyebrow, PANEL_SURFACE } from "@/components/ui/panel";

export type Interval = "month" | "year";

export interface PlanCard {
  tier: PlanTier;
  name: string;
  tagline: string;
  /** Monthly price (USD). */
  monthlyUsd: number;
  /** Effective per-month price when billed annually (USD). */
  annualMonthlyUsd: number;
  /** Total charged once per year when billed annually (USD). */
  annualYearlyUsd: number;
  highlight: boolean;
  features: string[];
}

export interface AddonCard {
  key: string;
  label: string;
  blurb: string;
}

interface Props {
  plans: PlanCard[];
  addons: AddonCard[];
  currentTier?: PlanTier | "none";
  title: string;
  subtitle: string;
  /** The account's average deal value (USD). When set, each card shows an honest payback line.
   *  Omit on the public page (no deal value pre-login) so no payback is shown. */
  dealValueUsd?: number | null;
  /** Renders a plan's CTA; receives the selected cadence so it can bill correctly. */
  renderCta: (args: { plan: PlanCard; interval: Interval; isCurrent: boolean }) => React.ReactNode;
}

export function PricingGrid({
  plans,
  addons,
  currentTier = "none",
  title,
  subtitle,
  dealValueUsd,
  renderCta,
}: Props) {
  const [interval, setInterval] = useState<Interval>("month");

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-3">
        <Eyebrow>Plans</Eyebrow>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="max-w-xl text-sm text-muted-foreground">{subtitle}</p>
        <IntervalToggle interval={interval} onChange={setInterval} />
      </header>

      <Reveal className="mx-auto grid w-full max-w-4xl items-stretch gap-5 lg:grid-cols-2">
        {plans.map((plan) => {
          const isCurrent = plan.tier === currentTier;
          const price = interval === "year" ? plan.annualMonthlyUsd : plan.monthlyUsd;
          const payback =
            dealValueUsd && dealValueUsd > 0
              ? breakEvenCloses(plan.monthlyUsd, dealValueUsd, interval)
              : null;
          return (
            <RevealItem key={plan.tier} className="h-full">
              <div className="relative h-full rounded-2xl">
                <div
                  className={cn(
                    PANEL_SURFACE,
                    "relative flex h-full flex-col gap-6 overflow-hidden p-6",
                    plan.highlight &&
                      "border-[var(--cyan-line)] shadow-[var(--shadow-lift)] ring-1 ring-[var(--cyan-line)]"
                  )}
                >
                  {/* The recommended plan carries a thin cyan top accent — the brand
                      signal that steers selection, not a full-card tint. */}
                  {plan.highlight && (
                    <span
                      aria-hidden
                      className="absolute inset-x-0 top-0 h-1 bg-[var(--cyan)]"
                    />
                  )}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-2">
                      <h2 className="font-heading text-lg font-semibold">{plan.name}</h2>
                      <p className="text-sm leading-relaxed text-muted-foreground">{plan.tagline}</p>
                    </div>
                    {plan.highlight && (
                      <span className="shrink-0 rounded-full bg-[var(--cyan-tint)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--cyan-strong)] ring-1 ring-inset ring-[var(--cyan-line)]">
                        Most popular
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col gap-1">
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-mono text-base text-muted-foreground">$</span>
                      <span className="font-mono text-4xl font-semibold tabular-nums">
                        {price.toLocaleString()}
                      </span>
                      <span className="font-mono text-sm text-muted-foreground">/mo</span>
                    </div>
                    <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                      {interval === "year"
                        ? `Billed $${plan.annualYearlyUsd.toLocaleString()}/yr`
                        : "Billed monthly"}
                    </span>
                    {payback != null && (
                      <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-foreground/70">
                        {payback === 1
                          ? "One closed client covers the year"
                          : `${payback} closed clients cover the year`}
                      </span>
                    )}
                  </div>

                  <ul className="flex flex-col gap-3">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm">
                        <Check
                          className={cn(
                            "mt-0.5 size-4 shrink-0",
                            plan.highlight ? "text-[var(--cyan-strong)]" : "text-foreground/55"
                          )}
                        />
                        <span className={plan.highlight ? "text-foreground" : "text-muted-foreground"}>
                          {f}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto pt-2">{renderCta({ plan, interval, isCurrent })}</div>
                </div>
              </div>
            </RevealItem>
          );
        })}
      <EnterpriseCard />
      </Reveal>

      <div className="flex flex-col gap-4">
        <Eyebrow>Add-ons</Eyebrow>
        <div className="grid gap-4 sm:grid-cols-2">
          {addons.map((addon) => (
            <div key={addon.key} className={cn(PANEL_SURFACE, "flex flex-col gap-1.5 p-5")}>
              <span className="font-heading text-sm font-semibold">{addon.label}</span>
              <span className="text-sm text-muted-foreground">{addon.blurb}</span>
            </div>
          ))}
        </div>
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          Add-ons billed per unit · adjust anytime from billing
        </p>
      </div>
    </div>
  );
}

function IntervalToggle({
  interval,
  onChange,
}: {
  interval: Interval;
  onChange: (i: Interval) => void;
}) {
  return (
    <div className="mt-2 flex items-center gap-3">
      <div
        role="tablist"
        aria-label="Billing cadence"
        className={cn(PANEL_SURFACE, "inline-flex rounded-full p-1 shadow-none")}
      >
        {(["month", "year"] as const).map((value) => {
          const active = interval === value;
          return (
            <button
              key={value}
              role="tab"
              aria-selected={active}
              onClick={() => onChange(value)}
              className={cn(
                "rounded-full px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] transition-colors",
                active
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {value === "month" ? "Monthly" : "Annual"}
            </button>
          );
        })}
      </div>
      <span
        className={cn(
          "font-mono text-[11px] uppercase tracking-[0.14em] transition-opacity",
          interval === "year" ? "text-foreground opacity-100" : "text-muted-foreground opacity-70"
        )}
      >
        Save 2 months
      </span>
    </div>
  );
}

/** L5 two-plan restructure: the second plan is a conversation, not a checkout. */
function EnterpriseCard() {
  return (
    <RevealItem className="h-full">
      <div className={cn(PANEL_SURFACE, "relative flex h-full flex-col gap-6 overflow-hidden p-6")}>
        <div className="flex flex-col gap-1.5">
          <h2 className="font-heading text-xl font-semibold tracking-tight">Enterprise</h2>
          <p className="text-sm text-muted-foreground">
            Custom volume, senders, and seats — the same system, built around your team.
          </p>
        </div>
        <p className="font-heading text-3xl font-semibold tracking-tight">Let&apos;s talk</p>
        <ul className="flex flex-col gap-2.5 text-sm text-muted-foreground">
          <li>Custom prospect volume and LinkedIn senders</li>
          <li>Team seats and roles at your scale</li>
          <li>Dedicated success — priced to your goals</li>
        </ul>
        <a
          href="/demo"
          className="mt-auto inline-flex items-center justify-center rounded-lg border border-[var(--hairline)] px-4 py-2.5 text-sm font-medium transition-colors hover:bg-[var(--cyan-tint)]/50"
        >
          Book a meeting
        </a>
      </div>
    </RevealItem>
  );
}
