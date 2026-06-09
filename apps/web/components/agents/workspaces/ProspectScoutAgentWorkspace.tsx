'use client'

import { AgentAnalyticsPanel } from '@/components/agents/AgentAnalyticsPanel'
import { AgentConfigSection } from '@/components/agents/AgentConfigSection'
import {
  AgentFormField,
  agentInputClassName,
  agentSelectTriggerClassName,
} from '@/components/agents/AgentFormField'
import { AgentWorkspaceLayout } from '@/components/agents/AgentWorkspaceLayout'
import { LiveIndicator } from '@/components/operational/LiveIndicator'
import { SdrActivityFeed } from '@/components/sdr/activity-feed'
import {
  bindingFromApi,
  bindingToApiInput,
  formatRunStatus,
  type BindingDraft,
  type SavedSearchOption,
} from '@/components/sdr/sdr-aspire-ui'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { AGENT_DEFAULT_INSTRUCTIONS, AGENT_PAGE_COPY } from '@/lib/agents/default-instructions'
import { getIcpConfigForVertical } from '@/lib/aspire/icp-score'
import type { ICPConfig } from '@/lib/aspire/types'
import type { SdrAspireConfigPayload } from '@/lib/sdr/aspire-config'
import type { AspireBindingInput } from '@/lib/sdr/aspire-config'
import type { CreateSDRConfigInput, ProspectMode, SDRActivityEvent, SDRAgentConfig, SDRDashboardStats } from '@/lib/sdr/types'
import { useAccountRealtime } from '@/lib/supabase/account-realtime'
import { cn } from '@/lib/utils'
import { Search } from 'lucide-react'
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
  conversationStarters: string
  targetTitles: string
  targetIndustries: string
  targetSizeMin: number
  targetSizeMax: number
  mustHaveEmail: boolean
  mustHavePhone: boolean
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

  const defaultIcp = getIcpConfigForVertical(accountVertical as 'agency')
  const savedIcp = config?.icpConfig as ICPConfig | undefined

  const [form, setForm] = useState<FormState>(() => ({
    agentName: config?.agentName ?? copy.defaultName,
    agentDescription: config?.agentTitle || copy.defaultDescription,
    instructions: AGENT_DEFAULT_INSTRUCTIONS.prospect_scout,
    conversationStarters: 'Find 25 qualified prospects in my target market this week\nScore and enrich new leads from yesterday\'s run\nCheck pipeline for leads ready for follow-up',
    targetTitles: (savedIcp?.targetTitles ?? defaultIcp.targetTitles).join(', '),
    targetIndustries: (savedIcp?.targetIndustries ?? defaultIcp.targetIndustries).join(', '),
    targetSizeMin: savedIcp?.targetSizes?.[0] ?? defaultIcp.targetSizes?.[0] ?? 1,
    targetSizeMax: savedIcp?.targetSizes?.[1] ?? defaultIcp.targetSizes?.[1] ?? 500,
    mustHaveEmail: savedIcp?.mustHaveEmail ?? defaultIcp.mustHaveEmail ?? true,
    mustHavePhone: savedIcp?.mustHavePhone ?? defaultIcp.mustHavePhone ?? false,
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

  const statusLabel = config?.isPaused ? 'Paused' : config?.isActive ? 'Trained' : 'Inactive'
  const statusTone = config?.isPaused ? 'warning' : config?.isActive ? 'success' : 'neutral'
  const statusDetail =
    mode === 'configured' && config
      ? config.isPaused
        ? 'Discovery and enrollment are paused'
        : `Last discovery ${config.searchFrequency === 'daily' ? 'daily' : 'weekly'} · max ${config.maxNewLeadsDay} leads/day`
      : undefined

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
        const toastId = toast.loading('Deploying Prospect Scout…')
        try {
        const baseIcp = getIcpConfigForVertical(accountVertical as 'agency')
        const icpConfig: ICPConfig = {
          ...baseIcp,
          targetTitles: form.targetTitles
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          targetIndustries: form.targetIndustries
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          targetSizes: [form.targetSizeMin, form.targetSizeMax],
          mustHaveEmail: form.mustHaveEmail,
          mustHavePhone: form.mustHavePhone,
        }
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
          toast.error(json.error ?? 'Could not deploy agent', { id: toastId })
          return
        }

        const bootstrap = json.data?.bootstrap as
          | { mode: 'trigger'; triggerRunId: string }
          | { mode: 'sync'; enrolled: number }
          | { mode: 'failed'; error: string }
          | null
          | undefined

        if (bootstrap?.mode === 'failed') {
          toast.warning(`${form.agentName} deployed, but discovery did not start: ${bootstrap.error}`, {
            id: toastId,
            duration: 8000,
          })
        } else if (bootstrap?.mode === 'trigger') {
          toast.success(`${form.agentName} deployed — first discovery run queued`, { id: toastId })
        } else if (bootstrap?.mode === 'sync') {
          toast.success(
            `${form.agentName} deployed — ${bootstrap.enrolled} prospect${bootstrap.enrolled === 1 ? '' : 's'} enrolled`,
            { id: toastId },
          )
        } else {
          toast.success(`${form.agentName} deployed`, { id: toastId })
        }

        router.push('/admin/outreach/agents/scout?setup=complete')
        router.refresh()
        } catch (error) {
          toast.error(
            error instanceof Error ? error.message : 'Deploy failed — check your connection and try again',
            { id: toastId },
          )
        }
      })
      return
    }

    startTransition(async () => {
      const patchedIcp: ICPConfig = {
        ...(savedIcp ?? defaultIcp),
        targetTitles: form.targetTitles
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        targetIndustries: form.targetIndustries
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        targetSizes: [form.targetSizeMin, form.targetSizeMax],
        mustHaveEmail: form.mustHaveEmail,
        mustHavePhone: form.mustHavePhone,
      }
      const patchRes = await fetch('/api/sdr/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentName: form.agentName.trim(),
          agentTitle: form.agentDescription.trim(),
          icpConfig: patchedIcp,
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
      {/* ── Scout Identity ── */}
      <AgentConfigSection title="Scout identity">
        <AgentFormField id="scout-name" label="Agent name">
          <Input
            id="scout-name"
            className={agentInputClassName}
            placeholder="Prospect Scout"
            value={form.agentName}
            onChange={(e) => setForm({ ...form, agentName: e.target.value })}
          />
        </AgentFormField>
        <AgentFormField id="scout-frequency" label="Discovery schedule">
          <Select
            value={form.searchFrequency}
            onValueChange={(value: 'daily' | 'weekly') =>
              setForm({ ...form, searchFrequency: value })
            }
          >
            <SelectTrigger id="scout-frequency" className={agentSelectTriggerClassName}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily (recommended)</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
            </SelectContent>
          </Select>
        </AgentFormField>
      </AgentConfigSection>

      {/* ── ICP targeting ── */}
      <AgentConfigSection title="ICP targeting">
        <AgentFormField id="scout-target-titles" label="Target job titles">
          <Input
            id="scout-target-titles"
            className={agentInputClassName}
            placeholder="Owner, CEO, Founder"
            value={form.targetTitles}
            onChange={(e) => setForm({ ...form, targetTitles: e.target.value })}
          />
        </AgentFormField>
        <AgentFormField id="scout-target-industries" label="Target industries">
          <Input
            id="scout-target-industries"
            className={agentInputClassName}
            placeholder="hvac, heating, air conditioning"
            value={form.targetIndustries}
            onChange={(e) => setForm({ ...form, targetIndustries: e.target.value })}
          />
        </AgentFormField>
        <AgentFormField id="scout-cities" label="Target locations">
          <Input
            id="scout-cities"
            className={agentInputClassName}
            placeholder="United States, Texas, Phoenix AZ"
            value={form.targetCities}
            onChange={(e) => setForm({ ...form, targetCities: e.target.value })}
          />
        </AgentFormField>
        <div className="grid grid-cols-2 gap-3">
          <AgentFormField id="scout-max-leads" label="Max leads / day">
            <Input
              id="scout-max-leads"
              type="number"
              min={1}
              className={agentInputClassName}
              value={form.maxNewLeadsDay}
              onChange={(e) =>
                setForm({ ...form, maxNewLeadsDay: Number.parseInt(e.target.value, 10) || 1 })
              }
            />
          </AgentFormField>
          <AgentFormField id="scout-size-min" label="Min company size">
            <Input
              id="scout-size-min"
              type="number"
              min={1}
              className={agentInputClassName}
              placeholder="1"
              value={form.targetSizeMin}
              onChange={(e) =>
                setForm({ ...form, targetSizeMin: Number.parseInt(e.target.value, 10) || 1 })
              }
            />
          </AgentFormField>
        </div>
        <div className="flex gap-4">
          <label className="flex flex-1 items-center justify-between gap-2 rounded-lg border border-[var(--border-subtle)] px-3 py-2.5">
            <p className="text-[12px] font-medium text-[var(--text-primary)]">Verified email</p>
            <Switch
              checked={form.mustHaveEmail}
              onCheckedChange={(checked) => setForm({ ...form, mustHaveEmail: checked })}
              className="data-[state=checked]:bg-[var(--accent)]"
            />
          </label>
          <label className="flex flex-1 items-center justify-between gap-2 rounded-lg border border-[var(--border-subtle)] px-3 py-2.5">
            <p className="text-[12px] font-medium text-[var(--text-primary)]">Phone required</p>
            <Switch
              checked={form.mustHavePhone}
              onCheckedChange={(checked) => setForm({ ...form, mustHavePhone: checked })}
              className="data-[state=checked]:bg-[var(--accent)]"
            />
          </label>
        </div>
      </AgentConfigSection>

      {/* ── Outreach ── */}
      <AgentConfigSection title="Outreach">
        <AgentFormField id="scout-exclude" label="Exclude domains">
          <Input
            id="scout-exclude"
            className={agentInputClassName}
            placeholder="competitor.com"
            value={form.excludeDomains}
            onChange={(e) => setForm({ ...form, excludeDomains: e.target.value })}
          />
        </AgentFormField>
        <label className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-subtle)] px-4 py-3">
          <div>
            <p className="text-[13px] font-medium text-[var(--text-primary)]">Scheduled discovery</p>
            <p className="text-[12px] text-[var(--text-secondary)]">Run on your configured schedule automatically</p>
          </div>
          <Switch
            checked={form.scheduledDiscovery}
            onCheckedChange={(checked) => setForm({ ...form, scheduledDiscovery: checked })}
            className="data-[state=checked]:bg-[var(--accent)]"
          />
        </label>
      </AgentConfigSection>
    </>
  )

  const analyticsPanel = (
    <AgentAnalyticsPanel
      title={form.agentName}
      subtitle="Prospect Scout · live pipeline"
      live={mode === 'configured' && activityLive}
      kpis={analyticsKpis}
      onRefresh={mode === 'configured' ? refreshActivity : undefined}
    >
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
        <div className="flex h-full min-h-[320px] flex-col items-center justify-center py-12 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--accent-border)] bg-[var(--accent-muted)] shadow-[var(--shadow-sm)]">
            <Search className="h-7 w-7 text-[var(--accent)]" aria-hidden />
          </span>
          <p className="mt-5 text-[17px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
            Analytics activate after deploy
          </p>
          <p className="mt-2 max-w-[280px] text-[13px] leading-relaxed text-[var(--text-secondary)]">
            Configure identity, instructions, and capabilities — then deploy to start live
            discovery analytics.
          </p>
        </div>
      )}
    </AgentAnalyticsPanel>
  )

  return (
    <AgentWorkspaceLayout
      title={copy.title}
      subtitle={copy.subtitle}
      standalone={mode === 'setup'}
      isDraft={mode === 'setup'}
      statusLabel={mode === 'configured' ? statusLabel : undefined}
      statusDetail={statusDetail}
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
