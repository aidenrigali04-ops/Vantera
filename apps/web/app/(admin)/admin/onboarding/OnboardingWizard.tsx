'use client'

import { cn } from '@/lib/utils'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Check } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { Step1BusinessType } from './steps/Step1BusinessType'
import { Step2Branding } from './steps/Step2Branding'
import { Step3Profile } from './steps/Step3Profile'
import { Step3Template as Step4Template } from './steps/Step3Template'
import { Step4Team as Step5Team } from './steps/Step4Team'
import { Step5Connections as Step6Connections } from './steps/Step5Connections'

type StepDef = {
  id: number
  label: string
  subtitle: string
  hint: string
}

const STEPS: readonly StepDef[] = [
  {
    id: 1,
    label: 'Business type',
    subtitle: 'Choose your industry',
    hint: 'We tailor pipelines, automations, and the AI tone to your industry — picking the right type here saves you hours of configuration later.',
  },
  {
    id: 2,
    label: 'Branding',
    subtitle: 'Logo, colors, and domain',
    hint: 'Your brand appears on the client portal, automated emails, and SMS sender ID. Anything you skip can be edited from settings later.',
  },
  {
    id: 3,
    label: 'Voice',
    subtitle: 'How messages should sound',
    hint: 'These preferences feed the AI that rewrites every automated message — booking confirmations, follow-ups, after-hours replies.',
  },
  {
    id: 4,
    label: 'Workflow',
    subtitle: 'Pipeline stages and automations',
    hint: 'We will load a vetted starter pipeline for your industry. You can rearrange stages and toggle automations from settings anytime.',
  },
  {
    id: 5,
    label: 'Team',
    subtitle: 'Invite up to three teammates',
    hint: 'Teammates get a magic sign-in link. You can invite more later from the Team page in admin settings.',
  },
  {
    id: 6,
    label: 'Connect tools',
    subtitle: 'Stripe, Twilio, and more',
    hint: 'Already using Stripe or Twilio? Plug them in now to skip duplicate setup. Everything else is handled natively — connect later if you prefer.',
  },
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

  function jumpTo(stepId: number) {
    // Only allow jumping back to steps you've already completed (or the
    // current one). Forward jumps would let the user bypass blocking
    // server actions — bad UX and a footgun for the AI bootstrap step.
    if (stepId === currentStep) return
    if (stepId < currentStep || completedSteps.has(stepId)) {
      setCurrentStep(stepId)
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

  const activeStep = STEPS[currentStep - 1] ?? STEPS[0]!
  const percent = useMemo(() => {
    return Math.round((completedSteps.size / STEPS.length) * 100)
  }, [completedSteps])

  return (
    <div className="dark grid min-h-screen grid-cols-1 bg-[#0A0E14] text-white lg:grid-cols-[380px_1fr]">
      {/*
       * Dark left rail. Mirrors the auth split-column hero: deep navy
       * #0B1220 base, subtle grid overlay, two radial-blur "glows"
       * tinted with the brand colors so the panel feels alive without
       * leaning on stock imagery. On lg+ it stays pinned while the
       * right column scrolls — feels like a desktop app rather than
       * a long centered form.
       */}
      <aside className="relative hidden overflow-hidden bg-[#0B1015] lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
        <div
          aria-hidden
          className="absolute -right-32 -top-32 size-[28rem] rounded-full opacity-30 blur-3xl"
          style={{ background: `radial-gradient(circle at center, ${primaryColor}, transparent 70%)` }}
        />
        <div
          aria-hidden
          className="absolute -bottom-32 -left-24 size-[24rem] rounded-full opacity-25 blur-3xl"
          style={{
            background: `radial-gradient(circle at center, ${secondaryColor}, transparent 70%)`,
          }}
        />

        <div className="relative z-10 flex h-full flex-col gap-8 px-8 py-10 text-white">
          <BrandMark businessName={businessName} logoUrl={logoUrl} />

          <div className="space-y-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-wider text-white/70">
              <span aria-hidden className="size-1.5 rounded-full bg-emerald-400" />
              Setup
            </span>
            <h2 className="text-2xl font-semibold leading-tight tracking-tight">
              Let's get your workspace ready
            </h2>
            <p className="text-sm leading-relaxed text-white/60">
              Six quick steps. Everything saves automatically — close the tab and pick up where you
              left off.
            </p>
          </div>

          <ol className="space-y-1">
            {STEPS.map((step) => {
              const status: StepStatus = completedSteps.has(step.id)
                ? 'complete'
                : step.id === currentStep
                  ? 'current'
                  : 'upcoming'

              return (
                <StepRow
                  key={step.id}
                  step={step}
                  status={status}
                  primaryColor={primaryColor}
                  onClick={() => jumpTo(step.id)}
                />
              )
            })}
          </ol>

          <div className="mt-auto rounded-xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur">
            <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-white/50">
              <span>Progress</span>
              <span>{percent}%</span>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
              <div
                style={{ width: `${percent}%`, backgroundColor: primaryColor }}
                className="h-full transition-all duration-500 ease-out"
              />
            </div>
            <p className="mt-3 text-xs leading-relaxed text-white/60">{activeStep.hint}</p>
          </div>
        </div>
      </aside>

      {/*
       * Mobile-only top stepper. A condensed dot rail with the current
       * step's label below — keeps the wizard usable on phone without
       * showing the full dark rail.
       */}
      <header className="border-b border-white/[0.06] bg-[#0B1015] px-5 py-4 lg:hidden">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-wider text-white/45">
              Step {activeStep.id} of {STEPS.length}
            </p>
            <p className="truncate text-sm font-semibold tracking-tight text-white">
              {activeStep.label}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {STEPS.map((step) => {
              const isDone = completedSteps.has(step.id)
              const isActive = step.id === currentStep
              return (
                <span
                  key={step.id}
                  style={isDone || isActive ? { backgroundColor: primaryColor } : undefined}
                  className={cn(
                    'block h-1.5 rounded-full transition-all',
                    isActive ? 'w-6' : 'w-1.5',
                    !isDone && !isActive && 'bg-white/15',
                  )}
                />
              )
            })}
          </div>
        </div>
      </header>

      {/* Right pane: the actual step content. */}
      <main className="relative min-w-0 overflow-hidden">
        {/* Top-right brand-tinted glow — matches the dashboard's page glow. */}
        <div
          aria-hidden
          className="pointer-events-none absolute right-0 top-0 size-[36rem] opacity-[0.10] blur-3xl"
          style={{
            background: `radial-gradient(circle at top right, ${primaryColor}, transparent 65%)`,
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 bottom-0 size-[32rem] opacity-[0.06] blur-3xl"
          style={{
            background: `radial-gradient(circle at bottom left, ${secondaryColor}, transparent 65%)`,
          }}
        />

        <div className="relative mx-auto w-full max-w-2xl px-6 py-10 sm:px-10 sm:py-14">
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="mb-8 flex items-center gap-2"
          >
            <span className="text-[11px] font-medium uppercase tracking-wider text-white/45">
              Step {activeStep.id} of {STEPS.length}
            </span>
            <span aria-hidden className="text-white/20">
              ·
            </span>
            <span className="text-[11px] font-medium uppercase tracking-wider text-white/75">
              {activeStep.subtitle}
            </span>
          </motion.div>

          {/* AnimatePresence with key=currentStep gives us a clean swap
              between step bodies. mode="wait" prevents both children
              rendering simultaneously which would jump the back button. */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            >
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
            </motion.div>
          </AnimatePresence>

          {currentStep > 1 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25 }}
              className="mt-10 flex justify-start border-t border-white/[0.06] pt-6"
            >
              <button
                type="button"
                onClick={goBack}
                className="inline-flex h-9 items-center gap-2 rounded-md px-3 text-xs font-medium text-white/45 transition-colors hover:bg-white/[0.04] hover:text-white"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                Back to {STEPS[currentStep - 2]?.label ?? 'previous'}
              </button>
            </motion.div>
          ) : null}
        </div>
      </main>
    </div>
  )
}

type StepStatus = 'complete' | 'current' | 'upcoming'

function StepRow({
  step,
  status,
  primaryColor,
  onClick,
}: {
  step: StepDef
  status: StepStatus
  primaryColor: string
  onClick: () => void
}) {
  const interactive = status !== 'upcoming'

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        disabled={!interactive}
        aria-current={status === 'current' ? 'step' : undefined}
        className={cn(
          'group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
          status === 'current' && 'bg-white/[0.08]',
          status === 'complete' && 'hover:bg-white/[0.05]',
          status === 'upcoming' && 'cursor-not-allowed',
        )}
      >
        <span
          aria-hidden
          style={status === 'current' ? { backgroundColor: primaryColor } : undefined}
          className={cn(
            'relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-colors',
            status === 'complete' && 'bg-emerald-500/15 text-emerald-300',
            status === 'current' && 'text-white shadow-[0_0_0_4px_rgba(255,255,255,0.04)]',
            status === 'upcoming' && 'bg-white/[0.04] text-white/30 ring-1 ring-inset ring-white/[0.06]',
          )}
        >
          {status === 'complete' ? <Check className="h-3.5 w-3.5" /> : step.id}
        </span>

        <span className="flex min-w-0 flex-1 flex-col">
          <span
            className={cn(
              'truncate text-sm font-medium leading-tight',
              status === 'upcoming' ? 'text-white/40' : 'text-white/90',
            )}
          >
            {step.label}
          </span>
          <span
            className={cn(
              'mt-0.5 truncate text-xs leading-tight',
              status === 'upcoming' ? 'text-white/25' : 'text-white/50',
            )}
          >
            {step.subtitle}
          </span>
        </span>

        {status === 'current' ? (
          <span aria-hidden className="size-1.5 shrink-0 animate-pulse rounded-full bg-emerald-400" />
        ) : null}
      </button>
    </li>
  )
}

function BrandMark({ businessName, logoUrl }: { businessName: string; logoUrl: string | null }) {
  const initial = (businessName?.trim()?.[0] ?? 'V').toUpperCase()

  return (
    <div className="flex items-center gap-3">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt={`${businessName} logo`}
          className="h-9 w-9 rounded-md bg-white/5 object-contain p-1 ring-1 ring-inset ring-white/10"
        />
      ) : (
        <span
          aria-hidden
          className="flex h-9 w-9 items-center justify-center rounded-md bg-white/[0.06] text-sm font-semibold text-white ring-1 ring-inset ring-white/10"
        >
          {initial}
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-white">{businessName || 'Your workspace'}</p>
        <p className="text-[11px] text-white/50">Workspace setup</p>
      </div>
    </div>
  )
}
