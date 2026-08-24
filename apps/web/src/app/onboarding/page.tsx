import Link from "next/link";
import { redirect } from "next/navigation";
import {
  PLAN_DISPLAY,
  PLAN_DISPLAY_ORDER,
  TRIAL_DAYS,
  annualMonthlyUsd,
  annualYearlyUsd,
} from "@vantera/billing";
import { VanteraLogo } from "@/components/landing/vantera-logo";
import { getOnboardingData } from "@/lib/auth/onboarding-context";
import { resolveOnboardingStep } from "@/lib/auth/onboarding-gate";
import { reconcileLinkedInAccounts } from "@/lib/linkedin/sync";
import { confirmCheckoutFromReturn } from "@/lib/billing/confirm-checkout-server";
import { finishOnboarding } from "./actions";
import { billingBypassAllowed } from "./billing-bypass";
import { DetailsForm } from "./details-form";
import { LinkedInStep } from "./linkedin-step";
import { OnboardingProgress } from "./onboarding-progress";
import { OnboardingRail } from "./onboarding-rail";
import { SubscriptionStep, type OnboardingPlan } from "./subscription-step";

const COPY = {
  1: {
    title: "Tell us about your business",
    sub: "Three details — we take it from here. Your site tells us what you sell and who buys it.",
  },
  2: {
    title: "Connect your LinkedIn",
    sub: "The account your outreach will come from. Nothing sends without your approval.",
  },
  3: {
    title: "Choose your plan",
    sub: `Start with a ${TRIAL_DAYS}-day free trial. Your agents go live the moment you're in.`,
  },
} as const;

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

  const copy = COPY[step];
  // Back from Checkout but the webhook hasn't written the subscription yet → confirming mode.
  const confirming = step === 3 && checkout === "success" && !data.subscribed && !finishFailed;

  return (
    // 25 / 75 split: the blue rail carries the progress, the white column carries the step.
    <div className="min-h-screen lg:grid lg:grid-cols-[25%_75%]">
      <OnboardingRail step={step} />

      <section className="flex min-h-screen flex-col px-6 py-8 sm:px-12 lg:px-16 xl:px-24">
        {/* compact chrome below lg, where the rail is hidden */}
        <div className="lg:hidden">
          <Link href="/" className="mb-8 flex items-center gap-2 text-foreground">
            <VanteraLogo className="size-6 text-foreground" />
            <span className="text-[18px] font-semibold tracking-[-0.02em]">Vantera</span>
          </Link>
          <OnboardingProgress step={step} />
        </div>

        <div className="flex flex-1 items-center py-6 lg:py-10">
          <div className="w-full max-w-[560px]">
            <h1 className="text-[26px] font-bold leading-[1.12] tracking-[-0.03em] text-foreground sm:text-[30px]">
              {copy.title}
            </h1>
            <p className="mt-3 max-w-[46ch] text-[14.5px] leading-relaxed text-[var(--ink-3)]">{copy.sub}</p>

            <div className="mt-9">
              {step === 1 && <DetailsForm prefill={data.prefill} />}
              {step === 2 && <LinkedInStep failed={connected === "failed"} />}
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
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
