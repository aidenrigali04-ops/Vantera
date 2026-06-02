'use client'

import { OperatingModelPicker } from '@/components/onboarding/OperatingModelPicker'
import { ProductTourMediaPanel } from '@/components/onboarding/product-tour/ProductTourMediaPanel'
import { SlideWizardFrame } from '@/components/onboarding/slide-wizard/SlideWizardFrame'
import { saveOperatingModel } from '@/lib/onboarding/save-operating-model'
import { type OperatingModelId } from '@/lib/onboarding/operating-models'
import { writeOperatingModelId } from '@/lib/onboarding/operating-model-storage'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'

const SLIDE = {
  id: 'operating-model',
  eyebrow: 'Getting started',
  title: 'What are you managing?',
  body: 'We tailor pipeline language, dashboard focus, and templates to how you run the business.',
}

type Props = {
  accountId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function OperatingModelModal({ accountId, open, onOpenChange }: Props) {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [selected, setSelected] = useState<OperatingModelId>('agency_ops')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) {
      setError(null)
    }
  }, [open])

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

  if (!mounted || !open) return null

  return (
    <SlideWizardFrame
      variant="overlay"
      open={open}
      headerLabel="Workspace setup · 1 / 1"
      slide={SLIDE}
      stepIndex={0}
      totalSteps={1}
      mediaPanel={
        <ProductTourMediaPanel
          media={{ type: 'preview', previewId: 'welcome' }}
          slideId="operating-model"
          className="h-full lg:min-h-[320px]"
        />
      }
      onBack={() => {}}
      onPrimary={handleContinue}
      primaryLabel="Continue to workspace"
      primaryDisabled={isPending}
      primaryLoading={isPending}
      showSkip={false}
      dialogTitleId="operating-model-title"
      dialogBodyId="operating-model-body"
    >
      <OperatingModelPicker selected={selected} onSelect={setSelected} />
      {error ? (
        <p className="mt-3 text-[13px] text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}
    </SlideWizardFrame>
  )
}
