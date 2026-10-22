import { TRIAL_DAYS } from "@vantera/billing";
import { Accent } from "@/components/landing/frame";
import { ONBOARDING_MINUTES } from "@/components/landing/claims";
import type { OnboardingStep } from "@/lib/auth/onboarding-gate";

/**
 * Each step's heading and line. The closing phrase of a heading is set in bold blue, as
 * on the landing. Kept apart from page.tsx so the dev-only /onboarding-preview shows the
 * exact words the real flow does.
 */
export const STEP_COPY: Record<OnboardingStep, { title: React.ReactNode; sub: string }> = {
  1: {
    title: (
      <>
        Tell us about <Accent>your business</Accent>
      </>
    ),
    sub: `Three details — we take it from here. Setup takes about ${ONBOARDING_MINUTES} minutes, start to finish.`,
  },
  2: {
    title: (
      <>
        Connect <Accent>your LinkedIn</Accent>
      </>
    ),
    sub: "The account your agents will send from, connected in one secure step.",
  },
  3: {
    title: (
      <>
        Choose <Accent>your plan</Accent>
      </>
    ),
    sub: `Start with a ${TRIAL_DAYS}-day free trial. Your agents go live the moment you're in.`,
  },
};
