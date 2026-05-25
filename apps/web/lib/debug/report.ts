import type { AppliedFix, DebugRunReport, TestResult } from './types'
import { LARRY_MANDATE, LARRY_NAME } from './guardrails'

function statusLine(result: TestResult, fixed: boolean): string {
  const base = `[${result.module}] ${result.name}`.padEnd(42, '.')
  if (result.status === 'pass') return `${base} ✅ PASS`
  if (result.status === 'skip') return `${base} ⚠️  SKIP`
  if (fixed) return `${base} ❌ FAIL → ✅ FIXED`
  return `${base} ❌ FAIL`
}

export function formatDebugReport(report: DebugRunReport): string {
  const fixedIds = new Set(report.fixes.filter((f) => f.success).map((f) => f.testId))

  const lines = [
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    `LARRY DEBUG RUN REPORT — ${LARRY_NAME}`,
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    `Run ID:        ${report.runId}`,
    `Environment:   ${report.scope.environment}`,
    `Triggered by:  ${report.scope.triggeredBy}`,
    `Duration:      ${(report.durationMs / 1000).toFixed(1)}s`,
    '',
    'TEST RESULTS',
    '━━━━━━━━━━━',
    ...report.results.map((r) => statusLine(r, fixedIds.has(r.id))),
    '',
    'FIXES APPLIED',
    '━━━━━━━━━━━━━',
  ]

  if (report.fixes.length === 0) {
    lines.push('None.')
  } else {
    report.fixes.forEach((fix, i) => {
      lines.push(`${i + 1}. [${fix.testId}] ${fix.fixId}`)
      lines.push(`   ${fix.description}`)
      lines.push(`   Result: ${fix.success ? '✅ Applied' : `🔴 Failed — ${fix.error}`}`)
    })
  }

  lines.push('', 'UNRESOLVED', '━━━━━━━━━━')
  if (report.unresolved.length === 0) {
    lines.push('None.')
  } else {
    for (const u of report.unresolved) {
      lines.push(`- [${u.module}] ${u.name}: ${u.error ?? 'unknown error'}`)
    }
  }

  lines.push(
    '',
    'LARRY GUARDRAILS (never violated)',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    ...LARRY_MANDATE.slice(3).map((rule) => `• ${rule}`),
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    `STATUS: ${report.summary.fixed} FIXED | ${report.summary.passed} PASSING | ${report.summary.unresolved} UNRESOLVED`,
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
  )

  return lines.join('\n')
}

export function buildSummary(
  results: TestResult[],
  fixes: AppliedFix[],
  unresolved: TestResult[],
): DebugRunReport['summary'] {
  const fixedCount = fixes.filter((f) => f.success).length
  return {
    total: results.length,
    passed: results.filter((r) => r.status === 'pass').length,
    failed: results.filter((r) => r.status === 'fail').length,
    skipped: results.filter((r) => r.status === 'skip').length,
    fixed: fixedCount,
    unresolved: unresolved.length,
  }
}
