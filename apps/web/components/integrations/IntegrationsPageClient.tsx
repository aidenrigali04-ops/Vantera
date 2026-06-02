'use client'

import { PageHeader } from '@/components/operational/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  connectCrmAction,
  disconnectCrmAction,
  exportCrmLeadsAction,
  importCrmLeadsAction,
} from '@/lib/integrations/actions'
import {
  CRM_PROVIDER_DESCRIPTIONS,
  CRM_PROVIDER_LABELS,
  CRM_PROVIDERS,
  type CrmConnectionStatus,
  type CrmProvider,
} from '@/lib/integrations/types'
import { cn } from '@/lib/utils'
import { ArrowDownToLine, ArrowUpFromLine, Check, Plug, Unplug } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

type Props = {
  connections: CrmConnectionStatus[]
}

const PROVIDER_STYLES: Record<CrmProvider, { monogram: string; gradient: string }> = {
  hubspot: { monogram: 'HS', gradient: 'from-[#FF7A59] to-[#FFA37C]' },
  gohighlevel: { monogram: 'GHL', gradient: 'from-[#1E3A8A] to-[#3B6FE0]' },
  salesforce: { monogram: 'SF', gradient: 'from-[#00A1E0] to-[#1798C1]' },
}

const CREDENTIAL_FIELDS: Record<
  CrmProvider,
  Array<{ key: string; label: string; type?: string; placeholder?: string }>
> = {
  hubspot: [
    {
      key: 'accessToken',
      label: 'Private app access token',
      type: 'password',
      placeholder: 'pat-na1-...',
    },
  ],
  gohighlevel: [
    { key: 'accessToken', label: 'API key', type: 'password', placeholder: 'GHL API key' },
    { key: 'locationId', label: 'Location ID', placeholder: 'Sub-account location ID' },
  ],
  salesforce: [
    { key: 'instanceUrl', label: 'Instance URL', placeholder: 'https://yourorg.my.salesforce.com' },
    { key: 'accessToken', label: 'Access token', type: 'password', placeholder: 'OAuth or session token' },
    {
      key: 'refreshToken',
      label: 'Refresh token (optional)',
      type: 'password',
      placeholder: 'For token refresh',
    },
  ],
}

