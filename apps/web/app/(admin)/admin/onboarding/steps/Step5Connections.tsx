'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'
import { useState } from 'react'
import { completeOnboarding, saveIntegrationCredentials } from '../actions'

const NATIVELY_HANDLED_COPY = "Don't have %SERVICE%? We handle this natively."

type ImmediateProvider = 'stripe' | 'twilio'
type PlaceholderProvider = 'quickbooks' | 'google_calendar' | 'hubspot' | 'gohighlevel'
type AnyProvider = ImmediateProvider | PlaceholderProvider

type TileBase = {
  provider: AnyProvider
  name: string
  description: string
  swatch: string
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
    swatch: '#635BFF',
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
    swatch: '#F22F46',
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
    swatch: '#2CA01C',
    kind: 'placeholder',
    buttonLabel: 'Connect QuickBooks',
    note: 'Connection coming in Phase 2 setup',
  },
  {
    provider: 'google_calendar',
    name: 'Google Calendar',
    description: 'Scheduling & availability',
    swatch: '#4285F4',
    kind: 'placeholder',
    buttonLabel: 'Connect Google Calendar',
    note: 'Connection coming in Phase 2 setup',
  },
  {
    provider: 'hubspot',
    name: 'HubSpot',
    description: 'CRM sync',
    swatch: '#FF7A59',
    kind: 'placeholder',
    buttonLabel: 'Connect HubSpot',
    note: 'Connection coming in Phase 2 setup',
  },
  {
    provider: 'gohighlevel',
    name: 'GoHighLevel',
    description: 'Marketing automation',
    swatch: '#1E3A8A',
    kind: 'placeholder',
    buttonLabel: 'Connect GoHighLevel',
    note: 'Connection coming in Phase 2 setup',
  },
]

type Props = {
  accountId: string
  primaryColor: string
  onComplete: () => void
}

export function Step5Connections({ accountId, primaryColor, onComplete }: Props) {
  const [connected, setConnected] = useState<Record<string, boolean>>({})
  const [completing, setCompleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function markConnected(provider: string) {
    setConnected((prev) => ({ ...prev, [provider]: true }))
  }

  async function handleComplete() {
    setError(null)
    setCompleting(true)

    const result = await completeOnboarding(accountId)

    setCompleting(false)

    if (!result.success) {
      setError(result.error)
      return
    }

    onComplete()
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold leading-tight tracking-tight">Connect your tools</h1>
        <p className="text-base leading-relaxed text-muted-foreground">
          Optional — bring your existing Stripe or Twilio account, or skip and use our native
          equivalents. Everything is editable later from the integrations page.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {TILES.map((tile) => (
          <IntegrationTile
            key={tile.provider}
            tile={tile}
            accountId={accountId}
            primaryColor={primaryColor}
            isConnected={connected[tile.provider] === true}
            onConnected={() => markConnected(tile.provider)}
          />
        ))}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex items-center justify-end">
        <Button
          type="button"
          size="lg"
          onClick={handleComplete}
          disabled={completing}
          style={{ backgroundColor: primaryColor }}
          className="min-w-[160px]"
        >
          {completing ? 'Finishing…' : 'Complete setup'}
        </Button>
      </div>
    </div>
  )
}

function IntegrationTile({
  tile,
  accountId,
  primaryColor,
  isConnected,
  onConnected,
}: {
  tile: Tile
  accountId: string
  primaryColor: string
  isConnected: boolean
  onConnected: () => void
}) {
  return (
    <div
      className={cn(
        'space-y-3 rounded-xl border bg-card p-4 transition-colors',
        isConnected ? 'border-emerald-200 bg-emerald-50/40' : 'hover:border-foreground/20',
      )}
    >
      <div className="flex items-start gap-3">
        <div
          aria-hidden
          style={{ backgroundColor: tile.swatch }}
          className="h-9 w-9 shrink-0 rounded-lg ring-1 ring-inset ring-black/10"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold">{tile.name}</p>
            <StatusBadge connected={isConnected} />
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">{tile.description}</p>
        </div>
      </div>

      {tile.kind === 'immediate' ? (
        <ImmediateConnectForm
          tile={tile}
          accountId={accountId}
          primaryColor={primaryColor}
          onConnected={onConnected}
        />
      ) : (
        <PlaceholderConnect tile={tile} />
      )}

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        {NATIVELY_HANDLED_COPY.replace('%SERVICE%', tile.name)}
      </p>
    </div>
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

    const result = await saveIntegrationCredentials(accountId, tile.provider, values)

    setSaving(false)

    if (!result.success) {
      setError(result.error)
      return
    }

    onConnected()
  }

  return (
    <div className="space-y-2">
      {tile.fields.map((field) => (
        <Input
          key={field.key}
          type={field.type}
          placeholder={field.label}
          value={values[field.key] ?? ''}
          onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
          autoComplete="off"
        />
      ))}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <Button
        type="button"
        size="sm"
        onClick={handleSave}
        disabled={saving}
        style={{ backgroundColor: primaryColor }}
        className="w-full"
      >
        {saving ? 'Verifying…' : `Connect ${tile.name}`}
      </Button>
    </div>
  )
}

function PlaceholderConnect({ tile }: { tile: PlaceholderTile }) {
  return (
    <div className="space-y-2">
      <Button type="button" size="sm" variant="outline" disabled className="w-full">
        {tile.buttonLabel}
      </Button>
      <p className="text-xs text-muted-foreground">{tile.note}</p>
    </div>
  )
}

function StatusBadge({ connected }: { connected: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
        connected ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground',
      )}
    >
      {connected ? <Check className="h-3 w-3" /> : null}
      {connected ? 'Connected' : 'Not connected'}
    </span>
  )
}
