'use client'

import { PortalDomainSetupGuide } from '@/components/settings/PortalDomainSetupGuide'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { PortalDomainSettings } from '@/lib/settings/portal-domain-actions'
import {
  clearPortalDomain,
  getPortalDomainSettings,
  savePortalDomain,
  verifyPortalDomain,
} from '@/lib/settings/portal-domain-actions'
import { cn } from '@/lib/utils'
import { CheckCircle2, Copy, ExternalLink, Globe } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'

type Props = {
  initial: PortalDomainSettings
}

function statusLabel(status: string): string {
  switch (status) {
    case 'verified':
      return 'Verified — clients use your domain'
    case 'pending':
      return 'Pending DNS'
    case 'failed':
      return 'Verification failed'
    default:
      return 'Platform URL (vanterasystem.dev)'
  }
}

function statusTone(status: string): string {
  switch (status) {
    case 'verified':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-200/80'
    case 'pending':
      return 'bg-amber-50 text-amber-800 ring-amber-200/80'
    case 'failed':
      return 'bg-red-50 text-red-700 ring-red-200/80'
    default:
      return 'bg-stone-100 text-stone-600 ring-stone-200/80'
  }
}

export function PortalDomainSettingsPanel({ initial }: Props) {
  const router = useRouter()
  const [settings, setSettings] = useState(initial)
  const [draftDomain, setDraftDomain] = useState(initial.portalDomain ?? '')
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    setSettings(initial)
    setDraftDomain(initial.portalDomain ?? '')
  }, [initial])

  function handleSave() {
    startTransition(async () => {
      const result = await savePortalDomain({ portalDomain: draftDomain })
      if (!result.success) {
        toast.error('error' in result ? result.error : 'Could not save domain')
        return
      }
      if (!result.data) {
        toast.error('Domain saved but settings could not reload')
        return
      }
      setSettings(result.data)
      setDraftDomain(result.data.portalDomain ?? '')
      toast.success(
        result.data.domainStatus === 'not_configured'
          ? 'Using platform portal URL'
          : 'Domain saved — complete DNS below, then verify',
      )
      router.refresh()
    })
  }

  function handleVerify() {
    startTransition(async () => {
      const result = await verifyPortalDomain()
      if (!result.success) {
        toast.error('error' in result ? result.error : 'Verification failed')
        const refreshed = await getPortalDomainSettings()
        if (refreshed.success && refreshed.data) setSettings(refreshed.data)
        router.refresh()
        return
      }
      if (result.data) {
        setSettings(result.data)
        toast.success('Portal domain verified — client invites will use your branded URL')
        router.refresh()
      }
    })
  }

  function handleClear() {
    startTransition(async () => {
      const result = await clearPortalDomain()
      if (!result.success) {
        toast.error('error' in result ? result.error : 'Could not clear domain')
        return
      }
      if (result.data) {
        setSettings(result.data)
        setDraftDomain('')
        toast.success('Reverted to platform portal URL')
        router.refresh()
      }
    })
  }

  async function copyText(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(`${label} copied`)
    } catch {
      toast.error('Could not copy')
    }
  }

  const activeLoginUrl =
    settings.domainStatus === 'verified' ? settings.portalLoginUrl : settings.platformLoginUrl

  return (
    <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.06em] text-stone-500">
            <Globe className="h-3.5 w-3.5" />
            Client portal
          </p>
          <h2 className="mt-1 text-base font-semibold text-stone-900">White-label portal domain</h2>
          <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-stone-500">
            Host the client portal on your own hostname so invites, login, and the signed-in
            experience never show the Vantera platform URL.
          </p>
        </div>
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset',
            statusTone(settings.domainStatus),
          )}
        >
          {settings.domainStatus === 'verified' ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : null}
          {statusLabel(settings.domainStatus)}
        </span>
      </div>

      <div className="mt-5 grid gap-4">
        <div>
          <Label htmlFor="portal-custom-domain">Portal hostname</Label>
          <Input
            id="portal-custom-domain"
            value={draftDomain}
            onChange={(event) => setDraftDomain(event.target.value)}
            placeholder="portal.yourcompany.com"
            className="mt-1.5 max-w-md"
            disabled={isPending}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={handleSave} disabled={isPending}>
            Save domain
          </Button>
          {settings.portalDomain ? (
            <>
              <Button type="button" variant="outline" onClick={handleVerify} disabled={isPending}>
                Check DNS &amp; activate
              </Button>
              <Button type="button" variant="ghost" onClick={handleClear} disabled={isPending}>
                Use platform URL
              </Button>
            </>
          ) : null}
        </div>

        <PortalDomainSetupGuide
          portalDomain={draftDomain || settings.portalDomain || ''}
          domainStatus={settings.domainStatus}
          cnameTarget={settings.dns.cnameTarget}
          vercelAutoProvision={settings.vercelAutoProvision}
        />

        {settings.dns.records.length > 0 ? (
          <div className="overflow-hidden rounded-lg border border-stone-200">
            <table className="w-full text-left text-[13px]">
              <thead className="border-b border-stone-200 bg-stone-50 text-stone-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Host</th>
                  <th className="px-3 py-2 font-medium">Value</th>
                  <th className="px-3 py-2 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {settings.dns.records.map((row) => (
                  <tr key={`${row.type}-${row.host}-${row.value}`}>
                    <td className="px-3 py-2 font-mono text-xs">{row.type}</td>
                    <td className="max-w-[140px] break-all px-3 py-2 font-mono text-xs">{row.host}</td>
                    <td className="max-w-[200px] break-all px-3 py-2 font-mono text-xs">{row.value}</td>
                    <td className="px-3 py-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => copyText(row.value, 'DNS value')}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <div className="rounded-lg border border-stone-100 bg-stone-50/80 px-4 py-3 text-[13px] text-stone-600">
          <p className="font-medium text-stone-800">Client sign-in URL (used in invites)</p>
          <p className="mt-1 break-all font-mono text-xs">{activeLoginUrl}</p>
          {settings.domainStatus !== 'verified' && settings.portalDomain ? (
            <p className="mt-2 text-amber-800">
              Until verified, invites still use the platform URL so clients are not sent to a broken
              link.
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" asChild>
              <Link href="/admin/portal/preview" target="_blank" rel="noreferrer">
                Preview portal
                <ExternalLink className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
            {activeLoginUrl ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => copyText(activeLoginUrl, 'Portal login URL')}
              >
                <Copy className="mr-1 h-3.5 w-3.5" />
                Copy URL
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}
