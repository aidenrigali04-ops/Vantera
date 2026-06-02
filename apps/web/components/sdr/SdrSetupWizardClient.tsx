'use client'

import { SdrProspectScoutFields } from '@/components/sdr/SdrProspectScoutFields'
import { bindingToApiInput, type BindingDraft, type SavedSearchOption } from '@/components/sdr/sdr-aspire-ui'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getIcpConfigForVertical } from '@/lib/aspire/icp-score'
import type { CreateSDRConfigInput, ProspectMode } from '@/lib/sdr/types'
import { DEFAULT_OUTREACH_WINDOW } from '@/lib/sdr/types'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'

const STEPS = ['Identity', 'ICP', 'Schedule', 'Prospect Scout', 'Launch'] as const

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
    prospectMode: 'aspire_bound' as ProspectMode,
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

  function next() {
    if (step === 0 && (!form.agentName || !form.fromEmail || !form.fromName)) {
      toast.error('Complete agent identity fields')
      return
    }
    if (
      step === 3 &&
      (form.prospectMode === 'aspire_bound' || form.prospectMode === 'hybrid') &&
      form.bindings.length === 0 &&
      savedSearches.length > 0
    ) {
      toast.error('Add at least one saved search binding, or switch to inline ICP mode')
      return
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  function launch() {
    startTransition(async () => {
      const icpConfig = getIcpConfigForVertical(accountVertical as 'agency')
      const payload: CreateSDRConfigInput = {
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
        isActive: true,
        prospectMode: form.prospectMode,
        defaultMinIcpScore: form.defaultMinIcpScore,
        syncIcpToSavedSearches: form.syncIcpToSavedSearches,
      }

      const res = await fetch('/api/sdr/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!json.success) {
        toast.error(json.error ?? 'Setup failed')
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
        toast.error(aspireJson.error ?? 'Prospect Scout config failed')
        return
      }

      toast.success(`${form.agentName} is live — finding and contacting leads`)
      router.push('/admin/outreach/agents')
      router.refresh()
    })
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="flex justify-center gap-2" role="list" aria-label="Setup progress">
        {STEPS.map((label, index) => (
          <span
            key={label}
            role="listitem"
            className={cn(
              'h-2 rounded-full transition-all duration-150',
              index <= step ? 'w-6 bg-[var(--accent)]' : 'w-2 bg-[var(--border-default)]',
            )}
            title={label}
          />
        ))}
      </div>

      {step === 0 && (
        <div className="card-surface space-y-4 p-5">
          <h2 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">
            Agent identity
          </h2>
          <div>
            <Label>Agent first name</Label>
            <Input
              className="mt-1 border-[var(--border-default)]"
              value={form.agentName}
              onChange={(e) => setForm({ ...form, agentName: e.target.value })}
            />
          </div>
          <div>
            <Label>Job title</Label>
            <Input
              className="mt-1 border-[var(--border-default)]"
              value={form.agentTitle}
              onChange={(e) => setForm({ ...form, agentTitle: e.target.value })}
            />
          </div>
          <div>
            <Label>From email</Label>
            <Input
              type="email"
              className="mt-1 border-[var(--border-default)]"
              placeholder="alex@yourdomain.com"
              value={form.fromEmail}
              onChange={(e) => setForm({ ...form, fromEmail: e.target.value })}
            />
          </div>
          <div>
            <Label>From name</Label>
            <Input
              className="mt-1 border-[var(--border-default)]"
              value={form.fromName}
              onChange={(e) => setForm({ ...form, fromName: e.target.value })}
            />
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="card-surface space-y-4 p-5">
          <h2 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">
            Who to target
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">
            ICP defaults to your vertical ({accountVertical}). Adjust cities and exclusions below.
          </p>
          <div>
            <Label>Target cities (comma-separated)</Label>
            <Input
              className="mt-1 border-[var(--border-default)]"
              placeholder="Phoenix AZ, Dallas TX"
              value={form.targetCities}
              onChange={(e) => setForm({ ...form, targetCities: e.target.value })}
            />
          </div>
          <div>
            <Label>Exclude domains</Label>
            <Input
              className="mt-1 border-[var(--border-default)]"
              placeholder="competitor.com"
              value={form.excludeDomains}
              onChange={(e) => setForm({ ...form, excludeDomains: e.target.value })}
            />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="card-surface space-y-4 p-5">
          <h2 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">
            Outreach schedule
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">
            Mon–Fri, 8am–5pm Eastern (default). Customize in settings later.
          </p>
          <div>
            <Label>Max new leads per day</Label>
            <Input
              type="number"
              className="mt-1 border-[var(--border-default)]"
              value={form.maxNewLeadsDay}
              onChange={(e) => setForm({ ...form, maxNewLeadsDay: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label>Max active sequences</Label>
            <Input
              type="number"
              className="mt-1 border-[var(--border-default)]"
              value={form.maxActiveLeads}
              onChange={(e) => setForm({ ...form, maxActiveLeads: Number(e.target.value) })}
            />
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          {loadingSearches ? (
            <p className="text-center text-sm text-[var(--text-secondary)]">Loading saved searches…</p>
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
        <div className="card-surface space-y-4 p-5">
          <h2 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">
            Review & launch
          </h2>
          <div className="rounded-[var(--radius-md)] border border-[var(--accent-border)] bg-[var(--accent-muted)] p-4 text-sm text-[var(--text-primary)]">
            Once active, {form.agentName} will find and contact real prospects. You can pause anytime.
          </div>
          <dl className="space-y-2 text-sm">
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
              <dt className="text-[var(--text-tertiary)]">Prospect mode</dt>
              <dd className="font-medium text-[var(--text-primary)]">
                {form.prospectMode.replace(/_/g, ' ')}
              </dd>
            </div>
            {(form.prospectMode === 'aspire_bound' || form.prospectMode === 'hybrid') && (
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--text-tertiary)]">Bindings</dt>
                <dd className="font-medium text-[var(--text-primary)]">
                  {form.bindings.length} saved search{form.bindings.length === 1 ? '' : 's'}
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}

      <div className="flex justify-between">
        <Button
          variant="outline"
          disabled={step === 0}
          onClick={() => setStep((s) => s - 1)}
          className="border-[var(--border-default)]"
        >
          Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button
            onClick={next}
            className="bg-[var(--accent)] text-[var(--text-primary)] hover:bg-[var(--accent-hover)]"
          >
            Continue
          </Button>
        ) : (
          <Button
            disabled={isPending}
            onClick={launch}
            className="bg-[var(--accent)] text-[var(--text-primary)] hover:bg-[var(--accent-hover)]"
          >
            Launch SDR Agent
          </Button>
        )}
      </div>
    </div>
  )
}
