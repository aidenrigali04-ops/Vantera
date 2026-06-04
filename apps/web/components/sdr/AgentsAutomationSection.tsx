'use client'

import { SdrOutreachAutomationToggle } from '@/components/sdr/SdrOutreachAutomationToggle'
import type { SDRActivityEvent } from '@/lib/sdr/types'
import {
  isAutomaticOutreachMode,
  type OutreachAutomationMode,
} from '@/lib/sdr/outreach-automation-mode'
import { cn } from '@/lib/utils'
import { Activity, Link2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'

type Props = {
  initialMode: OutreachAutomationMode
  sdrConfigured: boolean
  recentActivity: SDRActivityEvent[]
}

const EVENT_LABELS: Record<string, string> = {
  lead_enrolled: 'Prospect Scout enrolled lead',
  sequence_drafted: 'Message Drafter wrote sequence',
  email_sent: 'Outreach Agent sent email',
  sms_sent: 'Outreach Agent sent SMS',
  lead_found: 'Prospect Scout found lead',
  sdr_step_sent: 'Outreach sent sequence step',
}

function formatEventLabel(eventType: string): string {
  return EVENT_LABELS[eventType] ?? eventType.replace(/_/g, ' ')
}

export function AgentsAutomationSection({
  initialMode,
  sdrConfigured,
  recentActivity,
}: Props) {
  const router = useRouter()
  const [mode, setMode] = useState(initialMode)
  const [isPending, startTransition] = useTransition()
  const automatic = isAutomaticOutreachMode(mode)

  useEffect(() => {
    setMode(initialMode)
  }, [initialMode])

  function saveMode(next: OutreachAutomationMode) {
    setMode(next)
    startTransition(async () => {
      const res = await fetch('/api/sdr/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ outreachAutomationMode: next }),
      })
      const json = await res.json()
      if (!json.success) {
        toast.error(json.error ?? 'Could not save outreach mode')
        setMode(initialMode)
        return
      }
      toast.success(next === 'automatic' ? 'Automatic pipeline enabled' : 'Manual mode enabled')
      router.refresh()
    })
  }

  if (!sdrConfigured) {
    return null
  }

  return (
    <section className="card-surface space-y-4 p-5">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
          Outreach mode
        </p>
        <h2 className="mt-1 text-base font-semibold text-[var(--text-primary)]">
          Automatic or manual pipeline
        </h2>
        <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-[var(--text-secondary)]">
          Controls all agents together — not per-agent settings on Scout.
        </p>
      </div>

      <SdrOutreachAutomationToggle value={mode} onChange={saveMode} disabled={isPending} />

      <div
        className={cn(
          'rounded-lg border px-4 py-3 text-[13px]',
          automatic
            ? 'border-emerald-500/25 bg-emerald-500/10'
            : 'border-[var(--warning)]/30 bg-[var(--warning-muted)]',
        )}
      >
        {automatic ? (
          <>
            <p className="font-medium text-[var(--text-primary)]">Automatic pipeline is on</p>
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-[var(--text-secondary)]">
              <li>
                <strong>Prospect Scout</strong> pulls ICP-matched leads into your pipeline
              </li>
              <li>
                <strong>Message Drafter</strong> writes a personalized 5-step sequence per lead
              </li>
              <li>
                <strong>Outreach Agent</strong> sends due email/SMS during your outreach window
              </li>
            </ol>
            <p className="mt-3 text-[var(--text-secondary)]">
              Link at least one campaign on{' '}
              <Link href="/admin/outreach/agents/outreach" className="font-medium text-[var(--accent)] hover:underline">
                Outreach Agent
              </Link>{' '}
              — that is the only step you choose manually.
            </p>
          </>
        ) : (
          <>
            <p className="font-medium text-[var(--text-primary)]">Manual mode</p>
            <p className="mt-1 text-[var(--text-secondary)]">
              Scout and Drafter still run on schedule. You approve sends in{' '}
              <Link href="/admin/outreach/agents/drafter" className="text-[var(--accent)] hover:underline">
                Message Drafter
              </Link>{' '}
              or run the queue on{' '}
              <Link href="/admin/outreach/agents/outreach" className="text-[var(--accent)] hover:underline">
                Outreach Agent
              </Link>
              .
            </p>
          </>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-[var(--text-tertiary)]" />
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Recent agent activity</h3>
        </div>
        {recentActivity.length === 0 ? (
          <p className="text-[13px] text-[var(--text-secondary)]">
            Activity from Scout, Drafter, and sends will appear here after the first run.
          </p>
        ) : (
          <ul className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/40 p-3">
            {recentActivity.slice(0, 12).map((event) => (
              <li key={event.id} className="text-[12px] text-[var(--text-secondary)]">
                <span className="font-medium text-[var(--text-primary)]">
                  {formatEventLabel(event.eventType)}
                </span>
                {event.leadName || event.company ? (
                  <span>
                    {' '}
                    — {event.leadName}
                    {event.company ? ` @ ${event.company}` : ''}
                  </span>
                ) : null}
                <span className="ml-1 text-[var(--text-tertiary)]">
                  {new Date(event.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
        <Link
          href="/admin/outreach/agents/scout"
          className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--accent)] hover:underline"
        >
          <Link2 className="h-3 w-3" />
          Full activity feed on Prospect Scout
        </Link>
      </div>
    </section>
  )
}
