'use client'

import { archiveRecord, updateRecord } from '@/app/(admin)/admin/records/actions'
import type { RecordWithRelations } from '@/lib/records/format'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import type { stageDefinitions, users } from '@vantera/db'
import { Archive, Download, UserPlus, ArrowRight, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

type Props = {
  selectedIds: string[]
  stages: (typeof stageDefinitions.$inferSelect)[]
  users: (typeof users.$inferSelect)[]
  recordsLabel: string
  allRecords: RecordWithRelations[]
  onClear: () => void
  onComplete: (records: RecordWithRelations[]) => void
}

export function BulkActionBar({
  selectedIds,
  stages,
  users,
  recordsLabel,
  allRecords,
  onClear,
  onComplete,
}: Props) {
  const [progress, setProgress] = useState<string | null>(null)

  if (selectedIds.length === 0) return null

  const runSequential = async (action: (id: string) => Promise<boolean>) => {
    let ok = 0
    let fail = 0
    for (let i = 0; i < selectedIds.length; i++) {
      setProgress(`Processing ${i + 1}/${selectedIds.length}...`)
      const success = await action(selectedIds[i]!)
      if (success) ok++
      else fail++
    }
    setProgress(null)
    if (fail > 0) {
      toast.warning(`Updated ${ok}/${selectedIds.length} — ${fail} failed`)
    } else {
      toast.success(`${ok} ${recordsLabel.toLowerCase()} updated`)
    }
    onComplete(allRecords)
  }

  const exportCsv = () => {
    const rows = allRecords.filter((r) => selectedIds.includes(r.id))
    const header = ['title', 'contact', 'stage', 'value', 'scheduled']
    const lines = rows.map((r) =>
      [
        r.title,
        r.contact ? `${r.contact.firstName} ${r.contact.lastName}` : '',
        r.stage?.label ?? '',
        (r.valueCents / 100).toFixed(0),
        r.scheduledAt ? new Date(r.scheduledAt).toISOString() : '',
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(','),
    )
    const csv = [header.join(','), ...lines].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'records-export.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 animate-in slide-in-from-bottom-4 items-center gap-3 rounded-2xl bg-stone-900 px-6 py-3 text-white shadow-2xl">
      <span className="text-sm font-medium">
        {progress ?? `${selectedIds.length} selected`}
      </span>
      <span className="text-stone-500">|</span>

      <StageBulkPicker
        stages={stages}
        onSelect={(stageId) =>
          runSequential(async (id) => {
            const r = await updateRecord(id, { stageId })
            return r.success
          })
        }
      />

      <UserBulkPicker
        userList={users}
        onSelect={(userId) =>
          runSequential(async (id) => {
            const r = await updateRecord(id, { assignedUserId: userId })
            return r.success
          })
        }
      />

      <Button variant="ghost" size="sm" className="text-white hover:bg-stone-800" onClick={exportCsv}>
        <Download className="mr-1 h-4 w-4" /> Export
      </Button>

      <Button
        variant="ghost"
        size="sm"
        className="text-white hover:bg-stone-800"
        onClick={() =>
          runSequential(async (id) => {
            const r = await archiveRecord(id)
            return r.success
          })
        }
      >
        <Archive className="mr-1 h-4 w-4" /> Archive
      </Button>

      <Button variant="ghost" size="icon" className="text-white" onClick={onClear}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}

function StageBulkPicker({
  stages,
  onSelect,
}: {
  stages: (typeof stageDefinitions.$inferSelect)[]
  onSelect: (stageId: string) => void
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="text-white hover:bg-stone-800">
          <ArrowRight className="mr-1 h-4 w-4" /> Move Stage
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1">
        {stages.map((s) => (
          <button
            key={s.id}
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-stone-100"
            onClick={() => onSelect(s.id)}
          >
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
            {s.label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}

function UserBulkPicker({
  userList,
  onSelect,
}: {
  userList: (typeof users.$inferSelect)[]
  onSelect: (userId: string) => void
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="text-white hover:bg-stone-800">
          <UserPlus className="mr-1 h-4 w-4" /> Assign
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1">
        {userList.map((u) => (
          <button
            key={u.id}
            type="button"
            className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-stone-100"
            onClick={() => onSelect(u.id)}
          >
            {u.fullName}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}
