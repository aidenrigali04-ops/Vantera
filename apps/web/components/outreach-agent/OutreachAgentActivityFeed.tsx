'use client'

import type { SDRActivityEvent } from '@/lib/sdr/types'
import { cn } from '@/lib/utils'
import {
  Calendar,
  Mail,
  Megaphone,
  MessageCircle,
  Pause,
  Play,
  Radar,
  Rocket,
  Zap,
} from 'lucide-react'
import Link from 'next/link'

type Props = {
  events: SDRActivityEvent[]
}

const EVENT_META: Record<
  string,
  { icon: typeof Mail; label: (e: SDRActivityEvent) => string; tone: string }
> = {
  outreach_agent_launched: {
    icon: Rocket,
    label: (e) => `${String(e.metadata.agentName ?? 'Outreach Agent')} activated`,
    tone: 'text-emerald-700',
  },
  outreach_agent_paused: {
    icon: Pause,
    label: (e) => {
      const reason = String(e.metadata.reason ?? '').trim()
      return reason ? `Outreach Agent paused — ${reason}` : 'Outreach Agent paused'
    },
    tone: 'text-red-700',
  },
  outreach_agent_resumed: {
    icon: Play,
    label: () => 'Outreach Agent resumed',
    tone: 'text-emerald-700',
  },
  outreach_queue_run: {
    icon: Radar,
    label: (e) => {
      const sent = Number(e.metadata.sent ?? 0)
      const processed = Number(e.metadata.processed ?? 0)
      if (processed > 0) return `Queue processed — ${sent} sent (${processed} steps)`
      return 'Queue run completed'
    },
    tone: 'text-stone-700',
  },
  auto_campaign_launched: {
    icon: Megaphone,
    label: (e) => {
      const leads = Number(e.metadata.leads ?? 0)
      const sent = Number(e.metadata.sent ?? 0)
      const parts = ['Automatic campaign launched']
      if (leads > 0) parts.push(`${leads} leads`)
      if (sent > 0) parts.push(`${sent} sent`)
      return parts.join(' · ')
    },
    tone: 'text-emerald-700',
  },
  email_sent: {
    icon: Mail,
    label: (e) => `Email sent → ${e.leadName ?? 'prospect'}${e.company ? `, ${e.company}` : ''}`,
    tone: 'text-stone-700',
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
}

export function OutreachAgentActivityFeed({ events }: Props) {
  const sorted = [...events].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )

  if (sorted.length === 0) {
    return (
      <p className="mt-4 text-sm text-[var(--text-secondary)]">
        No outreach activity yet — activation, campaigns, and sends appear here.
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

        return (
          <li
            key={event.id}
            className="flex items-start gap-3 rounded-lg border border-transparent px-2 py-2 transition-colors duration-150"
          >
            <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', meta.tone)} />
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
