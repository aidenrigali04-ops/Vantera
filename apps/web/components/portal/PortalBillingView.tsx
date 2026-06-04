'use client'

import { PortalApprovalsPanel } from '@/components/portal/PortalApprovalsPanel'
import { PortalBillingSummary } from '@/components/portal/PortalBillingSummary'
import { PortalInvoicesPanel } from '@/components/portal/PortalInvoicesPanel'
import { PortalPageHeader } from '@/components/portal/PortalPageHeader'
import { PortalSection } from '@/components/portal/PortalSection'
import { usePortalShell } from '@/lib/portal/context'
import { Button } from '@/components/ui/button'
import { ExternalLink } from 'lucide-react'

export function PortalBillingView() {
  const { workspace } = usePortalShell()
  const { config } = workspace
  const label = config.sections.billing.label

  return (
    <>
      <PortalPageHeader
        title={label}
        subtitle="Invoices, payment links, and items waiting for your approval."
      />

      <div className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <PortalSection title="Account balance" subtitle="Outstanding and due dates.">
            <PortalBillingSummary billing={workspace.billing} />
            {config.paymentLink && workspace.billing.outstandingCents > 0 ? (
              <Button className="mt-4 bg-[var(--accent)] hover:bg-[var(--accent-hover)]" asChild>
                <a href={config.paymentLink} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" aria-hidden />
                  Pay online
                </a>
              </Button>
            ) : null}
          </PortalSection>

          {workspace.approvals.length > 0 ? (
            <PortalSection title="Approvals" subtitle="Sign-offs requested by your team.">
              <PortalApprovalsPanel approvals={workspace.approvals} />
            </PortalSection>
          ) : null}
        </div>

        <PortalSection title="Invoices" subtitle="History and open balances.">
          <PortalInvoicesPanel invoices={workspace.invoices} />
        </PortalSection>
      </div>
    </>
  )
}
