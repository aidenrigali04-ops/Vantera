import type { TestResult } from '../types'
import { runCodebaseChecks } from './t0-codebase'
import { runAuthChecks } from './t1-auth'
import { runDatabaseChecks } from './t2-database'
import { runApiChecks } from './t3-api'
import { runEdgeChecks } from './t4-edge'
import { runTriggerChecks } from './t5-trigger'
import { runUiChecks } from './t6-ui'
import { runAutomationChecks } from './t7-automation'

/** Run the full T0–T7 suite in dependency order. Does not stop on first failure. */
export async function runFullTestSuite(): Promise<TestResult[]> {
  const results: TestResult[] = []

  results.push(...(await runCodebaseChecks()))
  results.push(...(await runAuthChecks()))
  results.push(...(await runDatabaseChecks()))
  results.push(...(await runApiChecks()))
  results.push(...(await runEdgeChecks()))
  results.push(...(await runTriggerChecks()))
  results.push(...(await runUiChecks()))
  results.push(...(await runAutomationChecks()))

  return results
}

/** Re-run a single test by ID after a fix attempt. */
export async function rerunTest(testId: string): Promise<TestResult | null> {
  const module = testId.slice(0, 2)
  switch (module) {
    case 'T0':
      return (await runCodebaseChecks()).find((t) => t.id === testId) ?? null
    case 'T1':
      return (await runAuthChecks()).find((t) => t.id === testId) ?? null
    case 'T2':
      return (await runDatabaseChecks()).find((t) => t.id === testId) ?? null
    case 'T3':
      return (await runApiChecks()).find((t) => t.id === testId) ?? null
    case 'T4':
      return (await runEdgeChecks()).find((t) => t.id === testId) ?? null
    case 'T5':
      return (await runTriggerChecks()).find((t) => t.id === testId) ?? null
    case 'T6':
      return (await runUiChecks()).find((t) => t.id === testId) ?? null
    case 'T7':
      return (await runAutomationChecks()).find((t) => t.id === testId) ?? null
    default:
      return null
  }
}

export function getFailedTests(results: TestResult[]): TestResult[] {
  return results.filter((r) => r.status === 'fail')
}
