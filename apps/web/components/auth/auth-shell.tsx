'use client'

import { DURATION, EASE_OUT } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'
import { TenantBrandMark } from '@/components/branding/tenant-brand-mark'
import { AuthBrandPanel } from './auth-brand-panel'
import { AuthLogo } from './auth-logo'

type AuthShellProps = {
  children: ReactNode
  className?: string
  /** Hide the marketing brand column (e.g. client portal on a tenant domain). */
  showBrandPanel?: boolean
  /** Client portal login — workspace mark instead of Vantera. */
  portal?: boolean
}

const panelVariants = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.page, ease: EASE_OUT },
  },
}

/**
 * Step 1 — Auth page layout (50/50 desktop, full-width form on mobile).
 * Left: logo + form. Right: brand reinforcement (hidden below lg).
 */
export function AuthShell({
  children,
  className,
  showBrandPanel = true,
  portal = false,
}: AuthShellProps) {
  const reduceMotion = useReducedMotion()

  return (
    <div className="grid min-h-[100dvh] grid-cols-1 bg-[var(--bg-surface)] lg:grid-cols-2">
      <motion.div
        className={cn('flex min-h-[100dvh] flex-col', className)}
        initial={reduceMotion ? false : 'hidden'}
        animate="show"
        variants={panelVariants}
      >
        <header className="shrink-0 px-6 pt-[max(2rem,env(safe-area-inset-top))] sm:px-10 lg:px-14 lg:pt-10">
          {portal ? (
            <TenantBrandMark href="/auth/portal-login" />
          ) : (
            <AuthLogo />
          )}
        </header>

        <div className="flex flex-1 flex-col justify-center px-6 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-6 sm:px-10 lg:px-14 lg:pb-12">
          <div className="mx-auto w-full max-w-[400px] pb-6 sm:pb-0">{children}</div>
        </div>
      </motion.div>

      {showBrandPanel ? <AuthBrandPanel /> : null}
    </div>
  )
}
