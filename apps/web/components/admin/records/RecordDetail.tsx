'use client'

import { addNote, updateRecord } from '@/app/(admin)/admin/records/actions'
import { EmbeddedInsightsPanel } from '@/components/intelligence/EmbeddedInsightsPanel'
import {
  DetailBackLink,
  DetailField,
  DetailFieldGrid,
  DetailHeader,
  DetailLayout,
  DetailMetaPanel,
  DetailSection,
  DetailShell,
  DetailTimeline,
} from '@/components/operational/detail/DetailShell'
import { StatusBadge } from '@/components/operational/table/StatusBadge'
import { useVerticalLabels } from '@/lib/branding/use-vertical-labels'
import { formatUsdFromCents } from '@/lib/contacts/format'
import type { EmbeddedInsight } from '@/lib/intelligence/types'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { activities, contacts, records, stageDefinitions } from '@vantera/db'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'

type RecordData = typeof records.$inferSelect & {
  contact: typeof contacts.$inferSelect | null
  stage: typeof stageDefinitions.$inferSelect | null
  activities: (typeof activities.$inferSelect)[]
}

type Props = {
  record: RecordData
  stages: (typeof stageDefinitions.$inferSelect)[]
  insights: EmbeddedInsight[]
}

export function RecordDetail({ record, stages, insights }: Props) {
  const router = useRouter()
  const labels = useVerticalLabels()
  const [note, setNote] = useState('')
  const [title, setTitle] = useState(record.title)

  const handleStageChange = async (stageId: string) => {
    const result = await updateRecord(record.id, { stageId })
    if (!result.success) {
      toast.error(result.error)
      return
    }
    toast.success('Stage updated')
    router.refresh()
  }

  const handleSaveNote = async () => {
    if (!note.trim()) return
    const result = await addNote(record.id, note)
    if (!result.success) {
      toast.error(result.error)
      return
    }
    setNote('')
    toast.success('Note added')
    router.refresh()
  }

  const metadataEntries = Object.entries((record.metadata ?? {}) as Record<string, unknown>)

  return (
    <DetailShell>
      <DetailBackLink href="/admin/records" label={`Back to ${labels.records.toLowerCase()}`} />

      <DetailHeader
        eyebrow={labels.record}
        title={title}
        subtitle={
          record.contact
            ? `${record.contact.firstName} ${record.contact.lastName}`
            : undefined
        }
        badges={
          <>
            {record.stage ? (
              <StatusBadge
                label={record.stage.label}
                tone={
                  record.stage.isTerminalWin
                    ? 'success'
                    : record.stage.isTerminalLoss
                      ? 'danger'
                      : 'info'
                }
              />
            ) : null}
            <Badge variant="outline">{record.priority}</Badge>
            <Badge variant="secondary">{formatUsdFromCents(record.valueCents)}</Badge>
          </>
        }
        actions={
          record.contact ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/admin/clients/${record.contact.id}`}>View {labels.contact.toLowerCase()}</Link>
            </Button>
          ) : null
        }
      />

      <DetailLayout
        main={
          <>
            <DetailSection title="Stage & schedule">
              <div className="mb-4">
                <Input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  onBlur={async () => {
                    if (title !== record.title) {
                      const result = await updateRecord(record.id, { title })
                      if (!result.success) {
                        setTitle(record.title)
                        toast.error(result.error)
                        return
                      }
                      router.refresh()
                    }
                  }}
                  className="max-w-xl border-none p-0 text-lg font-semibold shadow-none focus-visible:ring-0"
                  aria-label={`${labels.record} title`}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {stages.map((stage) => (
                  <button
                    key={stage.id}
                    type="button"
                    onClick={() => handleStageChange(stage.id)}
                    className={cn(
                      'rounded-full px-3 py-1 text-[11px] font-medium transition-colors',
                      record.stageId === stage.id
                        ? 'text-white'
                        : 'bg-stone-100 text-stone-700 hover:bg-stone-200',
                      stage.isTerminalWin && record.stageId === stage.id && 'bg-emerald-600',
                      stage.isTerminalLoss && record.stageId === stage.id && 'bg-red-600',
                    )}
                    style={
                      record.stageId === stage.id && !stage.isTerminalWin && !stage.isTerminalLoss
                        ? { backgroundColor: stage.color }
                        : undefined
                    }
                  >
                    {stage.label}
                  </button>
                ))}
              </div>

              <DetailFieldGrid className="mt-5">
                <DetailField
                  label="Scheduled"
                  value={
                    record.scheduledAt
                      ? new Date(record.scheduledAt).toLocaleString()
                      : 'Not scheduled'
                  }
                />
                <DetailField
                  label="Due"
                  value={record.dueAt ? new Date(record.dueAt).toLocaleString() : '—'}
                />
                <DetailField label="Close probability" value={`${record.closeProbability}%`} />
                <DetailField label="Source" value={record.source} />
              </DetailFieldGrid>
            </DetailSection>

            <DetailSection title="Activity" subtitle="Notes, messages, and delivery events">
              <Tabs defaultValue="activity">
                <TabsList>
                  <TabsTrigger value="activity">Activity</TabsTrigger>
                  <TabsTrigger value="messages">Messages</TabsTrigger>
                  <TabsTrigger value="documents">Documents</TabsTrigger>
                  <TabsTrigger value="invoices">Invoices</TabsTrigger>
                </TabsList>
                <TabsContent value="activity" className="mt-4 space-y-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add a note…"
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') void handleSaveNote()
                      }}
                    />
                    <Button onClick={handleSaveNote} className="bg-stone-900 hover:bg-stone-800">
                      Add note
                    </Button>
                  </div>
                  <DetailTimeline items={record.activities} />
                </TabsContent>
                <TabsContent value="messages" className="mt-4">
                  <p className="text-[13px] text-stone-500">Unified messaging — coming soon.</p>
                </TabsContent>
                <TabsContent value="documents" className="mt-4">
                  <p className="text-[13px] text-stone-500">Document uploads — coming soon.</p>
                </TabsContent>
                <TabsContent value="invoices" className="mt-4">
                  <p className="text-[13px] text-stone-500">Invoicing — coming soon.</p>
                </TabsContent>
              </Tabs>
            </DetailSection>
          </>
        }
        aside={
          <>
            <DetailSection>
              <EmbeddedInsightsPanel
                insights={insights}
                title="Delivery intelligence"
                subtitle="Overdue work, stalled progress, and priority signals."
                emptyMessage="No delivery risks detected for this project right now."
              />
            </DetailSection>

            {metadataEntries.length > 0 ? (
              <DetailMetaPanel
                title="Metadata"
                items={metadataEntries.map(([key, value]) => ({
                  label: key,
                  value: String(value),
                }))}
              />
            ) : null}
          </>
        }
      />
    </DetailShell>
  )
}
