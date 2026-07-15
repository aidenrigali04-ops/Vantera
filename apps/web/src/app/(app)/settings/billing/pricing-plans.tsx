"use client";

import type { PlanTier } from "@vantera/billing";
import { Button } from "@/components/ui/button";
import {
  PricingGrid,
  type PlanCard,
  type AddonCard,
  type Interval,
} from "@/components/pricing/pricing-grid";
import { startCheckout, openBillingPortal } from "./actions";
import { trackEvent } from "@/lib/analytics/clarity";


interface Props {
  plans: PlanCard[];
  addons: AddonCard[];
  currentTier: PlanTier | "none";
  hasActivePlan: boolean;
  /** Account's average deal value (USD) → honest per-card payback line; null when unset. */
  dealValueUsd?: number | null;
}

export function PricingPlans({ plans, addons, currentTier, hasActivePlan, dealValueUsd }: Props) {
  return (
    <PricingGrid
      plans={plans}
      addons={addons}
      currentTier={currentTier}
      dealValueUsd={dealValueUsd}
      title="Choose the plan that matches your goal"
      subtitle="Every plan runs the same agents on your ICP. Move up as your team grows — more seats and connected LinkedIn accounts; your enrichment and scoring never change."
      renderCta={({ plan, interval, isCurrent }) => (
        <PlanCta
          plan={plan}
          interval={interval}
          isCurrent={isCurrent}
          hasActivePlan={hasActivePlan}
        />
      )}
    />
  );
}

function PlanCta({
  plan,
  interval,
  isCurrent,
  hasActivePlan,
}: {
  plan: PlanCard;
  interval: Interval;
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
    // onSubmit (not the action) carries the analytics fire: it runs immediately on
    // click, before the server action redirects the browser to Stripe.
    <form
      action={startCheckout}
      onSubmit={() => trackEvent("checkout_started", { plan: plan.tier, interval })}
    >
      <input type="hidden" name="tier" value={plan.tier} />
      <input type="hidden" name="interval" value={interval} />
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

export type { PlanCard, AddonCard };
