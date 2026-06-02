'use client'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useOnboardingNav, useRegisterOnboardingStep } from '../onboarding-nav'
import { completeOnboarding, saveIntegrationCredentials } from '../actions'
import { StepError, fadeUp, rethrowFrameworkNavigation, runStepAction, stepContainer } from '../_primitives'

type ImmediateProvider = 'stripe' | 'twilio'
type PlaceholderProvider = 'quickbooks' | 'google_calendar' | 'hubspot' | 'gohighlevel'
type AnyProvider = ImmediateProvider | PlaceholderProvider

type TileBase = {
  provider: AnyProvider
  name: string
  description: string
  monogram: string
  /** Two-stop gradient for the icon swatch (matches the screenshot's tiles). */
  gradient: [string, string]
  /** Sub-line of small uppercase tags (e.g. "SALES · SMS · FUNNELS"). */
  tags: string[]
}

type ImmediateTile = TileBase & {
  provider: ImmediateProvider
  kind: 'immediate'
  fields: Array<{ key: string; label: string; type: 'text' | 'password' }>
}

type PlaceholderTile = TileBase & {
  provider: PlaceholderProvider
  kind: 'placeholder'
  buttonLabel: string
  note: string
}

type Tile = ImmediateTile | PlaceholderTile

const TILES: Tile[] = [
  {
    provider: 'stripe',
    name: 'Stripe',
    description: 'Payments & invoicing',
    monogram: 'S',
    gradient: ['#635BFF', '#7A6BFF'],
    tags: ['Payments', 'Invoices'],
    kind: 'immediate',
    fields: [
      { key: 'secretKey', label: 'Secret key', type: 'password' },
      { key: 'publishableKey', label: 'Publishable key', type: 'text' },
    ],
  },
  {
    provider: 'twilio',
    name: 'Twilio',
    description: 'SMS & phone calls',
    monogram: 'T',
    gradient: ['#F22F46', '#F65A6E'],
    tags: ['SMS', 'Voice', 'Numbers'],
    kind: 'immediate',
    fields: [
      { key: 'accountSid', label: 'Account SID', type: 'text' },
      { key: 'authToken', label: 'Auth token', type: 'password' },
      { key: 'phoneNumber', label: 'Phone number', type: 'text' },
    ],
  },
  {
    provider: 'quickbooks',
    name: 'QuickBooks',
    description: 'Accounting & invoices',
    monogram: 'QB',
    gradient: ['#2CA01C', '#5BC74B'],
    tags: ['Accounting', 'Books'],
    kind: 'placeholder',
    buttonLabel: 'Connect QuickBooks',
    note: 'Coming in Phase 2',
  },
  {
    provider: 'google_calendar',
    name: 'Google Calendar',
    description: 'Scheduling & availability',
    monogram: 'GC',
    gradient: ['#4285F4', '#5B9DF9'],
    tags: ['Calendar', 'Scheduling'],
    kind: 'placeholder',
    buttonLabel: 'Connect Google Calendar',
    note: 'Coming in Phase 2',
  },
  {
    provider: 'hubspot',
    name: 'HubSpot',
    description: 'Sales sync',
    monogram: 'HS',
    gradient: ['#FF7A59', '#FFA37C'],
    tags: ['Sales', 'Pipeline', 'Opportunities'],
    kind: 'placeholder',
    buttonLabel: 'Connect HubSpot',
    note: 'Coming in Phase 2',
  },
  {
    provider: 'gohighlevel',
    name: 'GoHighLevel',
    description: 'Marketing automation',
    monogram: 'GHL',
    gradient: ['#1E3A8A', '#3B6FE0'],
    tags: ['Sales', 'SMS', 'Funnels'],
    kind: 'placeholder',
    buttonLabel: 'Connect GoHighLevel',
    note: 'Coming in Phase 2',
  },
]

type Props = {
  accountId: string
  primaryColor: string
  onComplete: () => void
}

