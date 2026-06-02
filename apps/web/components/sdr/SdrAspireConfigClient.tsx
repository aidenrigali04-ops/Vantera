'use client'

import { PageHeader } from '@/components/operational/PageHeader'
import { SdrOutreachAutomationToggle } from '@/components/sdr/SdrOutreachAutomationToggle'
import { SdrProspectScoutFields } from '@/components/sdr/SdrProspectScoutFields'
import {
  bindingFromApi,
  bindingToApiInput,
  formatRunStatus,
  type BindingDraft,
  type SavedSearchOption,
} from '@/components/sdr/sdr-aspire-ui'
import { Button } from '@/components/ui/button'
import { LiveIndicator } from '@/components/operational/LiveIndicator'
import type { SdrAspireConfigPayload } from '@/lib/sdr/aspire-config'
import type { OutreachAutomationMode } from '@/lib/sdr/outreach-automation-mode'
import type { ProspectMode } from '@/lib/sdr/types'
import { useAccountRealtime } from '@/lib/supabase/account-realtime'
import { cn } from '@/lib/utils'
import { Loader2, Play, Radar } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'

type Props = {
  accountId: string
  initial: SdrAspireConfigPayload
}

function mapSavedSearches(rows: SdrAspireConfigPayload['savedSearches']): SavedSearchOption[] {
  return rows.map((s) => ({
    id: s.id,
    name: s.name,
    totalFound: s.totalFound,
    runFrequency: s.runFrequency,
    isActive: s.isActive,
  }))
}

