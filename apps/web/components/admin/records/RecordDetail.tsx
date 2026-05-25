'use client'

import { addNote, updateRecord } from '@/app/(admin)/admin/records/actions'
import { formatUsdFromCents } from '@/lib/contacts/format'
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
}

export function RecordDetail({ record, stages }: Props) {
  const router = useRouter()
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
    const result = await addNote(record.id, note)
    if (!result.success) {
      toast.error(result.error)
      return
    }
    setNote('')
    toast.success('Note added')
    router.refresh()
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={async () => {
              if (title !== record.title) {
                await updateRecord(record.id, { title })
                router.refresh()
              }
            }}
            className="border-none p-0 text-2xl font-semibold shadow-none focus-visible:ring-0"
          />

          {record.contact ? (
            <Link
              href={`/admin/contacts/${record.contact.id}`}
              className="mt-2 inline-flex text-sm text-blue-600 hover:underline"
            >
              {record.contact.firstName} {record.contact.lastName}
            </Link>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            {stages.map((stage) => (
              <button
                key={stage.id}
                type="button"
                onClick={() => handleStageChange(stage.id)}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-medium transition-colors',
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

          <div className="mt-4 flex flex-wrap gap-3 text-sm text-stone-600">
            <Badge variant="outline">{record.priority}</Badge>
            <span>{formatUsdFromCents(record.valueCents)}</span>
            {record.scheduledAt ? (
              <span>{new Date(record.scheduledAt).toLocaleString()}</span>
            ) : null}
          </div>
        </div>

        <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
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
                  placeholder="Add a note..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <Button onClick={handleSaveNote}>Add note</Button>
              </div>
              {record.activities.map((activity) => (
                <div key={activity.id} className="rounded-lg bg-stone-50 p-3 text-sm">
                  <p>{activity.body ?? activity.activityType}</p>
                  <p className="mt-1 text-xs text-stone-500">
                    {new Date(activity.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </TabsContent>
            <TabsContent value="messages">
              <p className="text-sm text-stone-500">Unified messaging — Phase 2.</p>
            </TabsContent>
            <TabsContent value="documents">
              <p className="text-sm text-stone-500">Document uploads — Phase 2.</p>
            </TabsContent>
            <TabsContent value="invoices">
              <p className="text-sm text-stone-500">Invoicing — Phase 2.</p>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <aside className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-medium text-stone-900">Metadata</h3>
        <dl className="mt-4 space-y-2 text-sm">
          {Object.entries((record.metadata ?? {}) as Record<string, unknown>).map(([key, value]) => (
            <div key={key}>
              <dt className="text-stone-500">{key}</dt>
              <dd className="text-stone-900">{String(value)}</dd>
            </div>
          ))}
        </dl>
      </aside>
    </div>
  )
}
