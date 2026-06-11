'use client'

import type { SDRActivityEvent } from '@/lib/sdr/types'
import { cn } from '@/lib/utils'
import {
  Calendar,
  Check,
  Mail,
  MessageSquare,
  Search,
  Send,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'

const EVENT_LABELS: Record<string, string> = {
  lead_enrolled: 'Lead enrolled',
  email_sent: 'Email sent',
  sms_sent: 'SMS sent',
  linkedin_sent: 'LinkedIn message sent',
  linkedin_connection_sent: 'LinkedIn invite sent',
  reply_received: 'Reply received',
  meeting_booked: 'Meeting booked',
  draft_created: 'Draft ready for review',
  scout_run: 'Scout run completed',
  sequence_started: 'Sequence started',
  sequence_completed: 'Sequence completed',
}

const EVENT_ICONS: Record<string, LucideIcon> = {
  reply_received: MessageSquare,
  meeting_booked: Calendar,
  email_sent: Mail,
  sms_sent: Send,
  linkedin_sent: Send,
  linkedin_connection_sent: Send,
  scout_run: Search,
  lead_enrolled: Check,
  draft_created: Mail,
  sequence_started: Send,
  sequence_completed: Check,
}

/** Booked meetings are the deep aha — their node gets the yellow treatment. */
const PEAK_EVENTS = new Set(['meeting_booked', 'reply_received'])

function eventLabel(event: SDRActivityEvent): string {
  const base =
    EVENT_LABELS[event.eventType] ??
    event.eventType.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
  return event.leadName ? `${base} — ${event.leadName}` : base
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return days === 1 ? 'yesterday' : `${days}d ago`
}

function TimelineRow({ event, isLast }: { event: SDRActivityEvent; isLast: boolean }) {
  const Icon = EVENT_ICONS[event.eventType] ?? Check
  const peak = PEAK_EVENTS.has(event.eventType)
  const time = relativeTime(event.createdAt)

  const inner = (
    <>
      {!isLast ? (
        <span
          className="absolute bottom-[-12px] left-[17px] top-10 w-px bg-[var(--border-default)]"
          aria-hidden
        />
      ) : null}

      <span
        className={cn(
          'relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border',
          peak
            ? 'border-transparent bg-[var(--accent-muted)] text-[var(--highlight-text)]'
            : 'border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-secondary)]',
        )}
        aria-hidden
      >
        <Icon className="h-4 w-4" strokeWidth={2} />
      </span>

      <span className="flex min-w-0 flex-1 items-start justify-between gap-3 pt-1.5">
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-medium leading-tight text-[var(--text-primary)]">
            {eventLabel(event)}
          </span>
          {event.company ? (
            <span className="mt-0.5 block truncate text-[12px] text-[var(--text-tertiary)]">
              {event.company}
            </span>
          ) : null}
        </span>
        {time ? (
          <span className="shrink-0 whitespace-nowrap pt-0.5 text-[12px] text-[var(--text-tertiary)]">
            {time}
          </span>
        ) : null}
      </span>
    </>
  )

  const rowClass =
    'relative flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-[var(--bg-overlay)]'

  if (event.leadId) {
    return (
      <Link href={`/admin/leads/${event.leadId}`} className={rowClass}>
        {inner}
      </Link>
    )
  }
  return <div className={rowClass}>{inner}</div>
}

/** Vertical timeline activity feed — connector line, icon nodes, relative time. */
export function AgentActivityTimeline({ events }: { events: SDRActivityEvent[] }) {
  return (
    <div className="flex flex-col">
      {events.map((event, index) => (
        <TimelineRow key={event.id} event={event} isLast={index === events.length - 1} />
      ))}
    </div>
  )
}
