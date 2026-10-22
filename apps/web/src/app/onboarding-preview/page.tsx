import Link from "next/link";
import { notFound } from "next/navigation";
import { TRIAL_DAYS } from "@vantera/billing";
import { cn } from "@/lib/utils";
import type { OnboardingStep } from "@/lib/auth/onboarding-gate";
import { DetailsForm } from "@/app/onboarding/details-form";
import { LinkedInStep } from "@/app/onboarding/linkedin-step";
import { OnboardingShell, OnboardingSurface } from "@/app/onboarding/onboarding-shell";
import { STEP_COPY } from "@/app/onboarding/step-copy";
import { SubscriptionStep } from "@/app/onboarding/subscription-step";
import { PREVIEW_PREFILL, PREVIEW_STATES, previewPlans } from "./fixtures";

export const dynamic = "force-dynamic";

/**
 * `/onboarding-preview` — the design-review surface for the onboarding (rule 07's UI
 * Designer Reference). It renders the real shell and steps on sample data, with no auth
 * gate and no network call on render: `?step=1|2|3`, plus `?state=` for each step's
 * other states (see PREVIEW_STATES). DEVELOPMENT ONLY: 404s everywhere else, so the
 * sample workspace can never reach a real visitor.
 */
export default async function OnboardingPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; state?: string }>;
}) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { step: rawStep, state } = await searchParams;
  const step: OnboardingStep = rawStep === "2" ? 2 : rawStep === "3" ? 3 : 1;
  const copy = STEP_COPY[step];

  return (
    <OnboardingSurface>
      <OnboardingShell step={step} title={copy.title} sub={copy.sub} trialDays={TRIAL_DAYS}>
        {step === 1 && <DetailsForm prefill={PREVIEW_PREFILL} />}
        {step === 2 && (
          <LinkedInStep
            failed={state === "failed"}
            unconfirmed={state === "unconfirmed"}
            devReason={state === "unconfirmed" ? "sample diagnostic" : null}
          />
        )}
        {step === 3 && (
          <SubscriptionStep
            plans={previewPlans()}
            trialDays={TRIAL_DAYS}
            confirming={state === "confirming"}
            canceled={state === "canceled"}
            checkoutError={state === "error"}
            finishFailed={state === "failed"}
            devBypass={state === "bypass"}
          />
        )}
      </OnboardingShell>

      {/* Dev chrome: jump between steps and states. */}
      <nav
        aria-label="Preview states"
        className="fixed bottom-4 left-4 z-50 flex max-w-[calc(100vw-2rem)] flex-wrap items-center gap-1 rounded-lg border border-[rgba(12,16,26,0.1)] bg-white/95 p-1.5 text-xs shadow-[0_8px_24px_-12px_rgba(16,24,40,0.3)] backdrop-blur"
      >
        <span className="px-1.5 font-semibold text-[var(--ink-3)]">Preview</span>
        {([1, 2, 3] as const).flatMap((n) =>
          [undefined, ...PREVIEW_STATES[n]].map((s) => {
            const on = step === n && (state ?? undefined) === s;
            const href = `/onboarding-preview?step=${n}${s ? `&state=${s}` : ""}`;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "rounded-md px-2 py-1 font-medium transition-colors",
                  on
                    ? "bg-[var(--fb-strong)] text-white"
                    : "text-foreground hover:bg-[rgba(12,16,26,0.05)]",
                )}
              >
                {s ? `${n} · ${s}` : `Step ${n}`}
              </Link>
            );
          }),
        )}
      </nav>
    </OnboardingSurface>
  );
}
