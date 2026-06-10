import { cn } from '@/lib/utils'

type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'accent'

const TONE_CLASSES: Record<StatusTone, string> = {
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200/80',
  warning: 'bg-amber-50 text-amber-800 ring-amber-200/80',
  danger: 'bg-red-50 text-red-700 ring-red-200/80',
  info: 'bg-blue-50 text-blue-700 ring-blue-200/80',
  accent: 'bg-[var(--accent-muted)] text-[var(--accent)] ring-[var(--accent-border)]',
  neutral: 'bg-stone-100 text-stone-700 ring-stone-200/80',
}

/** Map pipeline relationship statuses to operational status colors. */
export function pipelineStatusTone(status: string): StatusTone {
  switch (status) {
    case 'won':
    case 'qualified':
      return 'success'
    case 'nurturing':
    case 'contacted':
      return 'warning'
    case 'lost':
      return 'danger'
    case 'connected':
    case 'discovery_booked':
      return 'info'
    case 'new':
    case 'proposal_sent':
      return 'accent'
    default:
      return 'neutral'
  }
}

type StatusBadgeProps = {
  label: string
  tone?: StatusTone
  className?: string
}

export function StatusBadge({ label, tone = 'neutral', className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset',
        TONE_CLASSES[tone],
        className,
      )}
    >
      {label}
    </span>
  )
}
