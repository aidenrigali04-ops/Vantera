'use client'

import { AgentAnalyticsPanel } from '@/components/agents/AgentAnalyticsPanel'
import { AgentCapabilityCard } from '@/components/agents/AgentCapabilityCard'
import { AgentConfigSection } from '@/components/agents/AgentConfigSection'
import { AgentWorkspaceLayout } from '@/components/agents/AgentWorkspaceLayout'
import { LiveIndicator } from '@/components/operational/LiveIndicator'
import { SdrActivityFeed } from '@/components/sdr/activity-feed'
import { SdrProspectScoutFields } from '@/components/sdr/SdrProspectScoutFields'
import {
  bindingFromApi,
  bindingToApiInput,
  formatRunStatus,
  type BindingDraft,
  type SavedSearchOption,
} from '@/components/sdr/sdr-aspire-ui'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { AGENT_DEFAULT_INSTRUCTIONS, AGENT_PAGE_COPY } from '@/lib/agents/default-instructions'
import { getIcpConfigForVertical } from '@/lib/aspire/icp-score'
import type { SdrAspireConfigPayload } from '@/lib/sdr/aspire-config'
import type { AspireBindingInput } from '@/lib/sdr/aspire-config'
import type { CreateSDRConfigInput, ProspectMode, SDRActivityEvent, SDRAgentConfig, SDRDashboardStats } from '@/lib/sdr/types'
import { useAccountRealtime } from '@/lib/supabase/account-realtime'
import { cn } from '@/lib/utils'
import { Calendar, Globe, RefreshCw, Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'

type Props = {
  mode: 'setup' | 'configured'
  accountId: string
  accountVertical: string
  config: SDRAgentConfig | null
  aspirePayload: SdrAspireConfigPayload | null
  stats: SDRDashboardStats | null
  initialActivity: SDRActivityEvent[]
}

type FormState = {
  agentName: string
  agentDescription: string
  instructions: string
  targetCities: string
  excludeDomains: string
  maxNewLeadsDay: number
  searchFrequency: 'daily' | 'weekly'
  prospectMode: ProspectMode
  defaultMinIcpScore: number
  syncIcpToSavedSearches: boolean
  bindings: BindingDraft[]
  scheduledDiscovery: boolean
}

export function ProspectScoutAgentWorkspace({
  mode,
  accountId,
  accountVertical,
  config,
  aspirePayload,
  stats,
  initialActivity,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [activity, setActivity] = useState(initialActivity)
  const [savedSearches, setSavedSearches] = useState<SavedSearchOption[]>([])
  const [recentRuns, setRecentRuns] = useState(aspirePayload?.recentRuns ?? [])

  const copy = AGENT_PAGE_COPY.prospect_scout

  const [form, setForm] = useState<FormState>(() => ({
    agentName: config?.agentName ?? copy.defaultName,
    agentDescription: config?.agentTitle || copy.defaultDescription,
    instructions: AGENT_DEFAULT_INSTRUCTIONS.prospect_scout,
    targetCities: config?.targetCities.join(', ') ?? '',
    excludeDomains: config?.excludeDomains.join(', ') ?? '',
    maxNewLeadsDay: config?.maxNewLeadsDay ?? 10,
    searchFrequency: config?.searchFrequency ?? 'daily',
    prospectMode: config?.prospectMode ?? aspirePayload?.config?.prospectMode ?? 'inline_icp',
    defaultMinIcpScore: config?.defaultMinIcpScore ?? aspirePayload?.config?.defaultMinIcpScore ?? 70,
    syncIcpToSavedSearches:
      config?.syncIcpToSavedSearches ?? aspirePayload?.config?.syncIcpToSavedSearches ?? true,
    bindings: aspirePayload?.bindings.map(bindingFromApi) ?? [],
    scheduledDiscovery: config ? config.isActive && !config.isPaused : true,
  }))

  useEffect(() => {
    let cancelled = false
    fetch('/api/aspire/searches', { credentials: 'same-origin' })
      .then((res) => res.json())
      .then((json) => {
        if (cancelled || !json.success) return
        setSavedSearches(
          (json.data as Array<{
            id: string
            name: string
            totalFound: number | null
            runFrequency: string | null
            isActive: boolean | null
          }>).map((s) => ({
            id: s.id,
            name: s.name,
            totalFound: s.totalFound,
            runFrequency: s.runFrequency,
            isActive: s.isActive,
          })),
        )
      })
    return () => {
      cancelled = true
    }
  }, [])

  const refreshActivity = useCallback(async () => {
    const res = await fetch('/api/sdr/activity?limit=30')
    const json = await res.json()
    if (json.success) setActivity(json.data)
  }, [])

  const refreshRuns = useCallback(async () => {
    const res = await fetch('/api/sdr/aspire-config')
    const json = await res.json()
    if (json.success) setRecentRuns(json.data.recentRuns)
  }, [])

  const { isLive: activityLive } = useAccountRealtime({
    accountId,
    table: 'sdr_activity_log',
    onChange: refreshActivity,
    enabled: mode === 'configured',
  })

  const { isLive: runsLive } = useAccountRealtime({
    accountId,
    table: 'aspire_search_runs',
    onChange: refreshRuns,
    enabled: mode === 'configured',
  })

  const statusLabel = config?.isPaused ? 'Paused' : config?.isActive ? 'Active' : 'Inactive'
  const statusTone = config?.isPaused ? 'warning' : config?.isActive ? 'success' : 'neutral'

  const analyticsKpis = useMemo(
    () =>
      stats
        ? [
            { label: 'Leads today', value: stats.leadsFoundToday },
            { label: 'Emails today', value: stats.emailsSentToday },
            { label: 'Replies (7d)', value: stats.repliesThisWeek },
            { label: 'Meetings', value: stats.meetingsThisWeek },
          ]
        : [
            { label: 'Leads today', value: '—' },
            { label: 'Emails today', value: '—' },
            { label: 'Replies (7d)', value: '—' },
            { label: 'Meetings', value: '—' },
          ],
    [stats],
  )

  function validate(): boolean {
    if (!form.agentName.trim()) {
      toast.error('Enter an agent name')
      return false
    }
    if (!Number.isFinite(form.maxNewLeadsDay) || form.maxNewLeadsDay < 1) {
      toast.error('Set at least 1 new prospect per day')
      return false
    }
    if (
      (form.prospectMode === 'aspire_bound' || form.prospectMode === 'hybrid') &&
      form.bindings.length === 0
    ) {
      toast.error('Add at least one saved search binding, or switch to inline ICP mode')
      return false
    }
    return true
  }

  function deploy() {
    if (!validate()) return

    if (mode === 'setup') {
      startTransition(async () => {
        const icpConfig = getIcpConfigForVertical(accountVertical as 'agency')
        const payload: CreateSDRConfigInput & { bindings: AspireBindingInput[] } = {
          agentName: form.agentName.trim(),
          agentTitle: form.agentDescription.trim(),
          icpConfig,
          targetVerticals: [accountVertical],
          targetCities: form.targetCities
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          excludeDomains: form.excludeDomains
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          maxNewLeadsDay: form.maxNewLeadsDay,
          searchFrequency: form.searchFrequency,
          isActive: form.scheduledDiscovery,
          prospectMode: form.prospectMode,
          defaultMinIcpScore: form.defaultMinIcpScore,
          syncIcpToSavedSearches: form.syncIcpToSavedSearches,
          outreachAutomationMode: 'automatic',
          bindings: form.bindings.map(bindingToApiInput),
        }

        const res = await fetch('/api/sdr/launch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify(payload),
        })
        const json = await res.json()
        if (!json.success) {
          toast.error(json.error ?? 'Could not deploy agent')
          return
        }
        toast.success(`${form.agentName} deployed — discovery is starting`)
        router.push('/admin/outreach/agents/scout?setup=complete')
        router.refresh()
      })
      return
    }

    startTransition(async () => {
      const patchRes = await fetch('/api/sdr/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentName: form.agentName.trim(),
          agentTitle: form.agentDescription.trim(),
          targetCities: form.targetCities
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          excludeDomains: form.excludeDomains
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          maxNewLeadsDay: form.maxNewLeadsDay,
          searchFrequency: form.searchFrequency,
          isActive: form.scheduledDiscovery,
          prospectMode: form.prospectMode,
          defaultMinIcpScore: form.defaultMinIcpScore,
          syncIcpToSavedSearches: form.syncIcpToSavedSearches,
        }),
      })
      const patchJson = await patchRes.json()
      if (!patchJson.success) {
        toast.error(patchJson.error ?? 'Could not save agent settings')
        return
      }

      const aspireRes = await fetch('/api/sdr/aspire-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prospectMode: form.prospectMode,
          defaultMinIcpScore: form.defaultMinIcpScore,
          syncIcpToSavedSearches: form.syncIcpToSavedSearches,
          bindings: form.bindings.map(bindingToApiInput),
        }),
      })
      const aspireJson = await aspireRes.json()
      if (!aspireJson.success) {
        toast.error(aspireJson.error ?? 'Could not save discovery bindings')
        return
      }

      if (!form.scheduledDiscovery && config && !config.isPaused) {
        await fetch('/api/sdr/config/pause', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: 'Paused from agent workspace' }),
        })
      } else if (form.scheduledDiscovery && config?.isPaused) {
        await fetch('/api/sdr/config/resume', { method: 'POST' })
      }

      toast.success('Prospect Scout updated')
      setRecentRuns(aspireJson.data.recentRuns)
      router.refresh()
    })
  }

  const configPanel = (
    <>
      <AgentConfigSection title="Agent identity">
        <div>
          <Label htmlFor="scout-name">Name</Label>
          <Input
            id="scout-name"
            className="mt-1.5 border-[var(--border-default)] bg-[var(--bg-subtle)]/50"
            value={form.agentName}
            onChange={(e) => setForm({ ...form, agentName: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="scout-description">Description</Label>
          <Input
            id="scout-description"
            className="mt-1.5 border-[var(--border-default)] bg-[var(--bg-subtle)]/50"
            value={form.agentDescription}
            onChange={(e) => setForm({ ...form, agentDescription: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="scout-frequency">Discovery schedule</Label>
          <Select
            value={form.searchFrequency}
            onValueChange={(value: 'daily' | 'weekly') =>
              setForm({ ...form, searchFrequency: value })
            }
          >
            <SelectTrigger id="scout-frequency" className="mt-1.5 border-[var(--border-default)] bg-[var(--bg-subtle)]/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily discovery (recommended)</SelectItem>
              <SelectItem value="weekly">Weekly discovery</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </AgentConfigSection>

      <AgentConfigSection
        title="Instructions"
        description="How this agent discovers, scores, and enrolls prospects."
      >
        <div>
          <Label htmlFor="scout-instructions">Instruction</Label>
          <Textarea
            id="scout-instructions"
            rows={6}
            className="mt-1.5 resize-y border-[var(--border-default)] bg-[var(--bg-subtle)]/50 font-mono text-[13px]"
            value={form.instructions}
            onChange={(e) => setForm({ ...form, instructions: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="scout-cities">Target locations</Label>
          <Input
            id="scout-cities"
            className="mt-1.5 border-[var(--border-default)] bg-[var(--bg-subtle)]/50"
            placeholder="United States, Texas, Phoenix AZ"
            value={form.targetCities}
            onChange={(e) => setForm({ ...form, targetCities: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="scout-exclude">Exclude domains</Label>
          <Input
            id="scout-exclude"
            className="mt-1.5 border-[var(--border-default)] bg-[var(--bg-subtle)]/50"
            placeholder="competitor.com"
            value={form.excludeDomains}
            onChange={(e) => setForm({ ...form, excludeDomains: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="scout-max-leads">Max new prospects per day</Label>
          <Input
            id="scout-max-leads"
            type="number"
            min={1}
            className="mt-1.5 border-[var(--border-default)] bg-[var(--bg-subtle)]/50"
            value={form.maxNewLeadsDay}
            onChange={(e) =>
              setForm({ ...form, maxNewLeadsDay: Number.parseInt(e.target.value, 10) || 1 })
            }
          />
        </div>
      </AgentConfigSection>

      <AgentConfigSection title="Capabilities">
        <AgentCapabilityCard
          icon={Calendar}
          title="Scheduled discovery"
          description="Run lead discovery on the configured daily or weekly schedule."
          checked={form.scheduledDiscovery}
          onCheckedChange={(checked) => setForm({ ...form, scheduledDiscovery: checked })}
        />
        <AgentCapabilityCard
          icon={Globe}
          title="Apify lead finder"
          description="Search the web for prospects matching your ICP filters."
          checked
          onCheckedChange={() => {}}
          disabled
        />
        <AgentCapabilityCard
          icon={RefreshCw}
          title="Sync ICP to saved searches"
          description="Keep Aspire saved searches aligned with workspace ICP rules."
          checked={form.syncIcpToSavedSearches}
          onCheckedChange={(checked) =>
            setForm({ ...form, syncIcpToSavedSearches: checked })
          }
        />
      </AgentConfigSection>

      <AgentConfigSection title="Discovery & scoring">
        <SdrProspectScoutFields
          prospectMode={form.prospectMode}
          onProspectModeChange={(mode) => setForm({ ...form, prospectMode: mode })}
          defaultMinIcpScore={form.defaultMinIcpScore}
          onDefaultMinIcpScoreChange={(value) =>
            setForm({ ...form, defaultMinIcpScore: value })
          }
          syncIcpToSavedSearches={form.syncIcpToSavedSearches}
          onSyncIcpChange={(value) => setForm({ ...form, syncIcpToSavedSearches: value })}
          bindings={form.bindings}
          onBindingsChange={(bindings) => setForm({ ...form, bindings })}
          savedSearches={savedSearches}
          compact
        />
      </AgentConfigSection>
    </>
  )

  const analyticsPanel = (
    <AgentAnalyticsPanel live={mode === 'configured' && activityLive} kpis={analyticsKpis}>
      {mode === 'configured' ? (
        <div className="space-y-6">
          <div>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">Activity</h3>
              <LiveIndicator active={activityLive} />
            </div>
            <SdrActivityFeed events={activity} accountId={accountId} />
          </div>

          {config ? (
            <dl className="grid grid-cols-2 gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/40 p-4 text-[12px]">
              {[
                { label: 'Found', value: config.stats.totalLeadsFound },
                { label: 'Contacted', value: config.stats.totalContacted },
                { label: 'Replied', value: config.stats.totalReplied },
                { label: 'Booked', value: config.stats.totalBooked },
              ].map((row) => (
                <div key={row.label}>
                  <dt className="text-[var(--text-tertiary)]">{row.label}</dt>
                  <dd className="mt-0.5 font-semibold text-[var(--text-primary)]">{row.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          <div>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">Recent runs</h3>
              <LiveIndicator active={runsLive} />
            </div>
            {recentRuns.length === 0 ? (
              <p className="text-[13px] text-[var(--text-secondary)]">No discovery runs yet.</p>
            ) : (
              <ul className="space-y-2">
                {recentRuns.slice(0, 5).map((run) => {
                  const status = formatRunStatus(run.status)
                  return (
                    <li
                      key={run.id}
                      className="rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-[12px]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[var(--text-primary)]">
                          {new Date(run.runAt).toLocaleString()}
                        </span>
                        <span className={cn(status.className)}>{status.label}</span>
                      </div>
                      <p className="mt-1 text-[var(--text-secondary)]">
                        {run.enrolledCount ?? 0} enrolled
                      </p>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      ) : (
        <div className="flex h-full flex-col items-center justify-center py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--accent-border)] bg-[var(--accent-muted)]">
            <Search className="h-6 w-6 text-[var(--text-primary)]" aria-hidden />
          </span>
          <p className="mt-4 text-[15px] font-semibold text-[var(--text-primary)]">
            Analytics activate after deploy
          </p>
          <p className="mt-2 max-w-xs text-[13px] leading-relaxed text-[var(--text-secondary)]">
            Configure identity, instructions, and capabilities on the left — then deploy to start
            live discovery analytics.
          </p>
        </div>
      )}
    </AgentAnalyticsPanel>
  )

  return (
    <AgentWorkspaceLayout
      title={copy.title}
      subtitle={copy.subtitle}
      statusLabel={mode === 'configured' ? statusLabel : undefined}
      statusTone={statusTone}
      onDeploy={deploy}
      deployLabel={mode === 'setup' ? 'Deploy' : 'Save changes'}
      deployLoading={isPending}
      deployDisabled={!form.agentName.trim()}
      config={configPanel}
      analytics={analyticsPanel}
    />
  )
}