export function IntegrationsPageClient({ connections }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [openProvider, setOpenProvider] = useState<CrmProvider | null>(null)
  const [forms, setForms] = useState<Record<string, Record<string, string>>>({})

  const connectionMap = Object.fromEntries(connections.map((row) => [row.provider, row])) as Record<
    CrmProvider,
    CrmConnectionStatus
  >

  function updateField(provider: CrmProvider, key: string, value: string) {
    setForms((current) => ({
      ...current,
      [provider]: { ...current[provider], [key]: value },
    }))
  }

  function handleConnect(provider: CrmProvider) {
    startTransition(async () => {
      const result = await connectCrmAction(provider, forms[provider] ?? {})
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success(`${CRM_PROVIDER_LABELS[provider]} connected`)
      setOpenProvider(null)
      router.refresh()
    })
  }

  function handleDisconnect(provider: CrmProvider) {
    startTransition(async () => {
      const result = await disconnectCrmAction(provider)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success(`${CRM_PROVIDER_LABELS[provider]} disconnected`)
      router.refresh()
    })
  }

  function handleImport(provider: CrmProvider) {
    startTransition(async () => {
      const result = await importCrmLeadsAction(provider)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      const { imported = 0, updated = 0, skipped = 0, errors } = result.data
      if (errors.length > 0) {
        toast.error(errors[0] ?? 'Import completed with errors')
      } else {
        toast.success(`Imported ${imported}, updated ${updated}, skipped ${skipped}`)
      }
      router.refresh()
    })
  }

  function handleExport(provider: CrmProvider) {
    startTransition(async () => {
      const result = await exportCrmLeadsAction(provider)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      const { exported = 0, skipped = 0, errors } = result.data
      if (errors.length > 0) {
        toast.warning(`Exported ${exported}, ${errors.length} failed`)
      } else {
        toast.success(`Exported ${exported} leads${skipped ? ` (${skipped} skipped)` : ''}`)
      }
      router.refresh()
    })
  }

  function handleCsvExport() {
    window.location.href = '/api/leads/export'
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Integrations"
        description="Connect HubSpot, GoHighLevel, and Salesforce to import and export pipeline leads."
        actions={
          <Button variant="outline" asChild>
            <Link href="/admin/settings">Workspace settings</Link>
          </Button>
        }
      />

      <section className="rounded-xl border border-stone-200 bg-stone-50/60 p-5">
        <h3 className="text-sm font-semibold text-stone-900">Vantera plan</h3>
        <p className="mt-1 text-sm text-stone-600">
          Upgrade to Team, manage your subscription, or update your payment method in Stripe.
        </p>
        <Button variant="outline" size="sm" className="mt-4" asChild>
          <Link href="/admin/billing">Plan &amp; billing</Link>
        </Button>
      </section>

      <section className="rounded-xl border border-stone-200 bg-stone-50/60 p-5">
        <h3 className="text-sm font-semibold text-stone-900">CSV import / export</h3>
        <p className="mt-1 text-sm text-stone-600">
          No CRM connected yet? Import leads from a spreadsheet or export your pipeline anytime.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/dashboard">Import CSV from dashboard</Link>
          </Button>
          <Button variant="outline" size="sm" onClick={handleCsvExport}>
            <ArrowDownToLine className="mr-1.5 h-3.5 w-3.5" />
            Export pipeline CSV
          </Button>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        {CRM_PROVIDERS.map((provider) => {
          const connection = connectionMap[provider]
          const style = PROVIDER_STYLES[provider]
          const isOpen = openProvider === provider
          const connected = connection?.connected

          return (
            <article
              key={provider}
              className="flex flex-col rounded-xl border border-stone-200 bg-white shadow-sm"
            >
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <span
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br text-xs font-bold text-white',
                      style.gradient,
                    )}
                  >
                    {style.monogram}
                  </span>
                  {connected ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200/80">
                      <Check className="h-3 w-3" />
                      Connected
                    </span>
                  ) : (
                    <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600">
                      Not connected
                    </span>
                  )}
                </div>

                <h3 className="mt-4 text-base font-semibold text-stone-900">
                  {CRM_PROVIDER_LABELS[provider]}
                </h3>
                <p className="mt-1 text-sm text-stone-600">{CRM_PROVIDER_DESCRIPTIONS[provider]}</p>

                {connected && connection.metadata?.locationId ? (
                  <p className="mt-2 text-xs text-stone-500">
                    Location: {connection.metadata.locationId}
                  </p>
                ) : null}
                {connected && connection.metadata?.instanceUrl ? (
                  <p className="mt-2 truncate text-xs text-stone-500">
                    {connection.metadata.instanceUrl}
                  </p>
                ) : null}
              </div>

              <div className="mt-auto border-t border-stone-100 p-4 space-y-2">
                {connected ? (
                  <>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        disabled={isPending}
                        onClick={() => handleImport(provider)}
                      >
                        <ArrowDownToLine className="mr-1 h-3.5 w-3.5" />
                        Import
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        disabled={isPending}
                        onClick={() => handleExport(provider)}
                      >
                        <ArrowUpFromLine className="mr-1 h-3.5 w-3.5" />
                        Export
                      </Button>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="w-full text-stone-600"
                      disabled={isPending}
                      onClick={() => handleDisconnect(provider)}
                    >
                      <Unplug className="mr-1 h-3.5 w-3.5" />
                      Disconnect
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    className="w-full bg-stone-900 hover:bg-stone-800"
                    disabled={isPending}
                    onClick={() => setOpenProvider(isOpen ? null : provider)}
                  >
                    <Plug className="mr-1.5 h-3.5 w-3.5" />
                    {isOpen ? 'Cancel' : 'Connect'}
                  </Button>
                )}

                {isOpen && !connected ? (
                  <div className="space-y-3 pt-2">
                    {CREDENTIAL_FIELDS[provider].map((field) => (
                      <div key={field.key}>
                        <Label className="text-xs">{field.label}</Label>
                        <Input
                          type={field.type ?? 'text'}
                          placeholder={field.placeholder}
                          className="mt-1"
                          value={forms[provider]?.[field.key] ?? ''}
                          onChange={(event) =>
                            updateField(provider, field.key, event.target.value)
                          }
                        />
                      </div>
                    ))}
                    <Button
                      size="sm"
                      className="w-full"
                      disabled={isPending}
                      onClick={() => handleConnect(provider)}
                    >
                      Save connection
                    </Button>
                  </div>
                ) : null}
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
