import { env } from '@/lib/env'
import type { TestResult } from '../types'
import { REQUIRED_TRIGGER_JOBS } from '../config'
import { fetchWithTimeout } from '../utils'

/** Larry's own scheduled sweeps — excluded from T5.2 to avoid self-referential failure loops. */
const LARRY_SELF_TASK_IDS = new Set(['debug-agent-sweep', 'larry-sweep'])

export async function runTriggerChecks(): Promise<TestResult[]> {
  const results: TestResult[] = []

  const triggerKey = env.TRIGGER_SECRET_KEY
  if (!triggerKey) {
    results.push({
      id: 'T5.0',
      module: 'T5',
      name: 'Trigger.dev API key configured',
      status: 'skip',
      category: 'trigger',
      severity: 'high',
      error: 'TRIGGER_SECRET_KEY not set',
      fixable: false,
    })
    return results
  }

  results.push({
    id: 'T5.0',
    module: 'T5',
    name: 'Trigger.dev API key configured',
    status: 'pass',
    category: 'trigger',
    severity: 'high',
    fixable: false,
  })

  const apiUrl = (env.TRIGGER_API_URL ?? 'https://api.trigger.dev').replace(/\/$/, '')

  // T5.2 — Recent failed runs (last 24h only, excluding Larry self-runs)
  try {
    const res = await fetchWithTimeout(`${apiUrl}/api/v1/runs?status=FAILED&limit=50`, {
      headers: { Authorization: `Bearer ${triggerKey}` },
    })

    if (!res.ok) {
      results.push({
        id: 'T5.2',
        module: 'T5',
        name: 'No recent failed Trigger.dev runs',
        status: 'skip',
        category: 'trigger',
        severity: 'high',
        error: `Trigger API returned ${res.status}`,
        fixable: false,
      })
    } else {
      const body = (await res.json()) as {
        data?: Array<{ finishedAt?: string; createdAt?: string; taskIdentifier?: string }>
      }
      const cutoffMs = Date.now() - 24 * 60 * 60 * 1000
      const recentFailures = (body.data ?? []).filter((run) => {
        if (LARRY_SELF_TASK_IDS.has(run.taskIdentifier ?? '')) return false
        const ts = run.finishedAt ?? run.createdAt
        if (!ts) return false
        return new Date(ts).getTime() >= cutoffMs
      })

      results.push({
        id: 'T5.2',
        module: 'T5',
        name: 'No recent failed Trigger.dev runs',
        status: recentFailures.length === 0 ? 'pass' : 'fail',
        category: 'trigger',
        severity: 'high',
        error: recentFailures.length
          ? `${recentFailures.length} failed run(s) in last 24h`
          : undefined,
        details: {
          failureCount: recentFailures.length,
          tasks: [...new Set(recentFailures.map((r) => r.taskIdentifier).filter(Boolean))],
        },
        fixable: recentFailures.length > 0,
        fixId: recentFailures.length > 0 ? 'investigate_trigger_failures' : undefined,
      })
    }
  } catch (error) {
    results.push({
      id: 'T5.2',
      module: 'T5',
      name: 'No recent failed Trigger.dev runs',
      status: 'fail',
      category: 'trigger',
      severity: 'high',
      error: error instanceof Error ? error.message : 'Trigger API unreachable',
      fixable: false,
    })
  }

  // T5.1 — Job registry (best-effort; API shape may vary by Trigger version)
  try {
    const res = await fetchWithTimeout(`${apiUrl}/api/v1/tasks`, {
      headers: { Authorization: `Bearer ${triggerKey}` },
    })

    if (res.ok) {
      const body = (await res.json()) as { data?: Array<{ slug?: string; id?: string }> }
      const slugs = new Set((body.data ?? []).map((j) => j.slug ?? j.id))
      const missing = REQUIRED_TRIGGER_JOBS.filter((job) => !slugs.has(job))
      results.push({
        id: 'T5.1',
        module: 'T5',
        name: 'Required Trigger.dev jobs registered',
        status: missing.length === 0 ? 'pass' : 'fail',
        category: 'trigger',
        severity: 'high',
        error: missing.length ? `Missing jobs: ${missing.join(', ')}` : undefined,
        details: { missing },
        fixable: false,
      })
    } else {
      results.push({
        id: 'T5.1',
        module: 'T5',
        name: 'Required Trigger.dev jobs registered',
        status: 'skip',
        category: 'trigger',
        severity: 'high',
        error: `Could not list tasks (HTTP ${res.status})`,
        fixable: false,
      })
    }
  } catch {
    results.push({
      id: 'T5.1',
      module: 'T5',
      name: 'Required Trigger.dev jobs registered',
      status: 'skip',
      category: 'trigger',
      severity: 'high',
      error: 'Trigger tasks API unavailable',
      fixable: false,
    })
  }

  // T5.3/T5.4 — job simulations require deployed automation jobs
  for (const [id, name] of [
    ['T5.3', 'Missed call simulation'],
    ['T5.4', 'Invoice overdue scan simulation'],
  ] as const) {
    results.push({
      id,
      module: 'T5',
      name,
      status: 'skip',
      category: 'trigger',
      severity: 'medium',
      error: 'Automation engine jobs not yet deployed',
      fixable: false,
    })
  }

  return results
}

export async function rerunTriggerTest(testId: string): Promise<TestResult | null> {
  const all = await runTriggerChecks()
  return all.find((t) => t.id === testId) ?? null
}