export function Step5Connections({ accountId, primaryColor, onComplete }: Props) {
  const [connected, setConnected] = useState<Record<string, boolean>>({})
  const [openTile, setOpenTile] = useState<string | null>(null)
  const [completing, setCompleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function markConnected(provider: string) {
    setConnected((prev) => ({ ...prev, [provider]: true }))
    setOpenTile(null)
  }

  const embedded = Boolean(useOnboardingNav())

  const submit = useCallback(async (): Promise<boolean> => {
    setError(null)
    setCompleting(true)

    try {
      const result = await runStepAction(() => completeOnboarding(accountId))

      if (!result || result.success !== true) {
        setError(
          (result && 'error' in result && result.error) ||
            'Could not finalize onboarding. Please try again.',
        )
        return false
      }

      const redirectTo =
        result.data && typeof result.data === 'object' && 'redirectTo' in result.data
          ? String((result.data as { redirectTo?: string }).redirectTo ?? '')
          : '/admin/dashboard'

      try {
        window.localStorage.removeItem(`vantera_onboarding_step_${accountId}`)
      } catch {
        /* ignore */
      }

      onComplete()

      if (embedded) {
        return true
      }

      window.location.replace(redirectTo || '/admin/dashboard')
      return true
    } catch (err) {
      rethrowFrameworkNavigation(err)
      console.error('[Step5Connections] completeOnboarding threw', err)
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      return false
    } finally {
      setCompleting(false)
    }
  }, [accountId, embedded, onComplete])

  useRegisterOnboardingStep({
    canAdvance: true,
    isSubmitting: completing,
    primaryLabel: completing ? 'Finishing…' : 'Finish setup',
    submit,
  })

  const connectedCount = Object.values(connected).filter(Boolean).length

  return (
    <motion.div variants={stepContainer} initial="hidden" animate="show" className="space-y-3">
      <motion.div variants={fadeUp} className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {TILES.map((tile) => (
          <IntegrationTile
            key={tile.provider}
            tile={tile}
            accountId={accountId}
            primaryColor={primaryColor}
            isOpen={openTile === tile.provider}
            isConnected={connected[tile.provider] === true}
            onOpen={() => setOpenTile(openTile === tile.provider ? null : tile.provider)}
            onConnected={() => markConnected(tile.provider)}
          />
        ))}
      </motion.div>

      {error ? <StepError message={error} /> : null}

      <motion.p variants={fadeUp} className="text-xs text-[var(--text-tertiary)]">
        {connectedCount > 0
          ? `${connectedCount} connection${connectedCount > 1 ? 's' : ''} added`
          : 'No connections yet — you can connect tools anytime from settings.'}
      </motion.p>
    </motion.div>
  )
}

function IntegrationTile({
  tile,
  accountId,
  primaryColor,
  isOpen,
  isConnected,
  onOpen,
  onConnected,
}: {
  tile: Tile
  accountId: string
  primaryColor: string
  isOpen: boolean
  isConnected: boolean
  onOpen: () => void
  onConnected: () => void
}) {
  const [g1, g2] = tile.gradient

  return (
    <motion.div
      layout
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 320, damping: 24 }}
      className={cn(
        'group relative overflow-hidden rounded-2xl border bg-white/[0.02] p-5 transition-colors',
        isConnected
          ? 'border-emerald-400/30'
          : isOpen
            ? 'border-white/[0.14]'
            : 'border-white/[0.06] hover:border-white/[0.14] hover:bg-white/[0.035]',
      )}
    >
      {/* Brand-colored corner glow — same vocabulary as the dashboard KPI tiles. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-12 -top-12 size-32 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-60"
        style={{ background: `radial-gradient(circle at center, ${g1}55, transparent 70%)` }}
      />

      <div className="relative">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            style={{
              background: `linear-gradient(135deg, ${g1}, ${g2})`,
              boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.12), 0 8px 20px -8px ${g1}66`,
            }}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-semibold text-white"
          >
            {tile.monogram}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{tile.name}</p>
                <p className="mt-0.5 truncate text-xs text-white/50">{tile.description}</p>
              </div>
              <StatusPill
                connected={isConnected}
                kind={tile.kind}
                onClick={tile.kind === 'immediate' && !isConnected ? onOpen : undefined}
                isOpen={isOpen}
              />
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {tile.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] font-medium uppercase tracking-wider text-white/40"
                >
                  {tag}
                </span>
              )).reduce<React.ReactNode[]>((acc, el, idx, arr) => {
                acc.push(el)
                if (idx < arr.length - 1) {
                  acc.push(
                    <span key={`dot-${idx}`} aria-hidden className="text-white/20">
                      ·
                    </span>,
                  )
                }
                return acc
              }, [])}
            </div>
          </div>
        </div>

        {/* Expandable credential form for immediate-connect providers. */}
        <motion.div
          initial={false}
          animate={{
            height: isOpen && tile.kind === 'immediate' && !isConnected ? 'auto' : 0,
            opacity: isOpen && tile.kind === 'immediate' && !isConnected ? 1 : 0,
          }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden"
        >
          {tile.kind === 'immediate' ? (
            <div className="pt-4">
              <ImmediateConnectForm
                tile={tile}
                accountId={accountId}
                primaryColor={primaryColor}
                onConnected={onConnected}
              />
            </div>
          ) : null}
        </motion.div>
      </div>
    </motion.div>
  )
}

