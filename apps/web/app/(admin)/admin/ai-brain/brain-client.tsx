'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { AlertCircle, Brain, CheckCircle2, RefreshCw, Sparkles } from 'lucide-react'
import { useState, useTransition } from 'react'
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

export function BrainClient({ role, aiEnabled, memory, observations, signals }: Props) {
  const [bootstrapMessage, setBootstrapMessage] = useState<string | null>(null)
  const [sweepMessage, setSweepMessage] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const [bootstrapping, setBootstrapping] = useState(false)
  const [sweeping, setSweeping] = useState(false)

  const canTrigger = role === 'owner'

  async function handleBootstrap() {
    setBootstrapMessage(null)
    setBootstrapping(true)
    const result = await rerunBootstrap()
    setBootstrapping(false)
    if (result.success) {
      setBootstrapMessage(`Bootstrap kicked off at ${new Date(result.data.ranAt).toLocaleTimeString()}.`)
      startTransition(() => {
        window.location.reload()
      })
    } else {
      setBootstrapMessage(`Failed: ${result.error}`)
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
      setSweepMessage(`Failed: ${result.error}`)
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <Brain className="h-6 w-6 text-foreground" />
          <h1 className="text-2xl font-semibold tracking-tight">AI Brain</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Persistent memory, recent observations, and proactive signals generated for this account.
        </p>
        <StatusPill aiEnabled={aiEnabled} />
      </header>

      {canTrigger ? (
        <section className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4">
          <Button onClick={handleBootstrap} disabled={bootstrapping || !aiEnabled} variant="outline" size="sm">
            <Sparkles className="mr-2 h-4 w-4" />
            {bootstrapping ? 'Working…' : 'Re-run bootstrap'}
          </Button>
          <Button onClick={handleSweep} disabled={sweeping || !aiEnabled} variant="outline" size="sm">
            <RefreshCw className={cn('mr-2 h-4 w-4', sweeping && 'animate-spin')} />
            {sweeping ? 'Sweeping…' : 'Run daily sweep'}
          </Button>
          {bootstrapMessage ? <span className="text-xs text-muted-foreground">{bootstrapMessage}</span> : null}
          {sweepMessage ? <span className="text-xs text-muted-foreground">{sweepMessage}</span> : null}
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          What the brain knows ({memory.length})
        </h2>
        {memory.length === 0 ? (
          <EmptyCard label="No memory yet. Run bootstrap once an Anthropic key is configured." />
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {memory.map((row) => (
              <article key={row.id} className="space-y-2 rounded-lg border bg-card p-4">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-mono uppercase text-muted-foreground">{row.kind}</span>
                  <span className="text-muted-foreground">v{row.version}</span>
                </div>
                <p className="text-sm leading-relaxed">{row.summary}</p>
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    Confidence {row.confidence}% · {row.modelUsed ?? 'unknown model'}
                  </span>
                  <span>{new Date(row.updatedAt).toLocaleString()}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Proactive signals ({signals.length})
        </h2>
        {signals.length === 0 ? (
          <EmptyCard label="No signals yet. The brain produces these during bootstrap and each daily sweep." />
        ) : (
          <div className="space-y-2">
            {signals.map((s) => (
              <article key={s.id} className="space-y-1 rounded-lg border bg-card p-4">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <SeverityPill severity={s.severity} />
                  <span className="text-muted-foreground">
                    {new Date(s.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm font-medium">{s.headline}</p>
                <p className="text-xs text-muted-foreground">{s.recommendation}</p>
                <p className="text-xs text-muted-foreground">
                  <span className="font-mono">{s.signalType}</span> · {s.confidenceScore}%
                </p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Recent observations ({observations.length})
        </h2>
        {observations.length === 0 ? (
          <EmptyCard label="No observations recorded yet." />
        ) : (
          <div className="overflow-hidden rounded-lg border bg-card">
            <table className="w-full text-xs">
              <thead className="bg-muted/30 text-left text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Kind</th>
                  <th className="px-3 py-2 font-medium">Tool / payload</th>
                  <th className="px-3 py-2 font-medium">Outcome</th>
                  <th className="px-3 py-2 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {observations.map((o) => (
                  <tr key={o.id} className="border-t">
                    <td className="px-3 py-2 font-mono text-foreground">{o.kind}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {summarizePayload(o.payload)}
                    </td>
                    <td className="px-3 py-2">
                      <OutcomePill outcome={o.outcome} />
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {new Date(o.occurredAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function StatusPill({ aiEnabled }: { aiEnabled: boolean }) {
  if (aiEnabled) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700">
        <CheckCircle2 className="h-3 w-3" />
        AI brain is active
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-700">
      <AlertCircle className="h-3 w-3" />
      Set ANTHROPIC_API_KEY to enable
    </span>
  )
}

function SeverityPill({ severity }: { severity: string }) {
  const style =
    severity === 'red'
      ? 'bg-red-500/10 text-red-700'
      : severity === 'yellow'
        ? 'bg-amber-500/10 text-amber-700'
        : 'bg-emerald-500/10 text-emerald-700'
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium uppercase', style)}>{severity}</span>
  )
}

function OutcomePill({ outcome }: { outcome: string | null }) {
  if (!outcome) return <span className="text-muted-foreground">—</span>
  const ok = outcome === 'success' || outcome === 'win'
  return (
    <span
      className={cn(
        'rounded px-2 py-0.5 text-[10px] font-medium uppercase',
        ok ? 'bg-emerald-500/10 text-emerald-700' : 'bg-red-500/10 text-red-700',
      )}
    >
      {outcome}
    </span>
  )
}

function EmptyCard({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-center text-xs text-muted-foreground">
      {label}
    </div>
  )
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
