import { sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { automationRuns } from '@vantera/db'
import type { TestResult } from '../types'

export async function runAutomationChecks(): Promise<TestResult[]> {
  const results: TestResult[] = []

  // T7.2 — automation_runs table accessible
  try {
    await db.select({ id: automationRuns.id }).from(automationRuns).limit(1)
    results.push({
      id: 'T7.2',
      module: 'T7',
      name: 'Automation runs table accessible',
      status: 'pass',
      category: 'automation',
      severity: 'medium',
      fixable: false,
    })
  } catch (error) {
    results.push({
      id: 'T7.2',
      module: 'T7',
      name: 'Automation runs table accessible',
      status: 'fail',
      category: 'automation',
      severity: 'high',
      error: error instanceof Error ? error.message : 'query failed',
      fixable: false,
    })
  }

  // T7.1 — Full HVAC lifecycle (requires automation engine)
  results.push({
    id: 'T7.1',
    module: 'T7',
    name: 'HVAC full job lifecycle E2E',
    status: 'skip',
    category: 'automation',
    severity: 'high',
    error: 'Automation engine runtime not yet implemented',
    fixable: false,
  })

  // T7.3 — AI messaging gate
  results.push({
    id: 'T7.3',
    module: 'T7',
    name: 'Feature flag AI messaging gate',
    status: 'skip',
    category: 'automation',
    severity: 'critical',
    error: 'Requires automation executor + feature flag middleware',
    fixable: false,
  })

  // Check for failed automation runs in last 24h
  const failedRuns = await db
    .select({ id: automationRuns.id })
    .from(automationRuns)
    .where(
      sql`${automationRuns.status} = 'failed' AND ${automationRuns.executedAt} > now() - interval '24 hours'`,
    )
    .limit(20)

  results.push({
    id: 'T7.0',
    module: 'T7',
    name: 'No failed automation runs (24h)',
    status: failedRuns.length === 0 ? 'pass' : 'fail',
    category: 'automation',
    severity: 'high',
    error: failedRuns.length ? `${failedRuns.length} failed automation run(s)` : undefined,
    details: { count: failedRuns.length },
    fixable: false,
  })

  return results
}

export async function rerunAutomationTest(testId: string): Promise<TestResult | null> {
  const all = await runAutomationChecks()
  return all.find((t) => t.id === testId) ?? null
}
