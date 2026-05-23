'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Step1BusinessType } from './steps/Step1BusinessType'
import { Step2Branding } from './steps/Step2Branding'
import { Step3Profile } from './steps/Step3Profile'
import { Step3Template as Step4Template } from './steps/Step3Template'
import { Step4Team as Step5Team } from './steps/Step4Team'
import { Step5Connections as Step6Connections } from './steps/Step5Connections'

const STEPS = [
  { id: 1, label: 'Business Type' },
  { id: 2, label: 'Branding' },
  { id: 3, label: 'Voice' },
  { id: 4, label: 'Workflow' },
  { id: 5, label: 'Team' },
  { id: 6, label: 'Connect' },
] as const

type Props = {
  accountId: string
  businessName: string
  currentVertical: string | null
  initialPrimaryColor: string
  initialSecondaryColor: string
  initialLogoUrl: string | null
  initialPortalDomain: string
}

export function OnboardingWizard({
  accountId,
  businessName,
  currentVertical,
  initialPrimaryColor,
  initialSecondaryColor,
  initialLogoUrl,
  initialPortalDomain,
}: Props) {
  const router = useRouter()
  const storageKey = `vantera_onboarding_step_${accountId}`

  const [currentStep, setCurrentStep] = useState<number>(1)
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set())
  const [hydrated, setHydrated] = useState(false)

  const [vertical, setVertical] = useState<string | null>(currentVertical)
  const [primaryColor, setPrimaryColor] = useState(initialPrimaryColor)
  const [secondaryColor, setSecondaryColor] = useState(initialSecondaryColor)
  const [logoUrl, setLogoUrl] = useState<string | null>(initialLogoUrl)
  const [portalDomain, setPortalDomain] = useState(initialPortalDomain)

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey)
      if (stored) {
        const parsed = JSON.parse(stored) as { step?: number; completed?: number[] }
        if (typeof parsed.step === 'number' && parsed.step >= 1 && parsed.step <= STEPS.length) {
          setCurrentStep(parsed.step)
        }
        if (Array.isArray(parsed.completed)) {
          setCompletedSteps(new Set(parsed.completed))
        }
      }
    } catch {
      /* ignore corrupt localStorage */
    }
    setHydrated(true)
  }, [storageKey])

  useEffect(() => {
    if (!hydrated) {
      return
    }

    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({ step: currentStep, completed: Array.from(completedSteps) }),
      )
    } catch {
      /* ignore storage quota errors */
    }
  }, [currentStep, completedSteps, storageKey, hydrated])

  function advance(stepCompleted: number) {
    setCompletedSteps((prev) => new Set(prev).add(stepCompleted))

    if (stepCompleted < STEPS.length) {
      setCurrentStep(stepCompleted + 1)
    }
  }

  function goBack() {
    if (currentStep > 1) {
      setCurrentStep((s) => s - 1)
    }
  }

  function handleFinalComplete() {
    setCompletedSteps((prev) => new Set(prev).add(STEPS.length))

    try {
      window.localStorage.removeItem(storageKey)
    } catch {
      /* ignore */
    }

    router.push('/admin/dashboard')
    router.refresh()
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b">
        <div className="mx-auto max-w-2xl px-6 py-6">
          <ProgressBar
            currentStep={currentStep}
            completedSteps={completedSteps}
            primaryColor={primaryColor}
          />
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-2xl px-6 py-10">
          {currentStep === 1 ? (
            <Step1BusinessType
              accountId={accountId}
              currentVertical={vertical}
              primaryColor={primaryColor}
              onComplete={(data) => {
                setVertical(data.vertical)
                advance(1)
              }}
            />
          ) : null}

          {currentStep === 2 ? (
            <Step2Branding
              accountId={accountId}
              businessName={businessName}
              initialLogoUrl={logoUrl}
              initialPrimary={primaryColor}
              initialSecondary={secondaryColor}
              initialPortalDomain={portalDomain}
              onComplete={(data) => {
                setLogoUrl(data.logoUrl)
                setPrimaryColor(data.primaryColor)
                setSecondaryColor(data.secondaryColor)
                setPortalDomain(data.portalDomain)
                advance(2)
              }}
            />
          ) : null}

          {currentStep === 3 ? (
            <Step3Profile
              accountId={accountId}
              primaryColor={primaryColor}
              onComplete={() => advance(3)}
            />
          ) : null}

          {currentStep === 4 ? (
            <Step4Template
              accountId={accountId}
              vertical={vertical}
              primaryColor={primaryColor}
              onComplete={() => advance(4)}
            />
          ) : null}

          {currentStep === 5 ? (
            <Step5Team
              accountId={accountId}
              primaryColor={primaryColor}
              onComplete={() => advance(5)}
            />
          ) : null}

          {currentStep === 6 ? (
            <Step6Connections
              accountId={accountId}
              primaryColor={primaryColor}
              onComplete={handleFinalComplete}
            />
          ) : null}

          {currentStep > 1 ? (
            <div className="mt-8 flex justify-start border-t pt-6">
              <Button type="button" variant="ghost" onClick={goBack}>
                ← Back
              </Button>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  )
}

function ProgressBar({
  currentStep,
  completedSteps,
  primaryColor,
}: {
  currentStep: number
  completedSteps: Set<number>
  primaryColor: string
}) {
  return (
    <ol className="flex items-center justify-between gap-2">
      {STEPS.map((step, index) => {
        const isComplete = completedSteps.has(step.id)
        const isCurrent = currentStep === step.id
        const isUpcoming = !isComplete && !isCurrent

        return (
          <li key={step.id} className="flex flex-1 items-center gap-2">
            <div
              style={
                isComplete || isCurrent
                  ? { backgroundColor: primaryColor, color: '#fff' }
                  : undefined
              }
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                isUpcoming && 'bg-muted text-muted-foreground',
              )}
            >
              {isComplete ? <Check className="h-3.5 w-3.5" /> : step.id}
            </div>
            <span
              className={cn(
                'hidden whitespace-nowrap text-xs font-medium sm:inline',
                isCurrent ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {step.label}
            </span>
            {index < STEPS.length - 1 ? (
              <div
                style={isComplete ? { backgroundColor: primaryColor } : undefined}
                className={cn('h-px flex-1', isComplete ? '' : 'bg-border')}
              />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}
