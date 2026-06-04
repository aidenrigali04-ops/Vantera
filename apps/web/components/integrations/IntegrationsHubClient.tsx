'use client'

import { CrmConnectionsSection } from '@/components/integrations/IntegrationsPageClient'
import { PageHeader } from '@/components/operational/PageHeader'
import { OutreachDomainSettingsPanel } from '@/components/settings/OutreachDomainSettings'
import type { OutreachDomainSettings } from '@/lib/settings/outreach-domain-actions'
import type { CrmConnectionStatus } from '@/lib/integrations/types'
import { cn } from '@/lib/utils'
import { ArrowDownToLine, Mail, Plug, Settings2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

type Props = {
  connections: CrmConnectionStatus[]
  outreachDomain: OutreachDomainSettings
}

const NAV = [
  { id: 'crm', label: 'CRM', icon: Plug },
  { id: 'email', label: 'Email domain', icon: Mail },
  { id: 'tools', label: 'Import & billing', icon: ArrowDownToLine },
] as const

type SectionId = (typeof NAV)[number]['id']

export function IntegrationsHubClient({ connections, outreachDomain }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeSection, setActiveSection] = useState<SectionId>('crm')
  const [domainSettings, setDomainSettings] = useState(outreachDomain)

  useEffect(() => {
    setDomainSettings(outreachDomain)
  }, [outreachDomain])

  useEffect(() => {
    const section = searchParams.get('section')
    if (section === 'email' || section === 'crm' || section === 'tools') {
      setActiveSection(section)
    }
  }, [searchParams])

  const setSection = useCallback(
    (id: SectionId) => {
      setActiveSection(id)
      const params = new URLSearchParams(searchParams.toString())
      params.set('section', id)
      router.replace(`/admin/integrations?${params.toString()}`, { scroll: false })
    },
    [router, searchParams],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integrations"
        description="Connect external CRMs, configure outreach email DNS, and manage data import."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/settings">
              <Settings2 className="mr-1.5 h-3.5 w-3.5" />
              Workspace settings
            </Link>
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start">
        <nav className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setSection(id)}
              className={cn(
                'inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors',
                activeSection === id
                  ? 'bg-[var(--text-primary)] text-[var(--text-inverse)]'
                  : 'border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]',
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </button>
          ))}
        </nav>

        <div className="min-w-0 space-y-6">
          {activeSection === 'crm' ? (
            <section className="card-surface p-5 sm:p-6">
              <div className="mb-5">
                <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
                  CRM connections
                </h2>
                <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-secondary)]">
                  Import and export pipeline leads with HubSpot, GoHighLevel, or Salesforce.
                </p>
              </div>
              <CrmConnectionsSection connections={connections} />
            </section>
          ) : null}

          {activeSection === 'email' ? (
            <OutreachDomainSettingsPanel
              initial={domainSettings}
              embedded
              onSaved={() => router.refresh()}
            />
          ) : null}

          {activeSection === 'tools' ? (
            <section className="card-surface space-y-4 p-5 sm:p-6">
              <div>
                <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
                  Import & billing
                </h2>
                <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-secondary)]">
                  Spreadsheet import, pipeline export, and subscription management.
                </p>
              </div>
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/60 p-4">
                <p className="text-sm font-medium text-[var(--text-primary)]">CSV import / export</p>
                <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
                  Import leads from the dashboard or export your pipeline anytime.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/admin/dashboard">Import CSV from dashboard</Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      window.location.href = '/api/leads/export'
                    }}
                  >
                    <ArrowDownToLine className="mr-1.5 h-3.5 w-3.5" />
                    Export pipeline CSV
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/admin/crm/pipeline">Open pipeline</Link>
                  </Button>
                </div>
              </div>
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/60 p-4">
                <p className="text-sm font-medium text-[var(--text-primary)]">Vantera plan</p>
                <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
                  Manage subscription and payment method in Stripe.
                </p>
                <Button variant="outline" size="sm" className="mt-4" asChild>
                  <Link href="/admin/billing">Plan &amp; billing</Link>
                </Button>
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  )
}
