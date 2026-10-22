import { redirect } from "next/navigation";
import {
  PLAN_DISPLAY,
  PLAN_DISPLAY_ORDER,
  TRIAL_DAYS,
  annualMonthlyUsd,
  annualYearlyUsd,
} from "@vantera/billing";
import { getOnboardingData } from "@/lib/auth/onboarding-context";
import { resolveOnboardingStep } from "@/lib/auth/onboarding-gate";
import { reconcileLinkedInAccounts } from "@/lib/linkedin/sync";
import { confirmCheckoutFromReturn } from "@/lib/billing/confirm-checkout-server";
import { finishOnboarding } from "./actions";
import { billingBypassAllowed } from "./billing-bypass";
import { DetailsForm } from "./details-form";
import { LinkedInStep } from "./linkedin-step";
import { OnboardingShell } from "./onboarding-shell";
import { STEP_COPY } from "./step-copy";
import { SubscriptionStep, type OnboardingPlan } from "./subscription-step";

/**
 * The frictionless onboarding: Details → LinkedIn → Subscription → dashboard. One route;
 * the server resolves the furthest incomplete step on every render, so a returning user
 * (or a hosted-auth / Checkout round-trip) lands exactly where they left off.
 */
export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{
    connected?: string;
    checkout?: string;
    finish?: string;
    /** Provider account id appended to the hosted-auth success redirect. */
    account_id?: string;
    /** Checkout session id appended to the billing success redirect. */
    session_id?: string;
  }>;
}) {
  const { connected, checkout, finish, account_id: providerRef, session_id: sessionId } =
    await searchParams;
  let data = await getOnboardingData();

  // Hosted-auth return: reconcile (webhook-independent backstop) before resolving the step,
  // so the LinkedIn segment flips even if the account_status webhook hasn't landed yet.
  // Scoped to the identity the redirect named — the provider workspace is shared across
  // tenants, so an unscoped pass could sweep in identities that aren't this customer's.
  let returnedFromConnect = false;
  if (connected === "1" && data.accountId) {
    const result = await reconcileLinkedInAccounts(data.accountId, {
      providerRef: providerRef ?? null,
    }).catch((err: unknown) => {
      console.error("onboarding: reconcile threw", err);
      return { synced: 0, claimed: false, failure: "unexpected error" };
    });
    data = await getOnboardingData();
    // Finishing on LinkedIn IS the connection: the provider creates the account before it
    // sends the user back. Our list is queried seconds after that and often hasn't caught
    // up, and the status webhook can't cover the gap because those payloads carry no tenant.
    // So treat the return as connected; the row is picked up on the later pass below.
    returnedFromConnect = true;
    if (!data.linkedinConnected) {
      console.warn("onboarding: connect returned with no row yet — advancing anyway", {
        reason: result.failure,
      });
    }
  }

  // Checkout return: confirm straight with the provider rather than waiting on a webhook that
  // may be delayed, dropped, or (locally) undeliverable. Idempotent with the webhook path.
  if (checkout === "success" && sessionId && data.accountId && !data.subscribed) {
    const confirmed = await confirmCheckoutFromReturn(sessionId, data.accountId).catch(
      (err: unknown) => {
        console.error("onboarding: checkout confirmation threw", err);
        return false;
      }
    );
    if (confirmed) data = await getOnboardingData();
  }

  let step = resolveOnboardingStep(data);
  // Never bounce a user back to the connect step they just completed.
  if (returnedFromConnect && step === 2) step = 3;

  // Standing on the plan step without a row: the provider's list has had time to catch up by
  // now, so make the second attempt here — where the wait costs the user nothing — instead of
  // stalling the redirect back from LinkedIn.
  if (step === 3 && !data.linkedinConnected && data.accountId) {
    const retried = await reconcileLinkedInAccounts(data.accountId, {
      providerRef: providerRef ?? null,
    }).catch((err: unknown) => {
      console.error("onboarding: late reconcile threw", err);
      return { synced: 0, claimed: false, failure: "unexpected error" };
    });
    if (retried.claimed) data = await getOnboardingData();
  }

  let finishFailed = finish === "failed";

  // Subscription attached (webhook landed) → provision + complete + leave. finishOnboarding
  // redirects on success; an error falls through to the subscription step with a message.
  if (step === "done") {
    if (data.onboardingComplete) redirect("/dashboard");
    const res = await finishOnboarding();
    finishFailed = Boolean(res?.error);
    step = 3;
  }

  const plans: OnboardingPlan[] = PLAN_DISPLAY_ORDER.map((tier) => {
    const d = PLAN_DISPLAY[tier];
    return {
      tier,
      name: d.name,
      tagline: d.tagline,
      monthlyUsd: d.monthlyUsd,
      annualMonthlyUsd: annualMonthlyUsd(d.monthlyUsd),
      annualYearlyUsd: annualYearlyUsd(d.monthlyUsd),
      highlight: d.highlight,
      features: d.features,
    };
  });

  const copy = STEP_COPY[step];
  // Back from Checkout but the webhook hasn't written the subscription yet → confirming mode.
  const confirming = step === 3 && checkout === "success" && !data.subscribed && !finishFailed;

  return (
    // The split: the step on the left, the painted panel on the right (onboarding-shell.tsx).
    <OnboardingShell step={step} title={copy.title} sub={copy.sub} trialDays={TRIAL_DAYS}>
      {step === 1 && <DetailsForm prefill={data.prefill} />}
      {step === 2 && (
        <LinkedInStep failed={connected === "failed"} />
      )}
      {step === 3 && (
        <SubscriptionStep
          plans={plans}
          trialDays={TRIAL_DAYS}
          confirming={confirming}
          canceled={checkout === "cancel"}
          checkoutError={checkout === "error"}
          finishFailed={finishFailed}
          devBypass={billingBypassAllowed()}
        />
      )}
    </OnboardingShell>
  );
}
