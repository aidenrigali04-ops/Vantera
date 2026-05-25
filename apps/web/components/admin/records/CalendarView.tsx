'use client'

import { updateRecord } from '@/app/(admin)/admin/records/actions'
import { CalendarEventBlock } from '@/components/admin/records/CalendarEventBlock'
import type { RecordWithRelations } from '@/lib/records/format'
import { cn } from '@/lib/utils'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import type { users } from '@vantera/db'
import { addDays, format, startOfWeek } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

const HOUR_HEIGHT = 60
const START_HOUR = 6
const END_HOUR = 20
const GRID_HEIGHT = (END_HOUR - START_HOUR) * HOUR_HEIGHT

type CalendarRecord = RecordWithRelations & {
  assignedUser?: { fullName: string; avatarUrl: string | null } | null
}

type Props = {
  accountId: string
  recordType: string
  users: (typeof users.$inferSelect)[]
  onAddRecord?: (scheduledAt: Date) => void
}

export function CalendarView({ recordType, users, onAddRecord }: Props) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [view, setView] = useState<'week' | 'day'>('week')
  const [userFilter, setUserFilter] = useState<string>('all')
  const [scheduled, setScheduled] = useState<CalendarRecord[]>([])
  const [unscheduled, setUnscheduled] = useState<CalendarRecord[]>([])
  const [nowTop, setNowTop] = useState(0)
  const [activeDrag, setActiveDrag] = useState<CalendarRecord | null>(null)

  const load = useCallback(async () => {
    const params = new URLSearchParams({
      weekStart: weekStart.toISOString(),
      recordType,
    })
    if (userFilter !== 'all') params.set('userId', userFilter)
    const res = await fetch(`/api/records/calendar?${params}`)
    const json = await res.json()
    if (json.success) {
      setScheduled(json.data.scheduled)
      setUnscheduled(json.data.unscheduled)
    }
  }, [weekStart, userFilter, recordType])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      const minutes = (now.getHours() - START_HOUR) * 60 + now.getMinutes()
      setNowTop((minutes / 60) * HOUR_HEIGHT)
    }
    tick()
    const id = setInterval(tick, 60_000)
    return () => clearInterval(id)
  }, [])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const displayUsers =
    userFilter === 'all' ? users : users.filter((u) => u.id === userFilter)

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveDrag(null)
    const record = event.active.data.current?.record as CalendarRecord | undefined
    const dropData = event.over?.data.current
    if (!record || !dropData?.hour) return

    const { dayIndex, hour, minute } = dropData as { dayIndex: number; hour: number; minute: number }
    const newDate = addDays(weekStart, dayIndex)
    newDate.setHours(hour, minute, 0, 0)

    const result = await updateRecord(record.id, {
      scheduledAt: newDate.toISOString(),
      assignedUserId: dropData.userId ?? record.assignedUserId,
    })

    if (!result.success) {
      toast.error(result.error)
      return
    }
    toast.success('Rescheduled')
    void load()
  }

  const days = view === 'day' ? [weekStart] : Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const columnUsers: Array<{ id: string; fullName: string }> =
    displayUsers.length > 0
      ? displayUsers
      : [{ id: 'unassigned', fullName: 'Unassigned' }]

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e) => setActiveDrag(e.active.data.current?.record as CalendarRecord)}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4">
        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setWeekStart((d) => addDays(d, -7))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium">
                Week of {format(weekStart, 'MMM d')}
              </span>
              <Button variant="outline" size="icon" onClick={() => setWeekStart((d) => addDays(d, 7))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-1">
              <Button variant={view === 'week' ? 'default' : 'outline'} size="sm" onClick={() => setView('week')} className="hidden md:inline-flex">
                Week
              </Button>
              <Button variant={view === 'day' ? 'default' : 'outline'} size="sm" onClick={() => setView('day')}>
                Day
              </Button>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
              Today
            </Button>
            <select
              className="rounded-md border border-stone-200 px-2 py-1 text-sm"
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
            >
              <option value="all">All Users</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white shadow-sm">
            <div
              className="relative grid min-w-[640px]"
              style={{
                gridTemplateColumns: `64px repeat(${Math.max(displayUsers.length, 1)}, minmax(120px, 1fr))`,
              }}
            >
              <div className="border-r border-stone-100 bg-stone-50" style={{ height: GRID_HEIGHT + 40 }}>
                <div className="h-10 border-b border-stone-100" />
                {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
                  <div
                    key={i}
                    className="border-b border-stone-100 pr-2 text-right text-[10px] text-stone-400"
                    style={{ height: HOUR_HEIGHT }}
                  >
                    {format(new Date(2000, 0, 1, START_HOUR + i), 'h a')}
                  </div>
                ))}
              </div>

              {columnUsers.map((user, colIndex) => (
                <CalendarUserColumn
                  key={user.id}
                  user={user}
                  colIndex={colIndex}
                  days={days}
                  scheduled={scheduled.filter((r) =>
                    userFilter === 'all'
                      ? r.assignedUserId === user.id ||
                        (!r.assignedUserId && user.id === 'unassigned')
                      : true,
                  )}
                  nowTop={nowTop}
                  onSlotClick={(at) => onAddRecord?.(at)}
                />
              ))}
            </div>
          </div>
        </div>

        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-medium">Unscheduled ({unscheduled.length})</h3>
            <div className="mt-3 space-y-2">
              {unscheduled.map((record) => (
                <UnscheduledChip key={record.id} record={record} />
              ))}
            </div>
          </div>
        </aside>
      </div>

      <DragOverlay>
        {activeDrag ? (
          <CalendarEventBlock record={activeDrag} top={0} height={HOUR_HEIGHT} isDragging />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

function CalendarUserColumn({
  user,
  colIndex,
  days,
  scheduled,
  nowTop,
  onSlotClick,
}: {
  user: { id: string; fullName: string }
  colIndex: number
  days: Date[]
  scheduled: CalendarRecord[]
  nowTop: number
  onSlotClick: (at: Date) => void
}) {
  return (
    <div className="relative border-r border-stone-100">
      <div className="flex h-10 items-center justify-center border-b border-stone-100 bg-stone-50 text-xs font-medium">
        {user.fullName}
      </div>
      <div className="relative" style={{ height: GRID_HEIGHT }}>
        {Array.from({ length: (END_HOUR - START_HOUR) * 2 }, (_, slot) => {
          const hour = START_HOUR + Math.floor(slot / 2)
          const minute = slot % 2 === 0 ? 0 : 30
          return (
            <TimeSlot
              key={slot}
              dayIndex={colIndex}
              userId={user.id === 'unassigned' ? null : user.id}
              hour={hour}
              minute={minute}
              top={(slot / 2) * HOUR_HEIGHT}
              onClick={() => {
                const d = new Date(days[0] ?? new Date())
                d.setHours(hour, minute, 0, 0)
                onSlotClick(d)
              }}
            />
          )
        })}

        <div
          className="pointer-events-none absolute left-0 right-0 z-10 border-t-2 border-red-500"
          style={{ top: nowTop }}
        >
          <span className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-red-500" />
        </div>

        {scheduled.map((record) => {
          if (!record.scheduledAt) return null
          const start = new Date(record.scheduledAt)
          const top =
            ((start.getHours() - START_HOUR) * 60 + start.getMinutes()) * (HOUR_HEIGHT / 60)
          return (
            <CalendarEventBlock
              key={record.id}
              record={record}
              top={Math.max(0, top)}
              height={Math.max(40, HOUR_HEIGHT)}
            />
          )
        })}
      </div>
    </div>
  )
}

function TimeSlot({
  dayIndex,
  userId,
  hour,
  minute,
  top,
  onClick,
}: {
  dayIndex: number
  userId: string | null
  hour: number
  minute: number
  top: number
  onClick: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `slot-${dayIndex}-${hour}-${minute}`,
    data: { dayIndex, hour, minute, userId },
  })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'absolute left-0 right-0 border-b border-stone-50',
        isOver && 'bg-blue-50',
      )}
      style={{ top, height: HOUR_HEIGHT / 2 }}
      onClick={onClick}
    />
  )
}

function UnscheduledChip({ record }: { record: CalendarRecord }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `unscheduled-${record.id}`,
    data: { record },
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
      className="cursor-grab rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs"
    >
      <p className="font-medium truncate">{record.title}</p>
      {record.contact ? (
        <p className="text-stone-500">
          {record.contact.firstName} {record.contact.lastName}
        </p>
      ) : null}
    </div>
  )
}
