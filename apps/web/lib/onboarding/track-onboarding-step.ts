import 'server-only'

import { db } from '@/lib/db/client'
import { aiObservations } from '@vantera/db'
import type {
  OnboardingStepEvent,
  OnboardingStepId,
} from '@/lib/onboarding/onboarding-wizard-types'

export type { OnboardingStepEvent, OnboardingStepId } from '@/lib/onboarding/onboarding-wizard-types'

/** Lightweight conversion tracking — one row per step event in ai_observations. */
export async function trackOnboardingStep(
  accountId: string,
  step: OnboardingStepId,
  event: OnboardingStepEvent,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await db.insert(aiObservations).values({
      accountId,
      kind: 'tool_called',
      payload: {
        tool: 'onboarding_funnel',
        step,
        event,
        ...(metadata ?? {}),
      },
      outcome: 'success',
    })
  } catch (err) {
    console.error('[trackOnboardingStep] failed', { accountId, step, event, err })
  }
}
