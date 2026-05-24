'use client'

import { cn } from '@/lib/utils'
import { motion, type Variants } from 'framer-motion'
import { Loader2, type LucideIcon } from 'lucide-react'
import type { MouseEventHandler, ReactNode } from 'react'

/**
 * Shared dark-theme primitives for the onboarding wizard steps. Mirrors
 * the styling vocabulary of the admin dashboard so the surfaces feel like
 * the same product:
 *
 *   - Container variants for staggered entry animations.
 *   - SelectableTile for vertical / voice / template pickers.
 *   - PrimaryCTA / GhostCTA gradient-and-glow buttons.
 *   - FieldGroup section header with eyebrow + description.
 */

export const stepContainer: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.055, delayChildren: 0.04 },
  },
}

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
}

/* ───────────────────── Server Action client helpers ───────────────────── */

const STEP_ACTION_TIMEOUT_MS = 25_000

export function isNextRedirectError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const digest = (err as { digest?: unknown }).digest
  return typeof digest === 'string' && digest.startsWith('NEXT_REDIRECT')
}

export function isNextNotFoundError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const digest = (err as { digest?: unknown }).digest
  return typeof digest === 'string' && digest.startsWith('NEXT_NOT_FOUND')
}

/** Re-throw Next.js navigation signals so the framework can handle them. */
export function rethrowFrameworkNavigation(err: unknown): void {
  if (isNextRedirectError(err) || isNextNotFoundError(err)) throw err
}

/** Guard against Server Actions that never resolve (redirect() hang, network drop). */
export async function runStepAction<T>(fn: () => Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined

  try {
    return await Promise.race([
      fn(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('This is taking longer than expected. Please try again.')),
          STEP_ACTION_TIMEOUT_MS,
        )
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/* ────────────────────────── Section header ────────────────────────── */

export function StepHeader({
  title,
  subtitle,
}: {
  title: string
  subtitle: string
}) {
  return (
    <motion.div variants={fadeUp} className="space-y-2">
      <h1 className="text-3xl font-semibold leading-tight tracking-tight text-white">{title}</h1>
      <p className="max-w-2xl text-sm leading-relaxed text-white/55">{subtitle}</p>
    </motion.div>
  )
}

/* ─────────────────────────── Field group ─────────────────────────── */

export function FieldGroup({
  label,
  description,
  right,
  children,
}: {
  label: string
  description?: string
  right?: ReactNode
  children: ReactNode
}) {
  return (
    <motion.section variants={fadeUp} className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <label className="text-sm font-semibold text-white">{label}</label>
        {right}
      </div>
      {description ? (
        <p className="text-xs leading-relaxed text-white/45">{description}</p>
      ) : null}
      {children}
    </motion.section>
  )
}

/* ─────────────────────── Selectable tile (cards) ─────────────────────── */

type SelectableTileProps = {
  selected: boolean
  primaryColor: string
  onClick: () => void
  icon?: LucideIcon
  iconColor?: string
  title: string
  description?: string
  className?: string
  layout?: 'horizontal' | 'vertical'
}

/**
 * A clickable card used by Step 1 (verticals) and similar grid pickers.
 * Selected state lights up the tinted icon swatch + a soft brand-colored
 * halo around the tile (replaces the chunky outline used before).
 */
export function SelectableTile({
  selected,
  primaryColor,
  onClick,
  icon: Icon,
  iconColor,
  title,
  description,
  className,
  layout = 'horizontal',
}: SelectableTileProps) {
  const accent = iconColor ?? primaryColor

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.99 }}
      transition={{ type: 'spring', stiffness: 320, damping: 24 }}
      style={
        selected
          ? {
              borderColor: `${primaryColor}66`,
              boxShadow: `0 0 0 1px ${primaryColor}40, 0 12px 28px -16px ${primaryColor}aa`,
            }
          : undefined
      }
      className={cn(
        'group relative overflow-hidden rounded-2xl border bg-white/[0.02] p-4 text-left transition-colors duration-200',
        selected
          ? 'bg-white/[0.04]'
          : 'border-white/[0.06] hover:border-white/[0.14] hover:bg-white/[0.035]',
        layout === 'horizontal' ? 'flex items-start gap-3' : 'flex flex-col gap-3',
        className,
      )}
    >
      {/* Brand-tinted glow that fades in on selection. */}
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute -right-12 -top-12 size-32 rounded-full blur-2xl transition-opacity duration-500',
          selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-60',
        )}
        style={{ background: `radial-gradient(circle at center, ${accent}66, transparent 70%)` }}
      />

      {Icon ? (
        <span
          aria-hidden
          style={{
            background: selected
              ? `linear-gradient(135deg, ${accent}33, ${accent}0a)`
              : 'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
            boxShadow: selected
              ? `inset 0 0 0 1px ${accent}33`
              : 'inset 0 0 0 1px rgba(255,255,255,0.06)',
          }}
          className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
        >
          <Icon
            className="h-5 w-5 transition-colors"
            style={{ color: selected ? accent : 'rgba(255,255,255,0.55)' }}
            aria-hidden
          />
        </span>
      ) : null}

      <div className="relative min-w-0 flex-1">
        <p className={cn('text-sm font-semibold leading-tight', selected ? 'text-white' : 'text-white/90')}>
          {title}
        </p>
        {description ? (
          <p className="mt-1 text-xs leading-relaxed text-white/50">{description}</p>
        ) : null}
      </div>
    </motion.button>
  )
}