export function SdrAspireConfigClient({ accountId, initial }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isRunning, setIsRunning] = useState(false)

  const [prospectMode, setProspectMode] = useState<ProspectMode>(
    initial.config?.prospectMode ?? 'inline_icp',
  )
  const [defaultMinIcpScore, setDefaultMinIcpScore] = useState(
    initial.config?.defaultMinIcpScore ?? 70,
  )
  const [syncIcpToSavedSearches, setSyncIcpToSavedSearches] = useState(
    initial.config?.syncIcpToSavedSearches ?? true,
  )
  const [bindings, setBindings] = useState<BindingDraft[]>(
    initial.bindings.map(bindingFromApi),
  )
  const [outreachAutomationMode, setOutreachAutomationMode] = useState<OutreachAutomationMode>(
    initial.config?.outreachAutomationMode ?? 'review',
  )
  const [recentRuns, setRecentRuns] = useState(initial.recentRuns)

  const refreshRuns = useCallback(async () => {
    const res = await fetch('/api/sdr/aspire-config')
    const json = await res.json()
    if (json.success) setRecentRuns(json.data.recentRuns)
  }, [])

  const { isLive: runsLive } = useAccountRealtime({
    accountId,
    table: 'aspire_search_runs',
    onChange: refreshRuns,
    enabled: Boolean(initial.config),
  })

  const savedSearches = useMemo(() => mapSavedSearches(initial.savedSearches), [initial.savedSearches])

  const dirty =
    prospectMode !== (initial.config?.prospectMode ?? 'inline_icp') ||
    defaultMinIcpScore !== (initial.config?.defaultMinIcpScore ?? 70) ||
    syncIcpToSavedSearches !== (initial.config?.syncIcpToSavedSearches ?? true) ||
    JSON.stringify(bindings) !== JSON.stringify(initial.bindings.map(bindingFromApi))

  function save() {
    if (
      (prospectMode === 'aspire_bound' || prospectMode === 'hybrid') &&
      bindings.length === 0
    ) {
      toast.error('Add at least one saved search binding')
      return
    }

    startTransition(async () => {
      const res = await fetch('/api/sdr/aspire-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prospectMode,
          defaultMinIcpScore,
          syncIcpToSavedSearches,
          bindings: bindings.map(bindingToApiInput),
        }),
      })
      const json = await res.json()
      if (!json.success) {
        toast.error(json.error ?? 'Failed to save')
        return
      }
      toast.success('Prospect Scout settings saved')
      setRecentRuns(json.data.recentRuns)
      router.refresh()
    })
  }

  async function runNow(searchId?: string) {
    setIsRunning(true)
    try {
      if (dirty) {
        const saveRes = await fetch('/api/sdr/aspire-config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prospectMode,
            defaultMinIcpScore,
            syncIcpToSavedSearches,
            bindings: bindings.map(bindingToApiInput),
          }),
        })
        const saveJson = await saveRes.json()
        if (!saveJson.success) {
          toast.error(saveJson.error ?? 'Save before run failed')
          return
        }
      }

      const res = await fetch('/api/sdr/aspire-config/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(searchId ? { searchId } : {}),
      })
      const json = await res.json()
      if (!json.success) {
        toast.error(json.error ?? 'Run failed')
        return
      }

      if (json.data?.queued) {
        toast.success('Prospect Scout run queued — watch Recent runs for progress')
        void refreshRuns()
        router.refresh()
        return
      }

      const enrolled = json.data?.enrolled ?? json.data?.totalEnrolled ?? 0
      const found = json.data?.found ?? 0
      toast.success(
        searchId
          ? `Search run complete — ${enrolled} enrolled`
          : found > 0 && enrolled === 0
            ? `Prospect Scout complete — ${found} scored (none enrolled yet)`
            : `Prospect Scout run complete — ${enrolled} enrolled`,
      )
      const refresh = await fetch('/api/sdr/aspire-config')
      const refreshJson = await refresh.json()
      if (refreshJson.success) setRecentRuns(refreshJson.data.recentRuns)
      router.refresh()
    } finally {
      setIsRunning(false)
    }
  }

  if (!initial.config) {
    return (
      <div className="card-surface mx-auto max-w-lg px-6 py-12 text-center">
        <Radar className="mx-auto h-10 w-10 text-[var(--text-tertiary)]" aria-hidden />
        <h2 className="mt-4 text-lg font-semibold text-[var(--text-primary)]">SDR not configured</h2>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Complete SDR setup before configuring Prospect Scout.
        </p>
        <Button asChild className="mt-6 bg-[var(--accent)] text-[var(--text-primary)] hover:bg-[var(--accent-hover)]">
          <Link href="/admin/outreach/agents/setup">Set up SDR Agent</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Prospect Scout"
        description="Autonomous discovery: live search → ICP scoring → qualified prospects land in your pipeline on schedule. Saved lead searches are optional add-ons, not required."
        className="[&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-[var(--text-primary)] [&_p]:text-[var(--text-secondary)]"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isRunning || isPending}
              className="border-[var(--border-default)] bg-[var(--bg-surface)]"
              onClick={() => runNow()}
            >
              {isRunning ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="mr-1.5 h-3.5 w-3.5" />
              )}
              Run all
            </Button>
            <Button
              size="sm"
              disabled={isPending || !dirty}
              className="bg-[var(--accent)] text-[var(--text-primary)] hover:bg-[var(--accent-hover)]"
              onClick={save}
            >
              {isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              Save changes
            </Button>
            <Button variant="ghost" size="sm" asChild className="text-[var(--text-secondary)]">
              <Link href="/admin/outreach/agents">← Command center</Link>
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="status-pill bg-[var(--accent-muted)] text-[var(--text-primary)]">
          {prospectMode.replace('_', ' ')}
        </span>
        <span className="text-[var(--text-tertiary)]">·</span>
        <span className="text-[var(--text-secondary)]">
          {bindings.filter((b) => b.isActive).length} active binding
          {bindings.filter((b) => b.isActive).length === 1 ? '' : 's'}
        </span>
      </div>

      <SdrProspectScoutFields
        prospectMode={prospectMode}
        onProspectModeChange={setProspectMode}
        defaultMinIcpScore={defaultMinIcpScore}
        onDefaultMinIcpScoreChange={setDefaultMinIcpScore}
        syncIcpToSavedSearches={syncIcpToSavedSearches}
        onSyncIcpChange={setSyncIcpToSavedSearches}
        bindings={bindings}
        onBindingsChange={setBindings}
        savedSearches={savedSearches}
      />

      <section className="card-surface space-y-3 p-5">
        <div>
          <h3 className="text-[15px] font-semibold tracking-tight text-[var(--text-primary)]">
            Outreach pipeline
          </h3>
          <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
            After Prospect Scout enrolls a lead, Message Drafter writes a 5-step sequence. Choose
            whether sends wait for approval or run automatically in your outreach window.
          </p>
        </div>
        <SdrOutreachAutomationToggle
          value={outreachAutomationMode}
          disabled={isPending}
          onChange={(mode) => {
            setOutreachAutomationMode(mode)
            startTransition(async () => {
              const res = await fetch('/api/sdr/config', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({ outreachAutomationMode: mode }),
              })
              const json = await res.json()
              if (!json.success) {
                toast.error(json.error ?? 'Could not save outreach mode')
                setOutreachAutomationMode(initial.config?.outreachAutomationMode ?? 'review')
                return
              }
              toast.success(
                mode === 'automatic'
                  ? 'Automatic outreach enabled'
                  : 'Review-before-send enabled',
              )
              router.refresh()
            })
          }}
        />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[15px] font-semibold tracking-tight text-[var(--text-primary)]">
            Recent runs
          </h3>
          <LiveIndicator active={runsLive} />
        </div>
        <div className="card-surface overflow-hidden">
          {recentRuns.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-[var(--text-secondary)]">
              No search runs yet. Use Run all or wait for the daily find job.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-default)] bg-[var(--bg-subtle)]/50">
                    <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
                      When
                    </th>
                    <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
                      Status
                    </th>
                    <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
                      Enrolled
                    </th>
                    <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recentRuns.map((run) => {
                    const status = formatRunStatus(run.status)
                    return (
                      <tr
                        key={run.id}
                        className="border-b border-[var(--border-subtle)] last:border-0"
                      >
                        <td className="px-4 py-3 text-[var(--text-primary)]">
                          {new Date(run.runAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn(status.className)}>{status.label}</span>
                          {run.errorMessage ? (
                            <p className="mt-1 max-w-xs truncate text-xs text-[var(--danger)]">
                              {run.errorMessage}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-[var(--text-secondary)]">
                          {run.enrolledCount ?? 0}
                        </td>
                        <td className="px-4 py-3">
                          {run.savedSearchId ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                              disabled={isRunning}
                              onClick={() => runNow(run.savedSearchId ?? undefined)}
                            >
                              Re-run
                            </Button>
                          ) : (
                            <span className="text-xs text-[var(--text-tertiary)]">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
