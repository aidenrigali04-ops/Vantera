'use client'

import { SdrOutreachAutomationToggle } from '@/components/sdr/SdrOutreachAutomationToggle'
import {
  isAutomaticOutreachMode,
  type OutreachAutomationMode,
} from '@/lib/sdr/outreach-automation-mode'
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
      toast.success(
        next === 'automatic' ? 'Automatic outreach turned on' : 'Review before send turned on',
      )
      router.refresh()
    })
  }

  if (!sdrConfigured) {
    return null
  }

  return (
    <section className="card-surface space-y-3 p-5">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
          Outreach mode
        </p>
        <h2 className="mt-1 text-base font-semibold text-[var(--text-primary)]">
          Automatic or review before send
        </h2>
        <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-[var(--text-secondary)]">
          One switch for your outreach agents. Email can send without you; LinkedIn always goes
          through you on LinkedIn (with help from the Vantera LinkedIn add-on).
        </p>
      </div>

      <SdrOutreachAutomationToggle value={mode} onChange={saveMode} disabled={isPending} />

      {automatic ? (
        <p className="text-[12px] text-[var(--text-secondary)]">
          Auto campaigns appear under{' '}
          <Link href="/admin/outreach/campaigns" className="font-medium text-[var(--accent)] hover:underline">
            Campaigns
          </Link>
          ; Scout activity on{' '}
          <Link href="/admin/outreach/agents/scout" className="font-medium text-[var(--accent)] hover:underline">
            Prospect Scout
          </Link>
          .
        </p>
      ) : (
        <p className="text-[12px] text-[var(--text-secondary)]">
          Review drafts in{' '}
          <Link href="/admin/outreach/agents/drafter" className="font-medium text-[var(--accent)] hover:underline">
            Message Drafter
          </Link>
          {' '}
          or queue sends on{' '}
          <Link href="/admin/outreach/agents/outreach" className="font-medium text-[var(--accent)] hover:underline">
            Outreach Agent
          </Link>
          .
        </p>
      )}
    </section>
  )
}
