import type { AppliedFix, DebugRunReport, DebugScope } from './types'
import { getDebugTestConfig } from './config'
import { runFullTestSuite, rerunTest, getFailedTests } from './checks'
import { executeFix, toAppliedFix } from './fixers'
import { buildSummary, formatDebugReport } from './report'
import { closeAdminSql } from './utils'
import { LARRY_FULL_NAME, LARRY_MANDATE, LARRY_NAME } from './guardrails'

const DEFAULT_SCOPE: DebugScope = {
  triggeredBy: 'scheduled',
  suspectLayers: ['api', 'auth', 'db', 'edge_fn', 'trigger_job', 'ui'],
  targetVertical: 'all',
  environment: process.env.VERCEL_ENV === 'production' ? 'production' : 'preview',
}

export interface RunLarryAnalysisOptions {
  scope?: Partial<DebugScope>
  /** When true, keeps applying fixes until all fixable failures pass or max attempts reached. */
  fixUntilResolved?: boolean
}

/** @deprecated Use RunLarryAnalysisOptions */
export type RunDebugAgentOptions = RunLarryAnalysisOptions

/**
 * Larry — autonomous debug agent.
 *
 * Scans the codebase (T0) and full runtime stack (T1–T7), applies fixes across
 * the entire monorepo, and re-verifies until resolved.
 */
export async function runLarryAnalysis(
  options: RunLarryAnalysisOptions = {},
): Promise<DebugRunReport> {
  const startedAt = new Date()
  const runId = `larry-${startedAt.toISOString().replace(/[:.]/g, '-')}`
  const scope: DebugScope = { ...DEFAULT_SCOPE, ...options.scope }
  const cfg = getDebugTestConfig()
  const fixUntilResolved = options.fixUntilResolved ?? true

  console.log(`[${LARRY_NAME}] Starting analysis — ${LARRY_MANDATE[0]}`)

  let results = await runFullTestSuite()
  const fixes: AppliedFix[] = []
  let attempt = 0
  const attemptedFixIds = new Set<string>()

  while (fixUntilResolved) {
    const failures = getFailedTests(results).filter(
      (f) => f.fixable && f.fixId && !attemptedFixIds.has(f.fixId),
    )
    if (failures.length === 0) break
    if (attempt >= cfg.maxFixAttempts) break

    attempt++
    let anyFixSucceeded = false

    for (const failure of failures) {
      if (failure.fixId) attemptedFixIds.add(failure.fixId)
      const fixResult = await executeFix(failure)
      fixes.push(toAppliedFix(failure, fixResult))

      if (fixResult.success) {
        anyFixSucceeded = true
        const retest = await rerunTest(failure.id)
        if (retest) {
          results = results.map((r) => (r.id === failure.id ? retest : r))
        }
      } else {
        // Don't retry non-actionable fixes in a loop (e.g. unreachable HTTP endpoints).
        results = results.map((r) => (r.id === failure.id ? { ...r, fixable: false } : r))
      }
    }

    if (anyFixSucceeded) {
      results = await runFullTestSuite()
    } else {
      break
    }
  }

  await closeAdminSql()

  const finishedAt = new Date()
  const unresolved = getFailedTests(results)
  const summary = buildSummary(results, fixes, unresolved)

  const report: DebugRunReport = {
    runId,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    scope,
    results,
    fixes,
    unresolved,
    summary,
    formattedReport: '',
  }

  report.formattedReport = formatDebugReport(report)

  console.log(`[${LARRY_NAME}] ${LARRY_FULL_NAME} — analysis complete`)
  console.log(report.formattedReport)

  return report
}

/** @deprecated Use runLarryAnalysis */
export const runDebugAgent = runLarryAnalysis
