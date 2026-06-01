'use client'

import { saveOperatingModel } from '@/lib/onboarding/save-operating-model'
import {
  OPERATING_MODELS,
  type OperatingModelId,
} from '@/lib/onboarding/operating-models'
import { writeOperatingModelId } from '@/lib/onboarding/operating-model-storage'
import { DURATION, EASE_OUT } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { motion } from 'framer-motion'
import { ArrowRight, Check } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

type Props = {
  accountId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function OperatingModelModal({ accountId, open, onOpenChange }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<OperatingModelId>('agency_ops')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleContinue() {
    setError(null)
    startTransition(async () => {
      const result = await saveOperatingModel(selected)
      if (!result.success) {
        setError(result.error ?? 'Could not save your selection')
        return
      }
      writeOperatingModelId(accountId, selected)
      onOpenChange(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl gap-0 overflow-hidden border-stone-200 p-0 sm:rounded-xl">
        <div className="border-b border-stone-100 px-6 py-5">
          <DialogHeader className="space-y-2 text-left">
            <DialogTitle className="text-xl font-semibold tracking-[-0.02em] text-stone-900">
              What are you managing?
            </DialogTitle>
            <DialogDescription className="text-[13px] leading-relaxed text-stone-500">
              We&apos;ll tailor pipeline language, dashboard focus, and templates to how you run
              the business — you can change this later in settings.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="max-h-[min(52vh,520px)] overflow-y-auto px-6 py-5">
          <div className="grid gap-3 sm:grid-cols-2">
            {OPERATING_MODELS.map((model) => {
              const Icon = model.icon
              const active = selected === model.id
              return (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => setSelected(model.id)}
                  className={cn(
                    'rounded-xl border p-4 text-left transition-colors duration-150',
                    active
                      ? 'border-stone-900 bg-stone-50 shadow-sm'
                      : 'border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50/80',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                      style={{ backgroundColor: `${model.accent}18`, color: model.accent }}
                    >
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    {active ? (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-stone-900 text-white">
                        <Check className="h-3 w-3" aria-hidden />
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 text-sm font-medium text-stone-900">{model.label}</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-stone-500">
                    {model.description}
                  </p>
                </button>
              )
            })}
          </div>
          {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
        </div>

        <div className="flex items-center justify-end border-t border-stone-100 px-6 py-4">
          <Button
            onClick={handleContinue}
            disabled={isPending}
            className="bg-stone-900 hover:bg-stone-800"
          >
            {isPending ? 'Saving…' : 'Continue to workspace'}
            <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
          </Button>
        </div>

        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-stone-300 to-transparent"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: DURATION.modal, ease: EASE_OUT }}
        />
      </DialogContent>
    </Dialog>
  )
}
