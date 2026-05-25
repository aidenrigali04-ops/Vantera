import type { records } from '@vantera/db'

export type RecordWithRelations = typeof records.$inferSelect & {
  contact: {
    id: string
    firstName: string
    lastName: string
    phone: string | null
    email: string | null
  } | null
  stage: {
    id: string
    label: string
    color: string
    isTerminalWin: boolean
    isTerminalLoss: boolean
  } | null
}

export function daysInStage(record: { updatedAt: Date | string; createdAt: Date | string }): number {
  const base = new Date(record.updatedAt ?? record.createdAt).getTime()
  return Math.max(0, Math.floor((Date.now() - base) / 86400000))
}

export function priorityBorderClass(priority: string): string {
  switch (priority) {
    case 'urgent':
      return 'border-l-4 border-l-red-500'
    case 'high':
      return 'border-l-4 border-l-amber-500'
    case 'low':
      return 'border-l-4 border-l-stone-300'
    default:
      return ''
  }
}

export function daysBadgeClass(days: number): string {
  if (days > 14) return 'bg-red-100 text-red-700'
  if (days > 7) return 'bg-amber-100 text-amber-700'
  return 'bg-stone-100 text-stone-600'
}
