import { exec } from 'child_process'
import path from 'path'
import { promisify } from 'util'
import type { TestResult } from '../types'
import { filterLarryFixableFiles } from '../guardrails'

const execAsync = promisify(exec)

function getMonorepoRoot(): string {
  // apps/web/lib/debug/checks -> Vantera root (4 levels up from checks)
  return path.resolve(__dirname, '../../../../..')
}

type ParsedError = { file: string; line: number; message: string }

function parseTypeScriptErrors(output: string): ParsedError[] {
  const errors: ParsedError[] = []
  const patterns = [
    /^(.+\.tsx?)\((\d+),\d+\):\s+error\s+(TS\d+:\s+.+)$/gm,
    /^(.+\.tsx?):(\d+):(\d+)\s+-\s+error\s+(TS\d+:\s+.+)$/gm,
  ]

  for (const pattern of patterns) {
    let match: RegExpExecArray | null
    while ((match = pattern.exec(output)) !== null) {
      if (!match[1] || !match[2] || !match[3]) continue
      errors.push({
        file: match[1],
        line: Number(match[2]),
        message: match[3],
      })
    }
  }

  return errors
}

function parseEslintUnixErrors(output: string): ParsedError[] {
  const errors: ParsedError[] = []
  const pattern = /^(.+\.tsx?)\s+(\d+):\d+\s+error\s+(.+)$/gm
  let match: RegExpExecArray | null
  while ((match = pattern.exec(output)) !== null) {
    if (!match[1] || !match[2] || !match[3]) continue
    errors.push({
      file: match[1],
      line: Number(match[2]),
      message: match[3],
    })
  }
  return errors
}

function parseEslintJsonErrors(output: string): ParsedError[] {
  try {
    const parsed = JSON.parse(output) as Array<{
      filePath?: string
      messages?: Array<{ line?: number; severity?: number; message?: string }>
    }>

    const errors: ParsedError[] = []
    for (const file of parsed) {
      if (!file.filePath || !Array.isArray(file.messages)) continue
      for (const message of file.messages) {
        if (message.severity !== 2) continue
        errors.push({
          file: file.filePath,
          line: message.line ?? 0,
          message: message.message ?? 'ESLint error',
        })
      }
    }
    return errors
  } catch {
    return parseEslintUnixErrors(output)
  }
}

function summarizeCommandFailure(
  label: string,
  parsedCount: number,
  output: string,
): string {
  if (parsedCount > 0) return `${parsedCount} ${label} error(s)`

  const snippet = output.replace(/\s+/g, ' ').trim().slice(0, 280)
  if (!snippet) return `${label} command failed with no output — re-run locally`
  if (/error TS\d+:/.test(output) || /\berror\b/i.test(output)) {
    return `${label} command failed — see details.rawOutput`
  }
  return `${label} command exited non-zero without parseable errors — see details.rawOutput`
}

function hasTypeScriptErrorMarkers(output: string): boolean {
  return /error TS\d+:/.test(output)
}

function hasEslintErrorMarkers(output: string): boolean {
  return /\berror\b/i.test(output) && !/^\s*✖\s+0 problems/m.test(output)
}

async function runCommand(cwd: string, command: string): Promise<{ ok: boolean; output: string }> {
  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd,
      maxBuffer: 10 * 1024 * 1024,
      env: process.env,
    })
    return { ok: true, output: `${stdout}\n${stderr}`.trim() }
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; message?: string }
    return {
      ok: false,
      output: [err.stdout, err.stderr, err.message].filter(Boolean).join('\n'),
    }
  }
}

/**
 * T0 — Static codebase scan (TypeScript + ESLint).
 * Larry uses this to find compile/lint errors before runtime tests.
 */
export async function runCodebaseChecks(): Promise<TestResult[]> {
  const results: TestResult[] = []
  const root = getMonorepoRoot()
  const webDir = path.join(root, 'apps/web')

  // T0.1 — TypeScript
  const tsc = await runCommand(webDir, 'pnpm exec tsc --noEmit --pretty false')
  const tsErrors = parseTypeScriptErrors(tsc.output)
  const tsHasMarkers = hasTypeScriptErrorMarkers(tsc.output)
  const tsPassed = tsc.ok || (tsErrors.length === 0 && !tsHasMarkers)
  const tsFiles = [...new Set(tsErrors.map((e) => e.file))]
  const { allowed: fixableTs, blocked: blockedTs } = filterLarryFixableFiles(tsFiles)

  results.push({
    id: 'T0.1',
    module: 'T0',
    name: 'TypeScript compile (apps/web)',
    status: tsPassed ? 'pass' : 'fail',
    category: 'api',
    severity: 'high',
    error: tsPassed ? undefined : summarizeCommandFailure('TypeScript', tsErrors.length, tsc.output),
    details: {
      errorCount: tsErrors.length,
      errors: tsErrors.slice(0, 20),
      fixableFiles: fixableTs,
      blockedFiles: blockedTs,
      rawOutput: tsPassed ? undefined : tsc.output.slice(0, 2000),
    },
    fixable: !tsPassed && tsErrors.length > 0,
    fixId: !tsPassed && tsErrors.length > 0 ? 'fix_typescript_errors' : undefined,
  })

  // T0.2 — ESLint (JSON for reliable parsing)
  const lint = await runCommand(
    webDir,
    'pnpm exec eslint . --max-warnings 0 --format json',
  )
  const lintErrors = parseEslintJsonErrors(lint.output)
  const lintHasMarkers = hasEslintErrorMarkers(lint.output)
  const lintPassed = lint.ok || (lintErrors.length === 0 && !lintHasMarkers)
  const lintFiles = [...new Set(lintErrors.map((e) => e.file))]
  const { allowed: fixableLint, blocked: blockedLint } = filterLarryFixableFiles(lintFiles, 'T0.2')

  results.push({
    id: 'T0.2',
    module: 'T0',
    name: 'ESLint (apps/web)',
    status: lintPassed ? 'pass' : 'fail',
    category: 'api',
    severity: 'medium',
    error: lintPassed ? undefined : summarizeCommandFailure('ESLint', lintErrors.length, lint.output),
    details: {
      errorCount: lintErrors.length,
      errors: lintErrors.slice(0, 20),
      fixableFiles: fixableLint,
      blockedFiles: blockedLint,
      rawOutput: lintPassed ? undefined : lint.output.slice(0, 2000),
    },
    fixable: !lintPassed && lintErrors.length > 0,
    fixId: !lintPassed && lintErrors.length > 0 ? 'fix_eslint_errors' : undefined,
  })

  return results
}

export async function rerunCodebaseTest(testId: string): Promise<TestResult | null> {
  const all = await runCodebaseChecks()
  return all.find((t) => t.id === testId) ?? null
}
