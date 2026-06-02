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
import { DEFAULT_OUTREACH_WINDOW } from '@/lib/sdr/types'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'

type Props = {
  accountVertical: string
  accountName: string
}

export function SdrSetupWizardClient({ accountVertical, accountName }: Props) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [isPending, startTransition] = useTransition()
  const [savedSearches, setSavedSearches] = useState<SavedSearchOption[]>([])
  const [loadingSearches, setLoadingSearches] = useState(false)

  const slide = SDR_WIZARD_SLIDES[step]!
  const { total, isFirst, isLast } = getSdrWizardSlideMeta(step)

  const [form, setForm] = useState({
    agentName: 'Alex',
    agentTitle: 'Sales Development Rep',
    fromEmail: '',
    fromName: `Alex at ${accountName}`,
    signature: '',
    targetCities: '',
    excludeDomains: '',
    maxNewLeadsDay: 10,
    maxActiveLeads: 200,
    searchFrequency: 'daily' as 'daily' | 'weekly',
    prospectMode: 'inline_icp' as ProspectMode,
    defaultMinIcpScore: 70,
    syncIcpToSavedSearches: true,
    bindings: [] as BindingDraft[],
  })

  useEffect(() => {
    if (step !== 3) return
    let cancelled = false
    setLoadingSearches(true)
    fetch('/api/aspire/searches')
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

  function validateStep(): boolean {
    if (step === 0 && (!form.agentName || !form.fromEmail || !form.fromName)) {
      toast.error('Complete agent identity fields')
      return false
    }
    if (
      step === 3 &&
      (form.prospectMode === 'aspire_bound' || form.prospectMode === 'hybrid') &&
      form.bindings.length === 0 &&
      savedSearches.length > 0
    ) {
      toast.error('Add at least one saved search binding, or switch to inline ICP mode')
      return false
    }
    return true
  }

  function handlePrimary() {
    if (isLast) {
      launch()
      return
    }
    if (!validateStep()) return
    setStep((s) => s + 1)
  }

  function launch() {
    startTransition(async () => {
      const icpConfig = getIcpConfigForVertical(accountVertical as 'agency')
      const payload: CreateSDRConfigInput & { bindings: AspireBindingInput[] } = {
        agentName: form.agentName,
        agentTitle: form.agentTitle,
        fromEmail: form.fromEmail,
        fromName: form.fromName,
        signature: form.signature || null,
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
        outreachWindow: DEFAULT_OUTREACH_WINDOW,
        maxNewLeadsDay: form.maxNewLeadsDay,
        maxActiveLeads: form.maxActiveLeads,
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
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!json.success) {
        toast.error(json.error ?? 'Launch failed')
        return
      }

      const bootstrap = json.data?.bootstrap
      if (bootstrap && 'queued' in bootstrap && bootstrap.queued) {
        toast.success(
          `${form.agentName} is live — first discovery run started. Watch the activity feed for results.`,
        )
      } else {
        const enrolled = bootstrap?.enrolled ?? 0
        const found = bootstrap?.found ?? 0
        toast.success(
          enrolled > 0
            ? `${form.agentName} is live — ${enrolled} prospect${enrolled === 1 ? '' : 's'} added to your pipeline`
            : found > 0
              ? `${form.agentName} is live — ${found} prospects scored (none met your ICP floor yet)`
              : `${form.agentName} is live — scheduled discovery runs ${form.searchFrequency}`,
        )
      }

      router.push('/admin/outreach/agents')
      router.refresh()
    })
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-[var(--bg-base)] p-4 sm:p-6">
      <SlideWizardFrame
        variant="page"
        headerLabel="SDR Agent setup"
        slide={slide}
        stepIndex={step}
        totalSteps={total}
        mediaPanel={
          <SdrWizardMediaPanel
            media={slide.media}
            slideId={slide.id}
            className="h-full lg:min-h-[320px]"
          />
        }
        onBack={() => {
          if (isFirst) {
            router.push('/admin/outreach/agents')
            return
          }
          setStep((s) => s - 1)
        }}
        onPrimary={handlePrimary}
        primaryLabel={
          isPending ? 'Launching…' : isLast ? 'Launch SDR Agent' : 'Continue'
        }
        primaryDisabled={isPending || (step === 0 && (!form.agentName || !form.fromEmail || !form.fromName))}
        primaryLoading={isPending}
        showSkip={false}
        dialogTitleId="sdr-setup-title"
        dialogBodyId="sdr-setup-body"
      >
        {step === 0 && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="agent-name">Agent first name</Label>
              <Input
                id="agent-name"
                className="mt-1.5 border-[var(--border-default)] bg-[var(--bg-surface)]"
                value={form.agentName}
                onChange={(e) => setForm({ ...form, agentName: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="agent-title">Job title</Label>
              <Input
                id="agent-title"
                className="mt-1.5 border-[var(--border-default)] bg-[var(--bg-surface)]"
                value={form.agentTitle}
                onChange={(e) => setForm({ ...form, agentTitle: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="from-email">From email</Label>
              <Input
                id="from-email"
                type="email"
                className="mt-1.5 border-[var(--border-default)] bg-[var(--bg-surface)]"
                placeholder="alex@yourdomain.com"
                value={form.fromEmail}
                onChange={(e) => setForm({ ...form, fromEmail: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="from-name">From name</Label>
              <Input
                id="from-name"
                className="mt-1.5 border-[var(--border-default)] bg-[var(--bg-surface)]"
                value={form.fromName}
                onChange={(e) => setForm({ ...form, fromName: e.target.value })}
              />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <p className="text-[13px] text-[var(--text-secondary)]">
              ICP defaults to your vertical ({accountVertical}). Adjust cities and exclusions below.
            </p>
            <div>
              <Label htmlFor="target-cities">Target cities (comma-separated)</Label>
              <Input
                id="target-cities"
                className="mt-1.5 border-[var(--border-default)] bg-[var(--bg-surface)]"
                placeholder="Phoenix AZ, Dallas TX"
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
            <p className="text-[13px] text-[var(--text-secondary)]">
              Mon–Fri, 8am–5pm Eastern (default). Customize in settings later.
            </p>
            <div>
              <Label htmlFor="max-leads">Max new leads per day</Label>
              <Input
                id="max-leads"
                type="number"
                className="mt-1.5 border-[var(--border-default)] bg-[var(--bg-surface)]"
                value={form.maxNewLeadsDay}
                onChange={(e) => setForm({ ...form, maxNewLeadsDay: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label htmlFor="max-active">Max active sequences</Label>
              <Input
                id="max-active"
                type="number"
                className="mt-1.5 border-[var(--border-default)] bg-[var(--bg-surface)]"
                value={form.maxActiveLeads}
                onChange={(e) => setForm({ ...form, maxActiveLeads: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label htmlFor="search-frequency">Prospect Scout discovery</Label>
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
                Qualified prospects are added to your pipeline automatically — separate from the
                Aspire search UI.
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
              Once active, {form.agentName} will find and contact real prospects. You can pause
              anytime from the command center.
            </div>
            <dl className="space-y-2 text-[13px]">
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--text-tertiary)]">Agent</dt>
                <dd className="font-medium text-[var(--text-primary)]">{form.agentName}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--text-tertiary)]">From</dt>
                <dd className="text-right font-medium text-[var(--text-primary)]">
                  {form.fromName} &lt;{form.fromEmail}&gt;
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--text-tertiary)]">Daily cap</dt>
                <dd className="font-medium text-[var(--text-primary)]">{form.maxNewLeadsDay} leads</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--text-tertiary)]">Discovery</dt>
                <dd className="font-medium text-[var(--text-primary)]">{form.searchFrequency}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--text-tertiary)]">Prospect mode</dt>
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
    </div>
  )
}
