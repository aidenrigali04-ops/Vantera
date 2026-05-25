'use client'

import type { RecordWithRelations } from '@/lib/records/format'
import { cn } from '@/lib/utils'
import { useDraggable } from '@dnd-kit/core'
import { format } from 'date-fns'

type Props = {
  record: RecordWithRelations & {
    stage?: { label: string; color: string } | null
  }
  top: number
  height: number
  isDragging?: boolean
}

export function CalendarEventBlock({ record, top, height, isDragging }: Props) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: record.id,
    data: { record },
  })

  const color = record.stage?.color ?? '#64748B'
  const start = record.scheduledAt ? new Date(record.scheduledAt) : null
  const end = start ? new Date(start.getTime() + 60 * 60 * 1000) : null

  const style = {
    top,
    height,
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    backgroundColor: `${color}e6`,
    borderLeftColor: color,
  }

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        'absolute left-1 right-1 z-20 cursor-grab overflow-hidden rounded-lg border-l-[3px] px-2 py-1 text-xs text-white shadow-sm',
        isDragging && 'opacity-50 shadow-lg',
      )}
      style={style}
    >
      {record.contact ? (
        <p className="truncate font-medium">
          {record.contact.firstName} {record.contact.lastName}
        </p>
      ) : null}
      <p className="truncate font-normal opacity-90">{record.title}</p>
      {height > 60 && start && end ? (
        <p className="mt-1 text-[10px] opacity-80">
          {format(start, 'h:mm a')} – {format(end, 'h:mm a')}
        </p>
      ) : null}
    </div>
  )
}
