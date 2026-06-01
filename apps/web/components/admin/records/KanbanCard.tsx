'use client'

import { archiveRecord } from '@/app/(admin)/admin/records/actions'
import { KanbanCardQuickActions } from '@/components/admin/records/KanbanCardQuickActions'
import {
  avatarColorClass,
  contactInitials,
  formatUsdFromCents,
} from '@/lib/contacts/format'
import {
  daysBadgeClass,
  daysInStage,
  priorityBorderClass,
  type RecordWithRelations,
} from '@/lib/records/format'
import { cn } from '@/lib/utils'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { stageDefinitions, users } from '@vantera/db'
import { Calendar } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type Props = {
  record: RecordWithRelations
  isDragging?: boolean
  stages: (typeof stageDefinitions.$inferSelect)[]
  users: (typeof users.$inferSelect)[]
  onUpdated: () => void
}

export function KanbanCard({ record, isDragging, stages, users, onUpdated }: Props) {
  const router = useRouter()
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: record.id,
    data: { type: 'record', stageId: record.stageId },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const contactName = record.contact
    ? `${record.contact.firstName} ${record.contact.lastName}`
    : 'Unknown'
  const days = daysInStage(record)

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'group rounded-xl border border-stone-200 bg-white p-4 shadow-sm transition-all duration-150 hover:shadow-md',
        priorityBorderClass(record.priority),
        isDragging && 'scale-[1.03] rotate-1 border-[var(--brand-primary,#1648A0)] shadow-xl',
      )}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('[data-quick-action]')) return
        router.push(`/admin/records/${record.id}`)
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {record.contact ? (
            <Link
              href={`/admin/clients/${record.contact.id}`}
              onClick={(e) => e.stopPropagation()}
              className="mb-2 flex items-center gap-2"
            >
              <span
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold',
                  avatarColorClass(contactName),
                )}
              >
                {contactInitials(record.contact.firstName, record.contact.lastName)}
              </span>
              <span className="truncate text-sm font-medium text-stone-900">{contactName}</span>
            </Link>
          ) : null}
          <p className="line-clamp-2 text-sm text-stone-700">{record.title}</p>
        </div>
        <div data-quick-action onClick={(e) => e.stopPropagation()}>
          <KanbanCardQuickActions
            record={record}
            stages={stages}
            users={users}
            onUpdated={onUpdated}
            onArchive={async () => {
              const result = await archiveRecord(record.id)
              if (result.success) onUpdated()
            }}
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-stone-500">
        {record.valueCents > 0 ? (
          <span className="font-medium text-stone-700">{formatUsdFromCents(record.valueCents)}</span>
        ) : null}
        {record.scheduledAt ? (
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {new Date(record.scheduledAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            })}
          </span>
        ) : null}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', daysBadgeClass(days))}>
          {days}d
        </span>
        {record.assignedUserId ? (
          <span className="text-[10px] text-stone-400">
            {users.find((u) => u.id === record.assignedUserId)?.fullName?.slice(0, 1) ?? '?'}
          </span>
        ) : null}
      </div>
    </div>
  )
}
