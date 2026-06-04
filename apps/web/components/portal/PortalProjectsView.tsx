'use client'

import { PortalDeliverablesList } from '@/components/portal/PortalDeliverablesList'
import { PortalPageHeader } from '@/components/portal/PortalPageHeader'
import { PortalPipelineBoard } from '@/components/portal/PortalPipelineBoard'
import { PortalProjectCard } from '@/components/portal/PortalProjectCard'
import { PortalSection } from '@/components/portal/PortalSection'
import { usePortalShell } from '@/lib/portal/context'

export function PortalProjectsView() {
  const { workspace } = usePortalShell()
  const { config } = workspace
  const label = config.sections.projects.label

  return (
    <>
      <PortalPageHeader
        title={label}
        subtitle="Track delivery stages, progress, and shared deliverables."
      />

      <div className="space-y-8">
        {workspace.projects.length > 0 ? (
          <PortalPipelineBoard
            projects={workspace.projects}
            pipelineLabel={config.pipelineLabel}
          />
        ) : (
          <div className="rounded-xl border border-dashed border-[var(--border-default)] bg-[var(--bg-surface)] px-6 py-16 text-center">
            <p className="text-sm font-medium text-[var(--text-primary)]">No projects yet</p>
            <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-[var(--text-secondary)]">
              When your team adds work to your account, you&apos;ll see pipeline stages and
              progress here.
            </p>
          </div>
        )}

        {workspace.projects.length > 0 ? (
          <PortalSection title="All projects" subtitle="Detailed progress for each engagement.">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {workspace.projects.map((project) => (
                <PortalProjectCard key={project.id} project={project} />
              ))}
            </div>
          </PortalSection>
        ) : null}

        {workspace.deliverables.length > 0 ? (
          <PortalSection title="Deliverables" subtitle="Milestone packs and shared work.">
            <PortalDeliverablesList deliverables={workspace.deliverables} />
          </PortalSection>
        ) : null}
      </div>
    </>
  )
}
