'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from 'react'

export type OnboardingNavState = {
  canAdvance: boolean
  isSubmitting: boolean
  primaryLabel?: string
  secondaryLabel?: string
}

type OnboardingNavContextValue = {
  theme: 'light'
  submitRef: MutableRefObject<(() => Promise<boolean>) | null>
  secondaryRef: MutableRefObject<(() => void | Promise<void>) | null>
  registerSubmit: (fn: (() => Promise<boolean>) | null) => void
  registerSecondary: (fn: (() => void | Promise<void>) | null) => void
  reportNav: (patch: Partial<OnboardingNavState>) => void
  nav: OnboardingNavState
}

const OnboardingNavContext = createContext<OnboardingNavContextValue | null>(null)

const DEFAULT_NAV: OnboardingNavState = {
  canAdvance: true,
  isSubmitting: false,
}

function navStateEqual(a: OnboardingNavState, b: OnboardingNavState): boolean {
  return (
    a.canAdvance === b.canAdvance &&
    a.isSubmitting === b.isSubmitting &&
    a.primaryLabel === b.primaryLabel &&
    a.secondaryLabel === b.secondaryLabel
  )
}

export function OnboardingNavProvider({ children }: { children: ReactNode }) {
  const submitRef = useRef<(() => Promise<boolean>) | null>(null)
  const secondaryRef = useRef<(() => void | Promise<void>) | null>(null)
  const [nav, setNav] = useState<OnboardingNavState>(DEFAULT_NAV)

  const registerSubmit = useCallback((fn: (() => Promise<boolean>) | null) => {
    submitRef.current = fn
  }, [])

  const registerSecondary = useCallback((fn: (() => void | Promise<void>) | null) => {
    secondaryRef.current = fn
  }, [])

  const reportNav = useCallback((patch: Partial<OnboardingNavState>) => {
    setNav((prev) => {
      const next = { ...prev, ...patch }
      return navStateEqual(prev, next) ? prev : next
    })
  }, [])

  const value = useMemo(
    () => ({
      theme: 'light' as const,
      submitRef,
      secondaryRef,
      registerSubmit,
      registerSecondary,
      reportNav,
      nav,
    }),
    [registerSubmit, registerSecondary, reportNav, nav],
  )

  return <OnboardingNavContext.Provider value={value}>{children}</OnboardingNavContext.Provider>
}

export function useOnboardingNav() {
  return useContext(OnboardingNavContext)
}

export function useOnboardingNavActions() {
  const ctx = useOnboardingNav()
  return {
    runSubmit: async () => {
      const fn = ctx?.submitRef.current
      if (!fn) return true
      return fn()
    },
    runSecondary: async () => {
      const fn = ctx?.secondaryRef.current
      if (fn) await fn()
    },
    nav: ctx?.nav ?? DEFAULT_NAV,
  }
}

/** Wire step save logic to the shared wizard footer (single primary action). */
export function useRegisterOnboardingStep(options: {
  canAdvance: boolean
  isSubmitting: boolean
  submit: () => Promise<boolean>
  primaryLabel?: string
  secondary?: { label: string; action: () => void | Promise<void> }
}) {
  const ctx = useOnboardingNav()
  const { canAdvance, isSubmitting, submit, primaryLabel, secondary } = options
  const secondaryLabel = secondary?.label

  const submitRef = useRef(submit)
  submitRef.current = submit

  const secondaryActionRef = useRef(secondary?.action ?? null)
  secondaryActionRef.current = secondary?.action ?? null

  useEffect(() => {
    if (!ctx) return

    ctx.registerSubmit(() => submitRef.current())
    ctx.registerSecondary(() => {
      const action = secondaryActionRef.current
      return action ? action() : undefined
    })

    return () => {
      ctx.registerSubmit(null)
      ctx.registerSecondary(null)
    }
  }, [ctx])

  useEffect(() => {
    if (!ctx) return
    ctx.reportNav({
      canAdvance,
      isSubmitting,
      primaryLabel,
      secondaryLabel,
    })
    return () => {
      ctx.reportNav(DEFAULT_NAV)
    }
  }, [ctx, canAdvance, isSubmitting, primaryLabel, secondaryLabel])
}
