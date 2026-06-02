'use client'

import { BulkActionBar } from '@/components/operational/BulkActionBar'
import { OperationalTable } from '@/components/operational/OperationalTable'
import { PageHeader } from '@/components/operational/PageHeader'
import { SdrCreditPaywall } from '@/components/sdr/SdrCreditPaywall'
import { SdrCreditStrip } from '@/components/sdr/SdrCreditStrip'
import { SdrOutreachHubTabs } from '@/components/sdr/SdrOutreachHubTabs'
import { SectionEmptyState } from '@/components/onboarding/SectionEmptyState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useSdrCredits } from '@/lib/sdr/use-sdr-credits'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'

type SequenceRow = {
  sequence: {
    id: string
    status: string
    currentStep: number
    totalSteps: number
    nextStepAt: Date | null
    replyType: string | null
  }
  firstName: string | null
  lastName: string | null
  company: string
  score: number
}

type TableRow = SequenceRow & { id: string }

type Props = {
  rows: SequenceRow[]
}

export function SdrSequencesPageClient({ rows }: Props) {
  const router = useRouter()
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isPending, startTransition] = useTransition()
  const [paywallOpen, setPaywallOpen] = useState(false)
  const { credits, exhausted, isLoading: creditsLoading, startTrial } = useSdrCredits(true)

  useEffect(() => {
    if (exhausted) setPaywallOpen(true)
  }, [exhausted])

  const tableRows: TableRow[] = useMemo(
    () => rows.map((row) => ({ ...row, id: row.sequence.id })),
    [rows],
  )

  const columns = useMemo(
    () => [
      {
        id: 'contact',
        header: 'Contact',
        cell: (row: TableRow) => (
          <div className="min-w-[160px]">
            <p className="font-medium text-[var(--text-primary)]">
              {[row.firstName, row.lastName].filter(Boolean).join(' ') || 'Unknown'}
            </p>
            <p className="truncate text-[12px] text-[var(--text-secondary)]">{row.company}</p>
          </div>
        ),
      },
      {
        id: 'icp',
        header: 'ICP',
        cell: (row: TableRow) => (
          <span className="tabular-nums text-sm font-medium text-[var(--text-primary)]">
            {row.score}/100
          </span>
        ),
      },
      {
        id: 'step',
        header: 'Step',
        cell: (row: TableRow) => (
          <span className="text-[13px] text-[var(--text-secondary)]">
            {row.sequence.currentStep}/{row.sequence.totalSteps}
          </span>
        ),
      },
      {
        id: 'next',
        header: 'Next send',
        cell: (row: TableRow) => (
          <span className="whitespace-nowrap text-[13px] text-[var(--text-secondary)]">
            {row.sequence.nextStepAt
              ? new Date(row.sequence.nextStepAt).toLocaleString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })
              : '—'}
          </span>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        cell: (row: TableRow) => (
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge
              variant="outline"
              className="border-[var(--border-default)] bg-[var(--bg-subtle)]/60 font-normal"
            >
              {row.sequence.status}
            </Badge>
            {row.sequence.replyType ? (
              <span className="text-[11px] text-[var(--text-tertiary)]">{row.sequence.replyType}</span>
            ) : null}
          </div>
        ),
      },
    ],
    [],
  )

  function cancelSelected() {
    if (selectedIds.length === 0) return
    startTransition(async () => {
      const res = await fetch('/api/sdr/sequences', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sequenceIds: selectedIds }),
      })
      const json = await res.json()
      if (!json.success) {
        toast.error(json.error ?? 'Cancel failed')
        return
      }
      toast.success(`Cancelled ${json.data.cancelled} sequences`)
      setSelectedIds([])
      router.refresh()
    })
  }

  return (
    <div className="mx-auto w-full space-y-6 px-4 py-5 md:px-8 md:py-6">
      <SdrOutreachHubTabs />

      <SdrCreditStrip
        credits={credits}
        loading={creditsLoading}
        onUpgradeClick={() => setPaywallOpen(true)}
      />

      <PageHeader
        title="Active sequences"
        description="Every prospect enrolled in your SDR agent's nurture sequence."
        actions={
          <Button variant="outline" asChild className="border-[var(--border-default)]">
            <Link href="/admin/outreach/agents">Back to command center</Link>
          </Button>
        }
      />

      {tableRows.length === 0 ? (
        <SectionEmptyState
          title="No sequences yet"
          description="Enroll prospects from Aspire or your pipeline to start automated nurture."
          actionLabel="Open Aspire"
          onAction={() => router.push('/admin/outreach/agents/scout')}
        />
      ) : (
        <section className="card-surface overflow-hidden">
          <OperationalTable
            columns={columns}
            rows={tableRows}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            className="rounded-none border-0 shadow-none"
          />
        </section>
      )}

      <BulkActionBar count={selectedIds.length} onClear={() => setSelectedIds([])}>
        <Button size="sm" variant="secondary" disabled={isPending} onClick={cancelSelected}>
          Cancel selected
        </Button>
      </BulkActionBar>

      <SdrCreditPaywall
        open={paywallOpen}
        onOpenChange={setPaywallOpen}
        credits={credits}
        onStartTrial={startTrial}
      />
    </div>
  )
}
