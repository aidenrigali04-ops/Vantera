'use client'

import {
  ONBOARDING_AUTO_PROMPT_MS,
  hasSeenChoiceAutoPrompt,
  markChoiceAutoPromptSeen,
} from '@/lib/onboarding/prompts'
import { useOnboardingStore } from '@/lib/stores/onboarding-store'
import { useEffect } from 'react'

type Props = {
  accountId: string
  enabled: boolean
}

/** Opens the setup choice modal once after 3 minutes in the demo workspace. */
export function OnboardingAutoPrompt({ accountId, enabled }: Props) {
  const { setChoiceModalOpen } = useOnboardingStore()

  useEffect(() => {
    if (!enabled || hasSeenChoiceAutoPrompt(accountId)) return

    const timer = window.setTimeout(() => {
      if (hasSeenChoiceAutoPrompt(accountId)) return
      markChoiceAutoPromptSeen(accountId)
      setChoiceModalOpen(true)
    }, ONBOARDING_AUTO_PROMPT_MS)

    return () => window.clearTimeout(timer)
  }, [accountId, enabled, setChoiceModalOpen])

  return null
}
