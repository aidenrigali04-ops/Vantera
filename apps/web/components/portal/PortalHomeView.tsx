import { DashboardSection } from '@/components/dashboard/DashboardSection'
import { PortalActivityFeed } from '@/components/portal/PortalActivityFeed'
import { PortalApprovalsPanel } from '@/components/portal/PortalApprovalsPanel'
import { PortalBillingSummary } from '@/components/portal/PortalBillingSummary'
import { PortalDeliverablesList } from '@/components/portal/PortalDeliverablesList'
import { PortalDocumentsPanel } from '@/components/portal/PortalDocumentsPanel'
import { PortalHeader } from '@/components/portal/PortalHeader'
import { PortalInvoicesPanel } from '@/components/portal/PortalInvoicesPanel'
import { PortalKpiStrip } from '@/components/portal/PortalKpiStrip'
import { PortalMessagesPanel } from '@/components/portal/PortalMessagesPanel'
import { PortalProjectCard } from '@/components/portal/PortalProjectCard'
import type { PortalWorkspace } from '@/lib/portal/types'

type PortalHomeViewProps = {
  workspace: PortalWorkspace
  preview?: boolean
}

export function PortalHomeView({ workspace, preview = false }: PortalHomeViewProps) {
  const contactName = workspace.contactFirstName
  const hasProjects = workspace.projects.length > 0
  const hasContent =
    hasProjects ||
    workspace.invoices.length > 0 ||
    workspace.documents.length > 0 ||
    workspace.messages.length > 0 ||
    workspace.activities.length > 0

  return (
    <div className="min-h-full">
      <PortalHeader contactName={contactName} preview={preview} />

      <main className="mx-auto max-w-6xl space-y-8 px-6 py-8 sm:px-8">
        <PortalKpiStrip workspace={workspace} />

        {!hasContent ? (
          <div className="rounded-xl border border-dashed border-[var(--border-default)] bg-[var(--bg-surface)] px-6 py-16 text-center">
            <p className="text-sm font-medium text-[var(--text-primary)]">
              Your workspace is being set up
            </p>
            <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-[var(--text-secondary)]">
              Your team will add projects, documents, and billing here. You can message them anytime
              using the panel below.
            </p>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-12">
            <div className="space-y-8 lg:col-span-8">
              {hasProjects ? (
                <DashboardSection
                  title="Active projects"
                  subtitle="Track delivery progress across everything in flight."
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    {workspace.projects.map((project) => (
                      <PortalProjectCard key={project.id} project={project} />
                    ))}
                  </div>
                </DashboardSection>
              ) : null}

              <DashboardSection
                title="Messages"
                subtitle="Direct line to your account team — replies show up here."
              >
                <PortalMessagesPanel messages={workspace.messages} />
              </DashboardSection>

              <DashboardSection
                title="Activity"
                subtitle="Updates your team shares with you."
              >
                <PortalActivityFeed activities={workspace.activities} />
              </DashboardSection>
            </div>

            <div className="space-y-8 lg:col-span-4">
              <DashboardSection
                title="Billing"
                subtitle="Outstanding balance and invoices."
              >
                <PortalBillingSummary billing={workspace.billing} />
                <div className="mt-4 border-t border-[var(--border-subtle)] pt-4">
                  <PortalInvoicesPanel invoices={workspace.invoices} />
                </div>
              </DashboardSection>

              {workspace.approvals.length > 0 ? (
                <DashboardSection
                  title="Approvals"
                  subtitle="Items waiting for your sign-off."
                >
                  <PortalApprovalsPanel approvals={workspace.approvals} />
                </DashboardSection>
              ) : null}

              <DashboardSection title="Documents" subtitle="Files shared with you.">
                <PortalDocumentsPanel documents={workspace.documents} />
              </DashboardSection>

              {workspace.deliverables.length > 0 ? (
                <DashboardSection title="Deliverables" subtitle="Shared work and milestone packs.">
                  <PortalDeliverablesList deliverables={workspace.deliverables} />
                </DashboardSection>
              ) : null}
            </div>
          </div>
        )}

        {!hasContent ? (
          <DashboardSection
            title="Messages"
            subtitle="Reach your team while your workspace is being prepared."
          >
            <PortalMessagesPanel messages={workspace.messages} />
          </DashboardSection>
        ) : null}
      </main>
    </div>
  )
}
