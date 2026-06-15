"use client";

import { Check } from "lucide-react";
import type { PlanTier } from "@vantera/billing";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Reveal, RevealItem, Eyebrow, PANEL_SURFACE } from "@/components/ui/panel";
import { AnimatedPanelBorder } from "@/components/ui/animated-border";
import { startCheckout, openBillingPortal } from "./actions";

export interface PlanCard {
  tier: PlanTier;
  name: string;
  tagline: string;
  monthlyUsd: number;
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
  currentTier: PlanTier | "none";
  hasActivePlan: boolean;
}

const SALES_EMAIL = "sales@vanterasystem.com";

export function PricingPlans({ plans, addons, currentTier, hasActivePlan }: Props) {
  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-3">
        <Eyebrow>Plans</Eyebrow>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Choose the plan that matches your goal
        </h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          Every plan runs the same SDR agents on your ICP. Move up as you add channels,
          seats, and volume — your enrichment and scoring never change.
        </p>
      </header>

      <Reveal className="grid items-stretch gap-5 lg:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = plan.tier === currentTier;
          return (
            <RevealItem key={plan.tier} className="h-full">
              <div className="relative h-full rounded-2xl">
                <div
                  className={cn(
                    PANEL_SURFACE,
                    "relative flex h-full flex-col gap-6 overflow-hidden p-6",
                    plan.highlight &&
                      "dark:border-white/20 dark:bg-white/[0.06] border-black/[0.12] bg-black/[0.03]"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-2">
                      <h2 className="font-heading text-lg font-semibold">{plan.name}</h2>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {plan.tagline}
                      </p>
                    </div>
                    {plan.highlight && (
                      <span className="shrink-0 rounded-full border border-foreground/20 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-foreground">
                        Most popular
                      </span>
                    )}
                  </div>

                  <div className="flex items-baseline gap-1.5">
                    <span className="font-mono text-base text-muted-foreground">$</span>
                    <span className="font-mono text-4xl font-semibold tabular-nums">
                      {plan.monthlyUsd.toLocaleString()}
                    </span>
                    <span className="font-mono text-sm text-muted-foreground">/mo</span>
                  </div>

                  <ul className="flex flex-col gap-3">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm">
                        <Check
                          className={cn(
                            "mt-0.5 size-4 shrink-0",
                            plan.highlight ? "text-foreground" : "text-foreground/55"
                          )}
                        />
                        <span className={plan.highlight ? "text-foreground" : "text-muted-foreground"}>
                          {f}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto pt-2">
                    <PlanCta
                      plan={plan}
                      isCurrent={isCurrent}
                      hasActivePlan={hasActivePlan}
                    />
                  </div>
                </div>

                {plan.highlight && <AnimatedPanelBorder radius={16} />}
              </div>
            </RevealItem>
          );
        })}
      </Reveal>

      <div className={cn(PANEL_SURFACE, "flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between")}>
        <div className="flex flex-col gap-1.5">
          <h2 className="font-heading text-base font-semibold">Enterprise</h2>
          <p className="text-sm text-muted-foreground">
            Custom volume, dedicated infrastructure, SSO, and a named contact. For teams
            running outbound at scale.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="shrink-0">
          <a href={`mailto:${SALES_EMAIL}`}>Talk to us</a>
        </Button>
      </div>

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

function PlanCta({
  plan,
  isCurrent,
  hasActivePlan,
}: {
  plan: PlanCard;
  isCurrent: boolean;
  hasActivePlan: boolean;
}) {
  if (isCurrent) {
    return (
      <Button variant="outline" size="lg" className="w-full" disabled>
        Current plan
      </Button>
    );
  }

  // Switching an existing subscription goes through the Stripe portal (handles
  // proration safely); a first purchase goes straight to checkout.
  if (hasActivePlan) {
    return (
      <form action={openBillingPortal}>
        <Button type="submit" variant="outline" size="lg" className="w-full">
          Switch to {plan.name}
        </Button>
      </form>
    );
  }

  return (
    <form action={startCheckout}>
      <input type="hidden" name="tier" value={plan.tier} />
      <Button
        type="submit"
        variant={plan.highlight ? "default" : "outline"}
        size="lg"
        className="w-full"
      >
        Choose {plan.name}
      </Button>
    </form>
  );
}
