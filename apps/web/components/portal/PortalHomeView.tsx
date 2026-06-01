import { DashboardSection } from '@/components/dashboard/DashboardSection'
import { PortalActivityFeed } from '@/components/portal/PortalActivityFeed'
import { PortalApprovalsPanel } from '@/components/portal/PortalApprovalsPanel'
import { PortalBillingSummary } from '@/components/portal/PortalBillingSummary'
import { PortalDeliverablesList } from '@/components/portal/PortalDeliverablesList'
import { PortalHeader } from '@/components/portal/PortalHeader'
import { PortalKpiStrip } from '@/components/portal/PortalKpiStrip'
import { PortalProjectCard } from '@/components/portal/PortalProjectCard'
import type { PortalWorkspace } from '@/lib/portal/types'

type PortalHomeViewProps = {
  workspace: PortalWorkspace
  preview?: boolean
}

export function PortalHomeView({ workspace, preview = false }: PortalHomeViewProps) {
  const contactName = workspace.contactFirstName
  const hasProjects = workspace.projects.length > 0

  return (
    <div className="min-h-full bg-[#fafaf9]">
      <PortalHeader
        contactName={contactName}
        preview={preview}
      />

      <main className="mx-auto max-w-5xl space-y-5 px-5 py-6 sm:px-8 sm:py-8">
        <PortalKpiStrip workspace={workspace} />

        {!hasProjects ? (
          <div className="rounded-xl border border-dashed border-stone-200 bg-stone-50/80 px-6 py-12 text-center">
            <p className="text-sm font-medium text-stone-800">Your workspace is being set up</p>
            <p className="mt-2 text-sm text-stone-500">
              Your team will add projects, deliverables, and updates here as work begins.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-12">
            <div className="space-y-5 lg:col-span-8">
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

              <DashboardSection
                title="Activity"
                subtitle="Recent updates from your team — transparent by default."
              >
                <PortalActivityFeed activities={workspace.activities} />
              </DashboardSection>
            </div>

            <div className="space-y-5 lg:col-span-4">
              <DashboardSection
                title="Approvals"
                subtitle="Items waiting for your sign-off."
              >
                <PortalApprovalsPanel approvals={workspace.approvals} />
              </DashboardSection>

              <DashboardSection title="Deliverables" subtitle="Shared work and milestone packs.">
                <PortalDeliverablesList deliverables={workspace.deliverables} />
              </DashboardSection>

              <DashboardSection title="Billing" subtitle="Outstanding balance and upcoming invoices.">
                <PortalBillingSummary billing={workspace.billing} />
              </DashboardSection>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
