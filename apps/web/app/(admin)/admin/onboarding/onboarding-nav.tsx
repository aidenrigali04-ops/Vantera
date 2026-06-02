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
    setNav((prev) => ({ ...prev, ...patch }))
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

  useEffect(() => {
    if (!ctx) return
    ctx.registerSubmit(submit)
    ctx.registerSecondary(secondary?.action ?? null)
    ctx.reportNav({
      canAdvance,
      isSubmitting,
      primaryLabel,
      secondaryLabel: secondary?.label,
    })
    return () => {
      ctx.registerSubmit(null)
      ctx.registerSecondary(null)
      ctx.reportNav(DEFAULT_NAV)
    }
  }, [ctx, canAdvance, isSubmitting, submit, primaryLabel, secondary])
}
