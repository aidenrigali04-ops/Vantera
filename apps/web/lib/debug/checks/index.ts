import type { TestResult } from '../types'
import { runCodebaseChecks } from './t0-codebase'
import { runAuthChecks } from './t1-auth'
import { runDatabaseChecks } from './t2-database'
import { runApiChecks } from './t3-api'
import { runEdgeChecks } from './t4-edge'
import { runTriggerChecks } from './t5-trigger'
import { runUiChecks } from './t6-ui'
import { runAutomationChecks } from './t7-automation'

const MODULE_RUNNERS: Record<string, () => Promise<TestResult[]>> = {
  T0: runCodebaseChecks,
  T1: runAuthChecks,
  T2: runDatabaseChecks,
  T3: runApiChecks,
  T4: runEdgeChecks,
  T5: runTriggerChecks,
  T6: runUiChecks,
  T7: runAutomationChecks,
}

/** Run the full T0–T7 suite in dependency order. Does not stop on first failure. */
export async function runFullTestSuite(): Promise<TestResult[]> {
  const results: TestResult[] = []

  for (const run of Object.values(MODULE_RUNNERS)) {
    results.push(...(await run()))
  }

  return results
}

/** Re-run an entire module (T0–T7) and merge into existing results. */
export async function rerunModule(moduleId: string): Promise<TestResult[]> {
  const run = MODULE_RUNNERS[moduleId]
  if (!run) return []
  return run()
}

export function mergeModuleResults(
  results: TestResult[],
  moduleId: string,
  moduleResults: TestResult[],
): TestResult[] {
  const withoutModule = results.filter((r) => r.module !== moduleId)
  return [...withoutModule, ...moduleResults]
}

/** Re-run a single test by ID after a fix attempt. */
export async function rerunTest(testId: string): Promise<TestResult | null> {
  const module = testId.slice(0, 2)
  const fresh = await rerunModule(module)
  return fresh.find((t) => t.id === testId) ?? null
}

export function getFailedTests(results: TestResult[]): TestResult[] {
  return results.filter((r) => r.status === 'fail')
}

export function getSkippedTests(results: TestResult[]): TestResult[] {
  return results.filter((r) => r.status === 'skip')
}

/** Skips that may pass after prerequisites (app up, auth seeded, etc.) are satisfied. */
export function getActionableSkips(results: TestResult[]): TestResult[] {
  return getSkippedTests(results).filter((skip) => {
    if (skip.fixable && skip.fixId) return true
    const reason = skip.error ?? ''
    return (
      reason.includes('App unreachable') ||
      reason.includes('No active admin user') ||
      reason.includes('cannot probe')
    )
  })
}

/**
 * Re-run modules whose skipped tests may now pass (e.g. after probe_app_urls fix).
 */
export async function retryActionableSkips(results: TestResult[]): Promise<TestResult[]> {
  let next = [...results]
  const actionable = getActionableSkips(next)
  if (actionable.length === 0) return next

  const modulesToRerun = new Set(actionable.map((s) => s.module))
  const appReachable = next.some((r) => r.id === 'T3.0' && r.status === 'pass')

  for (const moduleId of modulesToRerun) {
    const stillSkipped = next.some(
      (r) => r.module === moduleId && r.status === 'skip' && getActionableSkips([r]).length > 0,
    )
    if (!stillSkipped) continue

    // T3/T4/T6 app-dependent skips only retry when health probe passes.
    if (['T3', 'T4', 'T6'].includes(moduleId) && !appReachable) continue

    const fresh = await rerunModule(moduleId)
    next = mergeModuleResults(next, moduleId, fresh)
  }

  return next
}

export function fixAttemptKey(failure: TestResult): string {
  return `${failure.id}:${failure.fixId ?? 'none'}`
}
