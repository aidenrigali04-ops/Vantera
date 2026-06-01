'use client'

import { clearSampleDataAction, keepSampleDataAction } from '@/app/(admin)/admin/dashboard/actions'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DEMO_WORKSPACE_NAME, bannerSampleKeptKey } from '@/lib/onboarding/constants'
import { activateStartHereBadge, markChoiceAutoPromptSeen } from '@/lib/onboarding/prompts'
import { DURATION, EASE_OUT } from '@/lib/motion'
import { useOnboardingStore } from '@/lib/stores/onboarding-store'
import { cn } from '@/lib/utils'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

type ModalStep = 'choice' | 'confirm'

export function OnboardingChoiceModal({ accountId }: { accountId: string }) {
  const router = useRouter()
  const { choiceModalOpen, setChoiceModalOpen, setBannerVariant } = useOnboardingStore()
  const [step, setStep] = useState<ModalStep>('choice')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleClose() {
    if (isPending) return
    markChoiceAutoPromptSeen(accountId)
    setChoiceModalOpen(false)
    setStep('choice')
    setError(null)
  }

  function handleKeepSample() {
    startTransition(async () => {
      const result = await keepSampleDataAction()
      if (!result.success) {
        setError(result.error ?? 'Failed to keep sample data')
        return
      }
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(bannerSampleKeptKey(accountId), 'true')
      }
      setBannerVariant('sample_kept')
      handleClose()
      router.refresh()
    })
  }

  function handleConfirmClear() {
    setError(null)
    startTransition(async () => {
      const result = await clearSampleDataAction()
      if (!result.success) {
        setError(result.error ?? 'Failed to clear sample data')
        return
      }
      activateStartHereBadge(accountId)
      handleClose()
      router.refresh()
    })
  }

  return (
    <Dialog open={choiceModalOpen} onOpenChange={(open) => (!open ? handleClose() : setChoiceModalOpen(true))}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden border-stone-200 p-0 sm:rounded-xl">
        <AnimatePresence mode="wait" initial={false}>
          {step === 'choice' ? (
            <motion.div
              key="choice"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: DURATION.modal, ease: EASE_OUT }}
              className="p-6"
            >
              <DialogHeader className="space-y-2 text-left">
                <DialogTitle className="text-xl font-semibold tracking-tight text-stone-900">
                  Ready to make this yours?
                </DialogTitle>
                <DialogDescription className="text-sm leading-relaxed text-stone-600">
                  Choose how you want to start.
                </DialogDescription>
              </DialogHeader>

              <div className="mt-6 space-y-3">
                <button
                  type="button"
                  onClick={() => setStep('confirm')}
                  className={cn(
                    'group w-full rounded-xl border border-stone-900 bg-stone-50 p-4 text-left transition-colors',
                    'hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-stone-500">
                        <Sparkles className="h-3 w-3" aria-hidden />
                        Recommended
                      </span>
                      <p className="mt-1 text-sm font-semibold text-stone-900">Start with my real data</p>
                      <p className="mt-1 text-xs leading-relaxed text-stone-600">
                        Clear the sample data and start fresh. We&rsquo;ll guide you through adding your
                        first client, opportunity, and project.
                      </p>
                    </div>
                    <ArrowRight
                      className="mt-1 h-4 w-4 shrink-0 text-stone-400 transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </div>
                  <span className="mt-3 inline-flex text-xs font-medium text-stone-900">Start fresh →</span>
                </button>

                <button
                  type="button"
                  onClick={handleKeepSample}
                  disabled={isPending}
                  className={cn(
                    'group w-full rounded-xl border border-stone-200 bg-white p-4 text-left transition-colors',
                    'hover:border-stone-300 hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 focus-visible:ring-offset-2',
                  )}
                >
                  <p className="text-sm font-semibold text-stone-900">Keep the sample data</p>
                  <p className="mt-1 text-xs leading-relaxed text-stone-600">
                    Keep {DEMO_WORKSPACE_NAME} as a reference while you add your real data alongside it.
                  </p>
                  <span className="mt-3 inline-flex text-xs font-medium text-stone-700">Keep sample data →</span>
                </button>
              </div>

              {error ? (
                <p className="mt-4 text-sm text-red-600" role="alert">
                  {error}
                </p>
              ) : null}

              <button
                type="button"
                onClick={handleClose}
                className="mt-5 text-xs font-medium text-stone-500 transition-colors hover:text-stone-800"
              >
                Not ready yet
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: DURATION.modal, ease: EASE_OUT }}
              className="p-6"
            >
              <DialogHeader className="space-y-2 text-left">
                <DialogTitle className="text-xl font-semibold tracking-tight text-stone-900">
                  Clear sample data?
                </DialogTitle>
                <DialogDescription className="text-sm leading-relaxed text-stone-600">
                  This will remove {DEMO_WORKSPACE_NAME}&rsquo;s clients, opportunities, and projects.
                  Your workspace will start fresh.
                </DialogDescription>
              </DialogHeader>

              {error ? (
                <p className="mt-4 text-sm text-red-600" role="alert">
                  {error}
                </p>
              ) : null}

              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={() => setStep('choice')} disabled={isPending}>
                  Go back
                </Button>
                <Button type="button" onClick={handleConfirmClear} disabled={isPending}>
                  {isPending ? 'Clearing…' : 'Yes, start fresh'}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  )
}
