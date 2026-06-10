'use client'

import type { SDRActivityEvent } from '@/lib/sdr/types'
import { cn } from '@/lib/utils'
import {
  Calendar,
  Mail,
  MessageCircle,
  Pause,
  Play,
  Radar,
  Rocket,
  Users,
  Zap,
} from 'lucide-react'
import Link from 'next/link'

type Props = {
  events: SDRActivityEvent[]
  accountId: string
  filter?: string
}

const EVENT_META: Record<
  string,
  { icon: typeof Mail; label: (e: SDRActivityEvent) => string; tone: string }
> = {
  lead_enrolled: {
    icon: Users,
    label: (e) => `Lead enrolled → ${e.company ?? 'prospect'}`,
    tone: 'text-teal-700',
  },
  email_sent: {
    icon: Mail,
    label: (e) => `Email sent → ${e.leadName ?? 'prospect'}${e.company ? `, ${e.company}` : ''}`,
    tone: 'text-[var(--text-secondary)]',
  },
  sms_sent: {
    icon: MessageCircle,
    label: (e) => `SMS sent → ${e.leadName ?? 'prospect'}`,
    tone: 'text-blue-700',
  },
  reply_detected: {
    icon: Zap,
    label: (e) => `Reply detected → ${e.leadName ?? 'prospect'}${e.company ? `, ${e.company}` : ''}`,
    tone: 'text-emerald-700',
  },
  meeting_booked: {
    icon: Calendar,
    label: (e) => `Meeting booked → ${e.leadName ?? 'prospect'}`,
    tone: 'text-emerald-700',
  },
  agent_paused: {
    icon: Pause,
    label: () => 'Agent paused',
    tone: 'text-red-700',
  },
  agent_launched: {
    icon: Rocket,
    label: (e) => `${e.metadata.agentName ?? 'SDR agent'} launched`,
    tone: 'text-emerald-700',
  },
  agent_resumed: {
    icon: Play,
    label: () => 'Agent resumed',
    tone: 'text-emerald-700',
  },
  discovery_started: {
    icon: Radar,
    label: () => 'Prospect Scout discovery started',
    tone: 'text-blue-700',
  },
  discovery_completed: {
    icon: Radar,
    label: (e) => {
      const enrolled = Number(e.metadata.enrolled ?? 0)
      const found = Number(e.metadata.found ?? 0)
      if (enrolled > 0) return `Discovery complete — ${enrolled} enrolled`
      if (found > 0) return `Discovery complete — ${found} scored`
      return 'Discovery complete — no new matches'
    },
    tone: 'text-[var(--text-secondary)]',
  },
  discovery_failed: {
    icon: Radar,
    label: (e) => {
      const err = String(e.metadata.error ?? 'Discovery failed')
      return `Discovery failed — ${err.length > 80 ? `${err.slice(0, 77)}…` : err}`
    },
    tone: 'text-red-700',
  },
  sequence_drafted: {
    icon: Mail,
    label: (e) => `Sequence drafted → ${e.leadName ?? 'prospect'}`,
    tone: 'text-[var(--text-secondary)]',
  },
}

export function SdrActivityFeed({ events, filter = 'all' }: Props) {
  const filtered =
    filter === 'all'
      ? events
      : events.filter((event) => {
          if (filter === 'emails') return event.eventType.includes('email')
          if (filter === 'replies') return event.eventType === 'reply_detected'
          if (filter === 'enrollments') return event.eventType === 'lead_enrolled'
          return true
        })

  const sorted = [...filtered].sort((a, b) => {
    const aInterested = a.eventType === 'reply_detected' && a.metadata.replyType === 'interested'
    const bInterested = b.eventType === 'reply_detected' && b.metadata.replyType === 'interested'
    if (aInterested && !bInterested) return -1
    if (!aInterested && bInterested) return 1
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  if (sorted.length === 0) {
    return (
      <p className="mt-4 text-sm text-[var(--text-secondary)]">
        No activity yet — agent actions appear here.
      </p>
    )
  }

  return (
    <ul className="max-h-[480px] space-y-1 overflow-y-auto">
      {sorted.map((event) => {
        const meta = EVENT_META[event.eventType] ?? {
          icon: Mail,
          label: () => event.eventType.replace(/_/g, ' '),
          tone: 'text-[var(--text-secondary)]',
        }
        const Icon = meta.icon
        const isInterested =
          event.eventType === 'reply_detected' && event.metadata.replyType === 'interested'

        return (
          <li
            key={event.id}
            className={cn(
              'flex items-start gap-3 rounded-lg border border-transparent px-2 py-2 transition-colors duration-150',
              isInterested && 'border-l-2 border-[var(--success)] bg-[var(--success-muted)]',
            )}
          >
            <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', meta.tone, isInterested && 'animate-pulse')} />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-[var(--text-primary)]">{meta.label(event)}</p>
              <p className="text-[11px] text-[var(--text-secondary)]">
                {new Date(event.createdAt).toLocaleString([], {
                  hour: 'numeric',
                  minute: '2-digit',
                  month: 'short',
                  day: 'numeric',
                })}
              </p>
            </div>
            {event.leadId ? (
              <Link
                href={`/admin/crm/pipeline?leadId=${event.leadId}`}
                className="shrink-0 text-xs font-medium text-[var(--accent)] hover:underline"
              >
                View
              </Link>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
