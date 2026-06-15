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

const SALES_EMAIL = "sales@vanterasystem.com";

interface Props {
  plans: PlanCard[];
  addons: AddonCard[];
  currentTier: PlanTier | "none";
  hasActivePlan: boolean;
}

export function PricingPlans({ plans, addons, currentTier, hasActivePlan }: Props) {
  return (
    <PricingGrid
      plans={plans}
      addons={addons}
      currentTier={currentTier}
      title="Choose the plan that matches your goal"
      subtitle="Every plan runs the same SDR agents on your ICP. Move up as you add channels, seats, and volume — your enrichment and scoring never change."
      enterpriseCta={
        <Button asChild variant="outline" size="sm">
          <a href={`mailto:${SALES_EMAIL}`}>Talk to us</a>
        </Button>
      }
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
    <form action={startCheckout}>
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
