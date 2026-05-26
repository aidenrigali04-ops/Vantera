import type { AppliedFix, DebugRunReport, DebugScope } from './types'
import { getDebugTestConfig } from './config'
import {
  runFullTestSuite,
  rerunTest,
  getFailedTests,
  getActionableSkips,
  retryActionableSkips,
  fixAttemptKey,
  mergeModuleResults,
  rerunModule,
} from './checks'
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
  const attemptedFixKeys = new Set<string>()

  while (fixUntilResolved) {
    const failures = getFailedTests(results).filter(
      (f) => f.fixable && f.fixId && !attemptedFixKeys.has(fixAttemptKey(f)),
    )

    const actionableSkips = getActionableSkips(results).filter(
      (s) => s.fixable && s.fixId && !attemptedFixKeys.has(fixAttemptKey(s)),
    )

    const fixTargets = [...failures, ...actionableSkips]
    if (fixTargets.length === 0) break
    if (attempt >= cfg.maxFixAttempts) break

    attempt++
    let anyFixSucceeded = false

    for (const target of fixTargets) {
      if (target.fixId) attemptedFixKeys.add(fixAttemptKey(target))
      const fixResult = await executeFix(target)
      fixes.push(toAppliedFix(target, fixResult))

      if (fixResult.success) {
        anyFixSucceeded = true
        const retest = await rerunTest(target.id)
        if (retest) {
          results = results.map((r) => (r.id === target.id ? retest : r))
        }

        // App probe fixes unlock whole HTTP-dependent modules.
        if (target.fixId === 'probe_app_urls') {
          for (const moduleId of ['T3', 'T4', 'T6']) {
            const fresh = await rerunModule(moduleId)
            results = mergeModuleResults(results, moduleId, fresh)
          }
        }
      } else if (target.status === 'fail') {
        results = results.map((r) =>
          r.id === target.id ? { ...r, fixable: false } : r,
        )
      }
    }

    if (anyFixSucceeded) {
      results = await runFullTestSuite()
      results = await retryActionableSkips(results)
    } else {
      break
    }
  }

  // Final verification pass — catches skips whose prerequisites were fixed mid-loop.
  results = await runFullTestSuite()
  results = await retryActionableSkips(results)

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
