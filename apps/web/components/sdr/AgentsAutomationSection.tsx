'use client'

import { SdrOutreachAutomationToggle } from '@/components/sdr/SdrOutreachAutomationToggle'
import {
  isAutomaticOutreachMode,
  type OutreachAutomationMode,
} from '@/lib/sdr/outreach-automation-mode'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'

type Props = {
  initialMode: OutreachAutomationMode
  sdrConfigured: boolean
}

export function AgentsAutomationSection({ initialMode, sdrConfigured }: Props) {
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
                <strong>Message Drafter</strong> analyzes persona and drafts personalized email/SMS per lead
              </li>
              <li>
                <strong>Outreach Agent</strong> creates a campaign for each Scout run and launches sends automatically
              </li>
            </ol>
            <p className="mt-3 text-[var(--text-secondary)]">
              View auto-created campaigns under{' '}
              <Link href="/admin/outreach/campaigns" className="font-medium text-[var(--accent)] hover:underline">
                Campaigns
              </Link>
              . Activity from each run appears on{' '}
              <Link href="/admin/outreach/agents/scout" className="font-medium text-[var(--accent)] hover:underline">
                Prospect Scout
              </Link>
              .
            </p>
          </>
        ) : (
          <>
            <p className="font-medium text-[var(--text-primary)]">Manual mode</p>
            <p className="mt-1 text-[var(--text-secondary)]">
              Scout and Drafter still run on schedule. You approve sends in{' '}
              <Link href="/admin/outreach/agents/drafter" className="font-medium text-[var(--accent)] hover:underline">
                Message Drafter
              </Link>{' '}
              or run the queue on{' '}
              <Link href="/admin/outreach/agents/outreach" className="font-medium text-[var(--accent)] hover:underline">
                Outreach Agent
              </Link>
              .
            </p>
          </>
        )}
      </div>
    </section>
  )
}
