/**
 * Step resolution for the frictionless onboarding (Details → LinkedIn → Subscription →
 * dashboard). A pure sibling of resolveGate: the layout still enforces the hard
 * signed-in / already-onboarded gate; this decides WHICH step to render so the flow never
 * re-asks anything it already knows and a returning user lands on the furthest
 * incomplete step.
 */

export type OnboardingStep = 1 | 2 | 3;

export type OnboardingContext = {
  /** accounts row exists (created at step 1 via create_account) */
  hasAccount: boolean;
  /** step 1 saved: workspace name + website_url + the user's display name */
  detailsConfirmed: boolean;
  /** a linkedin_accounts row in status connecting|active — 'connecting' counts so the
   *  user isn't bounced back in the seconds before the account_status webhook lands */
  linkedinConnected: boolean;
  /** a Stripe subscription is attached (webhook wrote stripe_subscription_id) */
  subscribed: boolean;
  /** accounts.onboarding_completed_at set — finished users never re-enter */
  onboardingComplete: boolean;
};

/** Segment labels, in order; the first is endowed (the account already exists). */
export const ONBOARDING_SEGMENTS = ["Account", "Details", "LinkedIn", "Subscription"] as const;

/** Furthest incomplete step, or "done" once the subscription is in and the flow can finish. */
export function resolveOnboardingStep(ctx: OnboardingContext): OnboardingStep | "done" {
  if (ctx.onboardingComplete) return "done";
  if (!ctx.hasAccount || !ctx.detailsConfirmed) return 1;
  if (!ctx.linkedinConnected) return 2;
  if (!ctx.subscribed) return 3;
  return "done";
}

/** 25% endowed on arrival: 1 of 4 segments is already complete before the first input. */
export function onboardingProgressPercent(step: OnboardingStep | "done"): number {
  if (step === "done") return 100;
  return Math.round((step / ONBOARDING_SEGMENTS.length) * 100);
}
