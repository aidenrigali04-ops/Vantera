'use client'

import { OnboardingChoiceModal } from '@/components/onboarding/OnboardingChoiceModal'
import {
  BANNER_EXPLORE_DISMISS_MS,
  bannerExploreDismissKey,
  bannerSampleKeptKey,
} from '@/lib/onboarding/constants'
import { markChoiceAutoPromptSeen } from '@/lib/onboarding/prompts'
import { DURATION, EASE_OUT } from '@/lib/motion'
import { useOnboardingStore } from '@/lib/stores/onboarding-store'
import { cn } from '@/lib/utils'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'

type Props = {
  accountId: string
}

function isExploreDismissed(accountId: string): boolean {
  if (typeof window === 'undefined') return false
  const raw = window.localStorage.getItem(bannerExploreDismissKey(accountId))
  if (!raw) return false
  const until = Number(raw)
  if (!Number.isFinite(until)) return false
  if (Date.now() < until) return true
  window.localStorage.removeItem(bannerExploreDismissKey(accountId))
  return false
}

export function SampleDataBanner({ accountId }: Props) {
  const { setChoiceModalOpen, bannerVariant, setBannerVariant } = useOnboardingStore()
  const [visible, setVisible] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    if (isExploreDismissed(accountId)) {
      setVisible(false)
      return
    }
    const kept = window.localStorage.getItem(bannerSampleKeptKey(accountId)) === 'true'
    if (kept) setBannerVariant('sample_kept')
    setVisible(true)
  }, [accountId, setBannerVariant])

  function handleKeepExploring() {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(
        bannerExploreDismissKey(accountId),
        String(Date.now() + BANNER_EXPLORE_DISMISS_MS),
      )
    }
    setVisible(false)
  }

  function handleSetupWorkspace() {
    markChoiceAutoPromptSeen(accountId)
    setChoiceModalOpen(true)
  }

  const copy =
    bannerVariant === 'sample_kept'
      ? 'Sample data is still active. Add your real data anytime.'
      : 'This is sample data — replace it with yours.'

  if (!mounted) {
    return <OnboardingChoiceModal accountId={accountId} />
  }

  return (
    <>
      <AnimatePresence>
        {visible ? (
          <motion.div
            key="sample-banner"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: DURATION.banner, delay: 1, ease: EASE_OUT }}
            className="shrink-0 border-b border-stone-200/80 bg-stone-100/90 backdrop-blur-sm"
            role="status"
            aria-live="polite"
          >
            <div className="flex flex-col items-start justify-between gap-3 px-4 py-2.5 sm:flex-row sm:items-center sm:px-6">
              <p className="text-sm text-stone-700">
                <span className="font-medium text-stone-900">{copy}</span>
              </p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleKeepExploring}
                  className="text-xs font-medium text-stone-600 underline-offset-2 transition-colors hover:text-stone-900 hover:underline"
                >
                  Keep exploring
                </button>
                <button
                  type="button"
                  onClick={handleSetupWorkspace}
                  className={cn(
                    'rounded-lg bg-stone-900 px-3 py-1.5 text-xs font-medium text-white',
                    'transition-colors hover:bg-stone-800',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2',
                  )}
                >
                  Set up my workspace
                </button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <OnboardingChoiceModal accountId={accountId} />
    </>
  )
}