function StatusPill({
  connected,
  kind,
  onClick,
  isOpen,
}: {
  connected: boolean
  kind: 'immediate' | 'placeholder'
  onClick?: () => void
  isOpen: boolean
}) {
  if (connected) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
        <Check className="h-3 w-3" aria-hidden />
        Connected
      </span>
    )
  }

  if (kind === 'immediate') {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition-colors',
          isOpen
            ? 'border-white/20 bg-white/10 text-white'
            : 'border-emerald-400/30 bg-emerald-400/[0.06] text-emerald-300 hover:border-emerald-400/50 hover:bg-emerald-400/[0.1]',
        )}
      >
        {isOpen ? 'Cancel' : 'Connect'}
      </button>
    )
  }

  return (
    <span className="inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/50">
      Available
    </span>
  )
}

function ImmediateConnectForm({
  tile,
  accountId,
  primaryColor,
  onConnected,
}: {
  tile: ImmediateTile
  accountId: string
  primaryColor: string
  onConnected: () => void
}) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    const requiredKeys = tile.fields.filter((f) => f.type === 'password').map((f) => f.key)
    const missing = requiredKeys.find((k) => !values[k] || values[k]?.trim() === '')

    if (missing) {
      setError('Fill in all required fields')
      return
    }

    setError(null)
    setSaving(true)

    try {
      const result = await runStepAction(() =>
        saveIntegrationCredentials(accountId, tile.provider, values),
      )

      if (!result || result.success !== true) {
        setError(
          (result && 'error' in result && result.error) ||
            'Could not verify credentials. Please double-check and try again.',
        )
        return
      }

      onConnected()
    } catch (err) {
      rethrowFrameworkNavigation(err)
      console.error('[ImmediateConnectForm] saveIntegrationCredentials threw', err)
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-2 border-t border-white/[0.06] pt-4">
      {tile.fields.map((field) => (
        <div key={field.key} className="space-y-1">
          <label htmlFor={`${tile.provider}-${field.key}`} className="text-[11px] text-white/55">
            {field.label}
          </label>
          <Input
            id={`${tile.provider}-${field.key}`}
            type={field.type}
            placeholder={field.label}
            value={values[field.key] ?? ''}
            onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
            autoComplete="off"
            className="h-10 border-white/[0.08] bg-white/[0.02] text-sm text-white placeholder:text-white/30 focus-visible:border-white/[0.2] focus-visible:ring-1 focus-visible:ring-white/10"
          />
        </div>
      ))}
      {error ? (
        <p className="rounded-md bg-red-500/[0.08] px-2 py-1.5 text-[11px] text-red-300">{error}</p>
      ) : null}
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        style={{
          background: saving
            ? 'rgba(255,255,255,0.06)'
            : `linear-gradient(135deg, ${primaryColor}, ${primaryColor}cc)`,
          boxShadow: saving
            ? 'none'
            : `0 8px 20px -10px ${primaryColor}aa, inset 0 1px 0 rgba(255,255,255,0.18)`,
        }}
        className="mt-1 inline-flex h-9 w-full items-center justify-center rounded-md text-xs font-medium text-white transition-colors disabled:cursor-not-allowed disabled:text-white/40"
      >
        {saving ? 'Verifying…' : `Connect ${tile.name}`}
      </button>
    </div>
  )
}