/* ───────────────────────────── CTAs ───────────────────────────── */

type PrimaryCTAProps = {
  primaryColor: string
  onClick?: MouseEventHandler<HTMLButtonElement>
  disabled?: boolean
  loading?: boolean
  type?: 'button' | 'submit' | 'reset'
  children: ReactNode
  className?: string
}

export function PrimaryCTA({
  primaryColor,
  onClick,
  loading,
  children,
  className,
  disabled,
  type = 'button',
}: PrimaryCTAProps) {
  const inert = Boolean(disabled || loading)
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={inert}
      whileHover={inert ? undefined : { y: -1 }}
      whileTap={inert ? undefined : { scale: 0.985 }}
      transition={{ type: 'spring', stiffness: 380, damping: 22 }}
      style={{
        background: inert
          ? 'rgba(255,255,255,0.06)'
          : `linear-gradient(135deg, ${primaryColor}, ${primaryColor}cc)`,
        boxShadow: inert
          ? 'none'
          : `0 10px 28px -12px ${primaryColor}aa, inset 0 1px 0 rgba(255,255,255,0.18)`,
      }}
      className={cn(
        'inline-flex h-11 min-w-[160px] items-center justify-center gap-2 rounded-lg px-5 text-sm font-medium text-white transition-colors',
        inert ? 'cursor-not-allowed text-white/40' : '',
        className,
      )}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
      {children}
    </motion.button>
  )
}

type GhostCTAProps = {
  onClick?: MouseEventHandler<HTMLButtonElement>
  type?: 'button' | 'submit' | 'reset'
  children: ReactNode
  className?: string
}

export function GhostCTA({ onClick, type = 'button', children, className }: GhostCTAProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={cn(
        'inline-flex h-9 items-center gap-1 rounded-md px-3 text-xs font-medium text-white/45 transition-colors hover:bg-white/[0.04] hover:text-white/80',
        className,
      )}
    >
      {children}
    </button>
  )
}

/* ───────────────────────────── Error ───────────────────────────── */

export function StepError({ message }: { message: string }) {
  return (
    <motion.p
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/[0.05] px-3 py-2 text-sm text-red-300"
      role="alert"
    >
      <span aria-hidden className="size-1.5 rounded-full bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.7)]" />
      {message}
    </motion.p>
  )
}
