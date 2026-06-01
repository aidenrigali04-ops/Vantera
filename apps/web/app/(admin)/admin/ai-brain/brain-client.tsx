'use client'

import { DashboardSection } from '@/components/dashboard/DashboardSection'
import { EmbeddedInsightsPanel } from '@/components/intelligence/EmbeddedInsightsPanel'
import { KpiStrip } from '@/components/operational/KpiStrip'
import { OperationalTable, type OperationalColumn } from '@/components/operational/OperationalTable'
import { PageHeader } from '@/components/operational/PageHeader'
import { StatusBadge } from '@/components/operational/table/StatusBadge'
import { SectionEmptyState } from '@/components/onboarding/SectionEmptyState'
import { Button } from '@/components/ui/button'
import type { EmbeddedInsight, InsightSeverity } from '@/lib/intelligence/types'
import { cn } from '@/lib/utils'
import {
  AlertCircle,
  Brain,
  CheckCircle2,
  Eye,
  RefreshCw,
  Sparkles,
  Zap,
} from 'lucide-react'
import { useMemo, useState, useTransition } from 'react'
import { rerunBootstrap, runDailySweep } from './actions'

type MemoryRow = {
  id: string
  kind: string
  subjectType: string
  subjectId: string
  summary: string
  confidence: number
  version: number
  modelUsed: string | null
  updatedAt: string
}

type ObservationRow = {
  id: string
  kind: string
  payload: Record<string, unknown>
  outcome: string | null
  occurredAt: string
}

type SignalRow = {
  id: string
  signalType: string
  severity: string
  headline: string
  recommendation: string
  confidenceScore: number
  createdAt: string
}

type Props = {
  role: string
  aiEnabled: boolean
  memory: MemoryRow[]
  observations: ObservationRow[]
  signals: SignalRow[]
}


function outcomeTone(outcome: string | null): 'success' | 'danger' | 'neutral' {
  if (!outcome) return 'neutral'
  if (outcome === 'success' || outcome === 'win') return 'success'
  return 'danger'
}

function summarizePayload(payload: Record<string, unknown>): string {
  const parts: string[] = []
  if (typeof payload.tool === 'string') parts.push(payload.tool)
  if (typeof payload.signalType === 'string') parts.push(`signal=${payload.signalType}`)
  if (typeof payload.channel === 'string') parts.push(`channel=${payload.channel}`)
  if (typeof payload.intent === 'string') parts.push(`intent=${payload.intent}`)
  if (typeof payload.severity === 'string') parts.push(`severity=${payload.severity}`)
  if (typeof payload.latencyMs === 'number') parts.push(`${payload.latencyMs}ms`)
  if (typeof payload.errorMessage === 'string') parts.push(`err: ${payload.errorMessage.slice(0, 60)}`)
  return parts.join(' · ') || '—'
}

