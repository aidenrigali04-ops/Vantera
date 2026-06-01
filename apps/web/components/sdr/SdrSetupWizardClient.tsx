'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getIcpConfigForVertical } from '@/lib/aspire/icp-score'
import type { CreateSDRConfigInput } from '@/lib/sdr/types'
import { DEFAULT_OUTREACH_WINDOW } from '@/lib/sdr/types'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

const STEPS = ['Identity', 'ICP', 'Schedule', 'Launch'] as const

type Props = {
  accountVertical: string
  accountName: string
}

export function SdrSetupWizardClient({ accountVertical, accountName }: Props) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [isPending, startTransition] = useTransition()
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
  })

  function next() {
    if (step === 0 && (!form.agentName || !form.fromEmail || !form.fromName)) {
      toast.error('Complete agent identity fields')
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
      toast.success(`${form.agentName} is live — finding and contacting leads`)
      router.push('/admin/outreach/agents')
      router.refresh()
    })
  }

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <div className="flex justify-center gap-2">
        {STEPS.map((label, index) => (
          <span
            key={label}
            className={`h-2 w-2 rounded-full ${index <= step ? 'bg-stone-900' : 'bg-stone-200'}`}
            title={label}
          />
        ))}
      </div>

      {step === 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Agent identity</h2>
          <div>
            <Label>Agent first name</Label>
            <Input
              className="mt-1"
              value={form.agentName}
              onChange={(e) => setForm({ ...form, agentName: e.target.value })}
            />
          </div>
          <div>
            <Label>Job title</Label>
            <Input
              className="mt-1"
              value={form.agentTitle}
              onChange={(e) => setForm({ ...form, agentTitle: e.target.value })}
            />
          </div>
          <div>
            <Label>From email</Label>
            <Input
              type="email"
              className="mt-1"
              placeholder="alex@yourdomain.com"
              value={form.fromEmail}
              onChange={(e) => setForm({ ...form, fromEmail: e.target.value })}
            />
          </div>
          <div>
            <Label>From name</Label>
            <Input
              className="mt-1"
              value={form.fromName}
              onChange={(e) => setForm({ ...form, fromName: e.target.value })}
            />
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Who to target</h2>
          <p className="text-sm text-stone-600">
            ICP defaults to your vertical ({accountVertical}). Adjust cities and exclusions below.
          </p>
          <div>
            <Label>Target cities (comma-separated)</Label>
            <Input
              className="mt-1"
              placeholder="Phoenix AZ, Dallas TX"
              value={form.targetCities}
              onChange={(e) => setForm({ ...form, targetCities: e.target.value })}
            />
          </div>
          <div>
            <Label>Exclude domains</Label>
            <Input
              className="mt-1"
              placeholder="competitor.com"
              value={form.excludeDomains}
              onChange={(e) => setForm({ ...form, excludeDomains: e.target.value })}
            />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Outreach schedule</h2>
          <p className="text-sm text-stone-600">Mon–Fri, 8am–5pm Eastern (default). Customize in settings later.</p>
          <div>
            <Label>Max new leads per day</Label>
            <Input
              type="number"
              className="mt-1"
              value={form.maxNewLeadsDay}
              onChange={(e) => setForm({ ...form, maxNewLeadsDay: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label>Max active sequences</Label>
            <Input
              type="number"
              className="mt-1"
              value={form.maxActiveLeads}
              onChange={(e) => setForm({ ...form, maxActiveLeads: Number(e.target.value) })}
            />
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Review & launch</h2>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Once active, {form.agentName} will find and contact real prospects. You can pause anytime.
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-stone-500">Agent</dt>
              <dd>{form.agentName}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-stone-500">From</dt>
              <dd>{form.fromName} &lt;{form.fromEmail}&gt;</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-stone-500">Daily cap</dt>
              <dd>{form.maxNewLeadsDay} leads</dd>
            </div>
          </dl>
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
          Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={next}>Continue</Button>
        ) : (
          <Button disabled={isPending} onClick={launch}>
            Launch SDR Agent
          </Button>
        )}
      </div>
    </div>
  )
}
