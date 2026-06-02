'use client'

import { cn } from '@/lib/utils'
import { motion, type Variants } from 'framer-motion'
import { Check, Loader2, type LucideIcon } from 'lucide-react'
import type { MouseEventHandler, ReactNode } from 'react'
import { useOnboardingNav } from './onboarding-nav'

function useWizardTheme(): 'light' | 'dark' {
  return useOnboardingNav() ? 'light' : 'dark'
}

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
  const theme = useWizardTheme()
  if (theme === 'light') return null

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
  const theme = useWizardTheme()
  return (
    <motion.section variants={fadeUp} className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <label
          className={cn(
            'text-sm font-semibold',
            theme === 'light' ? 'text-[var(--text-primary)]' : 'text-white',
          )}
        >
          {label}
        </label>
        {right}
      </div>
      {description ? (
        <p
          className={cn(
            'text-xs leading-relaxed',
            theme === 'light' ? 'text-[var(--text-tertiary)]' : 'text-white/45',
          )}
        >
          {description}
        </p>
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
  const theme = useWizardTheme()
  const accent = iconColor ?? primaryColor

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.99 }}
      transition={{ type: 'spring', stiffness: 380, damping: 26 }}
      className={cn(
        'group relative overflow-hidden rounded-lg border p-3 text-left transition-colors duration-[120ms]',
        'focus-visible:outline-none focus-visible:shadow-[var(--shadow-glow)]',
        theme === 'light'
          ? cn(
              'bg-[var(--bg-surface)]',
              selected
                ? 'border-[var(--brand-accent-border)] bg-[var(--brand-accent-muted)]'
                : 'border-[var(--border-default)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-subtle)]',
            )
          : cn(
              'rounded-2xl bg-white/[0.02] p-4',
              selected
                ? 'border-[var(--brand-accent-border)] bg-white/[0.04]'
                : 'border-white/[0.06] hover:border-white/[0.14] hover:bg-white/[0.035]',
            ),
        layout === 'horizontal' ? 'flex items-start gap-3' : 'flex flex-col gap-2.5',
        className,
      )}
    >
      <div className="flex w-full items-start justify-between gap-2">
        {Icon ? (
          <span
            aria-hidden
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ring-[var(--border-subtle)]"
            style={{
              backgroundColor: `${accent}14`,
              color: selected ? accent : 'var(--text-tertiary)',
            }}
          >
            <Icon className="h-4 w-4 transition-colors" aria-hidden />
          </span>
        ) : (
          <span aria-hidden />
        )}

        {theme === 'light' ? (
          selected ? (
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--text-primary)] text-[var(--text-inverse)]">
              <Check className="h-3 w-3" aria-hidden />
            </span>
          ) : (
            <span
              className="h-5 w-5 shrink-0 rounded-full border border-[var(--border-default)] bg-[var(--bg-subtle)] opacity-0 transition-opacity duration-[120ms] group-hover:opacity-100"
              aria-hidden
            />
          )
        ) : null}
      </div>

      <div className="relative min-w-0 flex-1">
        <p
          className={cn(
            'text-[13px] font-medium leading-snug',
            theme === 'light' ? 'text-[var(--text-primary)]' : selected ? 'text-white' : 'text-white/90',
          )}
        >
          {title}
        </p>
        {description ? (
          <p
            className={cn(
              'mt-1 text-[12px] leading-relaxed',
              theme === 'light' ? 'text-[var(--text-secondary)]' : 'text-white/50',
            )}
          >
            {description}
          </p>
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
  if (useWizardTheme() === 'light') return null

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
  if (useWizardTheme() === 'light') return null

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
  const theme = useWizardTheme()
  return (
    <motion.p
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm',
        theme === 'light'
          ? 'border-[var(--danger)]/30 bg-[var(--danger-muted)] text-[var(--danger)]'
          : 'border-red-500/20 bg-red-500/[0.05] text-red-300',
      )}
      role="alert"
    >
      <span
        aria-hidden
        className={cn(
          'size-1.5 rounded-full',
          theme === 'light' ? 'bg-[var(--danger)]' : 'bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.7)]',
        )}
      />
      {message}
    </motion.p>
  )
}