export function BrainClient({ role, aiEnabled, memory, observations, signals }: Props) {
  const [bootstrapMessage, setBootstrapMessage] = useState<string | null>(null)
  const [sweepMessage, setSweepMessage] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const [bootstrapping, setBootstrapping] = useState(false)
  const [sweeping, setSweeping] = useState(false)

  const canTrigger = role === 'owner'

  const embeddedSignals = useMemo<EmbeddedInsight[]>(
    () =>
      signals.map((signal) => ({
        id: signal.id,
        headline: signal.headline,
        recommendation: signal.recommendation,
        severity: signal.severity as InsightSeverity,
        actionLabel: 'View in workspace',
        actionHref: '/admin/dashboard',
        dismissible: true,
        source: 'signal' as const,
      })),
    [signals],
  )

  const observationColumns = useMemo<OperationalColumn<ObservationRow>[]>(
    () => [
      {
        id: 'kind',
        header: 'Kind',
        cell: (row) => (
          <span className="font-mono text-[12px] text-stone-700">{row.kind}</span>
        ),
      },
      {
        id: 'payload',
        header: 'Payload',
        cell: (row) => (
          <span className="text-stone-600">{summarizePayload(row.payload)}</span>
        ),
      },
      {
        id: 'outcome',
        header: 'Outcome',
        cell: (row) =>
          row.outcome ? (
            <StatusBadge label={row.outcome} tone={outcomeTone(row.outcome)} />
          ) : (
            '—'
          ),
      },
      {
        id: 'when',
        header: 'When',
        sortable: true,
        cell: (row) => (
          <span className="text-stone-500">
            {new Date(row.occurredAt).toLocaleString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </span>
        ),
      },
    ],
    [],
  )

  async function handleBootstrap() {
    setBootstrapMessage(null)
    setBootstrapping(true)
    const result = await rerunBootstrap()
    setBootstrapping(false)
    if (result.success) {
      setBootstrapMessage(`Bootstrap started at ${new Date(result.data.ranAt).toLocaleTimeString()}.`)
      startTransition(() => {
        window.location.reload()
      })
    } else {
      setBootstrapMessage(result.error)
    }
  }

  async function handleSweep() {
    setSweepMessage(null)
    setSweeping(true)
    const result = await runDailySweep()
    setSweeping(false)
    if (result.success) {
      setSweepMessage(`Sweep started at ${new Date(result.data.ranAt).toLocaleTimeString()}.`)
      startTransition(() => {
        window.location.reload()
      })
    } else {
      setSweepMessage(result.error)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Insights"
        description="Persistent memory, proactive signals, and operational observations — embedded in your workflows, not a separate chatbot."
        actions={
          canTrigger ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={handleBootstrap}
                disabled={bootstrapping || !aiEnabled}
                variant="outline"
                size="sm"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                {bootstrapping ? 'Working…' : 'Re-run bootstrap'}
              </Button>
              <Button
                onClick={handleSweep}
                disabled={sweeping || !aiEnabled}
                variant="outline"
                size="sm"
              >
                <RefreshCw className={cn('mr-2 h-4 w-4', sweeping && 'animate-spin')} />
                {sweeping ? 'Sweeping…' : 'Run daily sweep'}
              </Button>
            </div>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        {aiEnabled ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200/80">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            Intelligence layer active
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-[11px] font-medium text-amber-800 ring-1 ring-amber-200/80">
            <AlertCircle className="h-3.5 w-3.5" aria-hidden />
            Set ANTHROPIC_API_KEY to enable
          </span>
        )}
        {bootstrapMessage ? (
          <span className="text-[12px] text-stone-500">{bootstrapMessage}</span>
        ) : null}
        {sweepMessage ? <span className="text-[12px] text-stone-500">{sweepMessage}</span> : null}
      </div>

      <KpiStrip
        items={[
          { label: 'Memory', value: memory.length, icon: Brain },
          { label: 'Signals', value: signals.length, icon: Zap },
          { label: 'Observations', value: observations.length, icon: Eye },
          {
            label: 'Status',
            value: aiEnabled ? 'Active' : 'Off',
            change: aiEnabled ? 'Model connected' : 'Configure API key',
            trend: aiEnabled ? 'up' : 'neutral',
          },
        ]}
      />

      <DashboardSection
        title="Proactive signals"
        subtitle="Workflow-native recommendations surfaced across dashboard, clients, and pipeline."
        action={{ label: 'Dashboard feed', href: '/admin/dashboard' }}
      >
        <EmbeddedInsightsPanel
          insights={embeddedSignals}
          title=""
          subtitle=""
          emptyMessage="No signals yet. The intelligence layer produces these during bootstrap and each daily sweep."
        />
      </DashboardSection>

      <DashboardSection
        title="What the system remembers"
        subtitle={`${memory.length} memory ${memory.length === 1 ? 'entry' : 'entries'} for this workspace`}
      >
        {memory.length === 0 ? (
          <SectionEmptyState
            icon={Brain}
            title="No memory yet"
            description="Run bootstrap once an Anthropic key is configured to seed operational context."
            actionLabel={canTrigger && aiEnabled ? 'Re-run bootstrap' : 'Configure API key'}
            onAction={() => {
              if (canTrigger && aiEnabled) void handleBootstrap()
            }}
          />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {memory.map((row) => (
              <article
                key={row.id}
                className="rounded-xl border border-stone-200 bg-stone-50/50 p-4 transition-colors hover:border-stone-300"
              >
                <div className="flex items-center justify-between gap-2">
                  <StatusBadge label={row.kind} tone="neutral" />
                  <span className="text-[11px] font-medium text-stone-400">v{row.version}</span>
                </div>
                <p className="mt-3 text-[13px] leading-relaxed text-stone-800">{row.summary}</p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-stone-500">
                  <span>
                    {row.confidence}% confidence · {row.modelUsed ?? 'unknown model'}
                  </span>
                  <span>
                    {new Date(row.updatedAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
                <p className="mt-2 font-mono text-[10px] text-stone-400">
                  {row.subjectType}/{row.subjectId.slice(0, 8)}…
                </p>
              </article>
            ))}
          </div>
        )}
      </DashboardSection>

      <DashboardSection
        title="Recent observations"
        subtitle="Tool runs, signal generation, and agent activity logged for this account."
      >
        <OperationalTable
          columns={observationColumns}
          rows={observations}
          emptyState={
            <SectionEmptyState
              title="No observations yet"
              description="Agent and automation activity will appear here as the intelligence layer runs."
              actionLabel="View dashboard"
              onAction={() => {
                window.location.href = '/admin/dashboard'
              }}
            />
          }
        />
      </DashboardSection>
    </div>
  )
}
