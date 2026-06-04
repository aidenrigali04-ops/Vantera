'use client'

import { PortalActivityFeed } from '@/components/portal/PortalActivityFeed'
import { PortalApprovalsPanel } from '@/components/portal/PortalApprovalsPanel'
import { PortalBillingSummary } from '@/components/portal/PortalBillingSummary'
import { PortalKpiStrip } from '@/components/portal/PortalKpiStrip'
import { PortalPageHeader } from '@/components/portal/PortalPageHeader'
import { PortalProjectCard } from '@/components/portal/PortalProjectCard'
import { PortalSection } from '@/components/portal/PortalSection'
import { PortalServicesFeatures } from '@/components/portal/PortalServicesFeatures'
import { usePortalShell } from '@/lib/portal/context'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Calendar, Mail, Phone } from 'lucide-react'

type PortalOverviewViewProps = {
  preview?: boolean
}

export function PortalOverviewView({ preview = false }: PortalOverviewViewProps) {
  const { workspace } = usePortalShell()
  const { config } = workspace
  const contactName = workspace.contactFirstName
  const activeProjects = workspace.projects.filter((p) => p.progress < 100).slice(0, 4)
  const recentActivity = workspace.activities.slice(0, 5)
  const showServices =
    config.showServicesOnOverview &&
    (config.services.length > 0 || config.features.length > 0)

  return (
    <>
      <PortalPageHeader
        eyebrow={config.tagline}
        title={config.welcomeTitle.replace(/\{name\}/gi, contactName)}
        subtitle={config.welcomeMessage}
      />

      <div className="space-y-8">
        <PortalKpiStrip workspace={workspace} />

        {(config.supportEmail || config.supportPhone || config.bookingLink) && (
          <div className="flex flex-wrap gap-3">
            {config.supportEmail ? (
              <Button variant="outline" size="sm" asChild className="border-[var(--border-default)]">
                <a href={`mailto:${config.supportEmail}`}>
                  <Mail className="mr-2 h-4 w-4" aria-hidden />
                  Email support
                </a>
              </Button>
            ) : null}
            {config.supportPhone ? (
              <Button variant="outline" size="sm" asChild className="border-[var(--border-default)]">
                <a href={`tel:${config.supportPhone}`}>
                  <Phone className="mr-2 h-4 w-4" aria-hidden />
                  Call
                </a>
              </Button>
            ) : null}
            {config.bookingLink ? (
              <Button variant="outline" size="sm" asChild className="border-[var(--border-default)]">
                <a href={config.bookingLink} target="_blank" rel="noopener noreferrer">
                  <Calendar className="mr-2 h-4 w-4" aria-hidden />
                  Book a call
                </a>
              </Button>
            ) : null}
          </div>
        )}

        {showServices ? <PortalServicesFeatures config={config} /> : null}

        <div className="grid gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-8">
            {config.sections.projects.enabled ? (
              <PortalSection
                title="Active work"
                subtitle="Projects currently in flight."
                action={
                  workspace.projects.length > 0
                    ? { label: 'View all', href: preview ? '#' : '/portal/projects' }
                    : undefined
                }
              >
                {activeProjects.length === 0 ? (
                  <p className="text-[13px] text-[var(--text-secondary)]">
                    No active projects yet. Your team will add work here as delivery begins.
                  </p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {activeProjects.map((project) => (
                      <PortalProjectCard key={project.id} project={project} />
                    ))}
                  </div>
                )}
              </PortalSection>
            ) : null}

            {config.sections.activity.enabled && recentActivity.length > 0 ? (
              <PortalSection
                title="Recent updates"
                subtitle="Latest activity from your account team."
                action={{ label: 'View all', href: preview ? '#' : '/portal/activity' }}
              >
                <PortalActivityFeed activities={recentActivity} />
              </PortalSection>
            ) : null}
          </div>

          <div className="space-y-6 lg:col-span-4">
            {config.sections.billing.enabled ? (
              <PortalSection title="Billing snapshot" subtitle="Balance and open invoices.">
                <PortalBillingSummary billing={workspace.billing} />
                {!preview && workspace.billing.outstandingCents > 0 ? (
                  <Link
                    href="/portal/billing"
                    className="mt-4 inline-block text-[13px] font-medium text-[var(--accent)] hover:text-[var(--accent-hover)]"
                  >
                    Manage billing →
                  </Link>
                ) : null}
              </PortalSection>
            ) : null}

            {workspace.approvals.length > 0 ? (
              <PortalSection title="Needs your attention" subtitle="Pending approvals.">
                <PortalApprovalsPanel approvals={workspace.approvals.slice(0, 3)} />
              </PortalSection>
            ) : null}

            {config.sections.messages.enabled && workspace.unreadMessageCount > 0 ? (
              <PortalSection title="Messages" subtitle="Unread from your team.">
                <p className="text-[13px] text-[var(--text-secondary)]">
                  You have {workspace.unreadMessageCount} unread{' '}
                  {workspace.unreadMessageCount === 1 ? 'message' : 'messages'}.
                </p>
                {!preview ? (
                  <Link
                    href="/portal/messages"
                    className="mt-3 inline-block text-[13px] font-medium text-[var(--accent)]"
                  >
                    Open inbox →
                  </Link>
                ) : null}
              </PortalSection>
            ) : null}
          </div>
        </div>
      </div>
    </>
  )
}
