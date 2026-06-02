'use client'

import { SlideWizardFrame } from '@/components/onboarding/slide-wizard/SlideWizardFrame'
import { SdrProspectScoutFields } from '@/components/sdr/SdrProspectScoutFields'
import { SdrWizardMediaPanel } from '@/components/sdr/SdrWizardMediaPanel'
import { bindingToApiInput, type BindingDraft, type SavedSearchOption } from '@/components/sdr/sdr-aspire-ui'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getIcpConfigForVertical } from '@/lib/aspire/icp-score'
import { getSdrWizardSlideMeta, SDR_WIZARD_SLIDES } from '@/lib/onboarding/sdr-wizard-slides'
import type { CreateSDRConfigInput, ProspectMode } from '@/lib/sdr/types'
import type { AspireBindingInput } from '@/lib/sdr/aspire-config'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'

type Props = {
  accountVertical: string
}

type FormState = {
  agentName: string
  targetCities: string
  excludeDomains: string
  maxNewLeadsDay: number
  searchFrequency: 'daily' | 'weekly'
  prospectMode: ProspectMode
  defaultMinIcpScore: number
  syncIcpToSavedSearches: boolean
  bindings: BindingDraft[]
}

export function SdrSetupWizardClient({ accountVertical }: Props) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [isPending, startTransition] = useTransition()
  const [savedSearches, setSavedSearches] = useState<SavedSearchOption[]>([])
  const [loadingSearches, setLoadingSearches] = useState(false)

  const slide = SDR_WIZARD_SLIDES[step]!
  const { total, isFirst, isLast } = getSdrWizardSlideMeta(step)

  const [form, setForm] = useState<FormState>({
    agentName: 'Scout',
    targetCities: '',
    excludeDomains: '',
    maxNewLeadsDay: 10,
    searchFrequency: 'daily',
    prospectMode: 'inline_icp',
    defaultMinIcpScore: 70,
    syncIcpToSavedSearches: true,
    bindings: [],
  })

  useEffect(() => {
    if (step !== 3) return
    let cancelled = false
    setLoadingSearches(true)
    fetch('/api/aspire/searches', { credentials: 'same-origin' })
      .then((res) => res.json())
      .then((json) => {
        if (cancelled || !json.success) return
        setSavedSearches(
          (json.data as Array<{ id: string; name: string; totalFound: number | null; runFrequency: string | null; isActive: boolean | null }>).map(
            (s) => ({
              id: s.id,
              name: s.name,
              totalFound: s.totalFound,
              runFrequency: s.runFrequency,
              isActive: s.isActive,
            }),
          ),
        )
      })
      .finally(() => {
        if (!cancelled) setLoadingSearches(false)
      })
    return () => {
      cancelled = true
    }
  }, [step])

  function validateStep(targetStep = step): boolean {
    if (targetStep === 0 && !form.agentName.trim()) {
      toast.error('Enter a name for your prospecting agent')
      return false
    }

    if (targetStep === 2) {
      if (!Number.isFinite(form.maxNewLeadsDay) || form.maxNewLeadsDay < 1) {
        toast.error('Set at least 1 new prospect per day')
        return false
      }
    }

    if (targetStep === 3) {
      if (
        (form.prospectMode === 'aspire_bound' || form.prospectMode === 'hybrid') &&
        form.bindings.length === 0
      ) {
        if (savedSearches.length === 0) {
          toast.error('Create a saved search in Lead finder first, or use inline ICP discovery')
          return false
        }
        toast.error('Add at least one saved search binding, or switch to inline ICP mode')
        return false
      }
    }

    return true
  }

  function validateAllSteps(): boolean {
    for (let index = 0; index < SDR_WIZARD_SLIDES.length - 1; index += 1) {
      if (!validateStep(index)) return false
    }
    return true
  }

  function handlePrimary() {
    if (isLast) {
      if (!validateAllSteps()) return
      launch()
      return
    }
    if (!validateStep()) return
    setStep((current) => current + 1)
  }

  function launch() {
    startTransition(async () => {
      const icpConfig = getIcpConfigForVertical(accountVertical as 'agency')
      const payload: CreateSDRConfigInput & { bindings: AspireBindingInput[] } = {
        agentName: form.agentName.trim(),
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
        isActive: true,
        prospectMode: form.prospectMode,
        defaultMinIcpScore: form.defaultMinIcpScore,
        syncIcpToSavedSearches: form.syncIcpToSavedSearches,
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
        toast.error(json.error ?? 'Could not start prospecting agent')
        return
      }

      const bootstrap = json.data?.bootstrap as
        | { mode?: string; queued?: boolean; enrolled?: number; found?: number; searchesRun?: number; error?: string }
        | null
        | undefined

      if (bootstrap?.mode === 'failed') {
        toast.error(bootstrap.error ?? 'Could not start discovery — check Trigger.dev and Apify configuration')
        router.push('/admin/outreach/agents/scout?setup=complete')
        return
      }

      if (bootstrap && (bootstrap.mode === 'trigger' || bootstrap.queued)) {
        toast.success(
          `${form.agentName} is live — first discovery run is in progress. Check the activity feed for results.`,
        )
      } else {
        const enrolled = bootstrap?.enrolled ?? 0
        const found = bootstrap?.found ?? 0
        const searchesRun = bootstrap?.searchesRun ?? 0

        if (enrolled > 0) {
          toast.success(
            `${form.agentName} is live — ${enrolled} prospect${enrolled === 1 ? '' : 's'} added to your pipeline`,
          )
        } else if (found > 0) {
          toast.success(
            `${form.agentName} is live — ${found} prospect${found === 1 ? '' : 's'} scored (none met your ICP floor yet)`,
          )
        } else if (searchesRun > 0) {
          toast.message(
            `${form.agentName} is live — discovery ran but no matches yet. Try broader ICP settings or check Apify configuration.`,
            { duration: 6000 },
          )
        } else {
          toast.message(
            `${form.agentName} is live — scheduled ${form.searchFrequency} discovery runs. The first run may take a minute.`,
            { duration: 6000 },
          )
        }
      }

      router.push('/admin/outreach/agents/scout?setup=complete')
      router.refresh()
    })
  }

  return (
    <SlideWizardFrame
      variant="fullscreen"
      headerLabel="Prospecting agent setup"
      slide={slide}
      stepIndex={step}
      totalSteps={total}
      mediaPanel={
        <SdrWizardMediaPanel
          media={slide.media}
          slideId={slide.id}
          className="h-full min-h-[240px]"
        />
      }
      onBack={() => {
        if (isFirst) {
          router.push('/admin/outreach/agents')
          return
        }
        setStep((current) => current - 1)
      }}
      onPrimary={handlePrimary}
      primaryLabel={
        isPending ? 'Starting…' : isLast ? 'Start prospecting' : 'Continue'
      }
      primaryDisabled={isPending || (step === 0 && !form.agentName.trim())}
      primaryLoading={isPending}
      showSkip={false}
      dialogTitleId="sdr-setup-title"
      dialogBodyId="sdr-setup-body"
    >
      {step === 0 && (
        <div className="space-y-4">
          <div>
            <Label htmlFor="agent-name">Agent name</Label>
            <Input
              id="agent-name"
              className="mt-1.5 border-[var(--border-default)] bg-[var(--bg-surface)]"
              placeholder="Scout"
              value={form.agentName}
              onChange={(e) => setForm({ ...form, agentName: e.target.value })}
            />
            <p className="mt-2 text-[12px] text-[var(--text-secondary)]">
              Used in activity logs when prospects are discovered — not an email sender identity.
            </p>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <p className="text-[13px] text-[var(--text-secondary)]">
            ICP defaults to your vertical ({accountVertical}). Adjust cities and exclusions below.
          </p>
          <div>
            <Label htmlFor="target-cities">Target locations (comma-separated)</Label>
            <Input
              id="target-cities"
              className="mt-1.5 border-[var(--border-default)] bg-[var(--bg-surface)]"
              placeholder="United States, Texas, Phoenix AZ"
              value={form.targetCities}
              onChange={(e) => setForm({ ...form, targetCities: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="exclude-domains">Exclude domains</Label>
            <Input
              id="exclude-domains"
              className="mt-1.5 border-[var(--border-default)] bg-[var(--bg-surface)]"
              placeholder="competitor.com"
              value={form.excludeDomains}
              onChange={(e) => setForm({ ...form, excludeDomains: e.target.value })}
            />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div>
            <Label htmlFor="max-leads">Max new prospects per day</Label>
            <Input
              id="max-leads"
              type="number"
              min={1}
              className="mt-1.5 border-[var(--border-default)] bg-[var(--bg-surface)]"
              value={form.maxNewLeadsDay}
              onChange={(e) => setForm({ ...form, maxNewLeadsDay: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label htmlFor="search-frequency">Discovery schedule</Label>
            <select
              id="search-frequency"
              className="mt-1.5 flex h-9 w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 text-[13px] text-[var(--text-primary)]"
              value={form.searchFrequency}
              onChange={(e) =>
                setForm({
                  ...form,
                  searchFrequency: e.target.value as 'daily' | 'weekly',
                })
              }
            >
              <option value="daily">Daily (6:00 UTC)</option>
              <option value="weekly">Weekly (Mondays 6:00 UTC)</option>
            </select>
            <p className="mt-1.5 text-[12px] text-[var(--text-secondary)]">
              Qualified prospects are added to your pipeline automatically.
            </p>
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          {loadingSearches ? (
            <p className="text-center text-[13px] text-[var(--text-secondary)]">
              Loading saved searches…
            </p>
          ) : (
            <SdrProspectScoutFields
              compact
              wizard
              prospectMode={form.prospectMode}
              onProspectModeChange={(mode) => setForm({ ...form, prospectMode: mode })}
              defaultMinIcpScore={form.defaultMinIcpScore}
              onDefaultMinIcpScoreChange={(v) => setForm({ ...form, defaultMinIcpScore: v })}
              syncIcpToSavedSearches={form.syncIcpToSavedSearches}
              onSyncIcpChange={(v) => setForm({ ...form, syncIcpToSavedSearches: v })}
              bindings={form.bindings}
              onBindingsChange={(bindings) => setForm({ ...form, bindings })}
              savedSearches={savedSearches}
            />
          )}
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <div className="rounded-lg border border-[var(--accent-border)] bg-[var(--accent-muted)] p-4 text-[13px] text-[var(--text-primary)]">
            {form.agentName} will run its first Prospect Scout discovery immediately, then on
            your {form.searchFrequency} schedule. Pause anytime from the command center.
          </div>
          <dl className="space-y-2 text-[13px]">
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--text-tertiary)]">Agent</dt>
              <dd className="font-medium text-[var(--text-primary)]">{form.agentName}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--text-tertiary)]">Daily cap</dt>
              <dd className="font-medium text-[var(--text-primary)]">
                {form.maxNewLeadsDay} prospects
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--text-tertiary)]">Discovery</dt>
              <dd className="font-medium text-[var(--text-primary)]">{form.searchFrequency}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--text-tertiary)]">Source</dt>
              <dd className="font-medium capitalize text-[var(--text-primary)]">
                {form.prospectMode.replace(/_/g, ' ')}
              </dd>
            </div>
            {(form.prospectMode === 'aspire_bound' || form.prospectMode === 'hybrid') && (
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--text-tertiary)]">Bindings</dt>
                <dd className="font-medium text-[var(--text-primary)]">
                  {form.bindings.length} saved search{form.bindings.length === 1 ? '' : 'es'}
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </SlideWizardFrame>
  )
}
