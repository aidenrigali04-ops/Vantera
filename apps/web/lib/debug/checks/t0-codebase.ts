import { exec } from 'child_process'
import path from 'path'
import { promisify } from 'util'
import type { TestResult } from '../types'
import { assertLarryCanModify, filterLarryFixableFiles } from '../guardrails'

const execAsync = promisify(exec)

function getMonorepoRoot(): string {
  // apps/web/lib/debug/checks -> Vantera root (4 levels up from checks)
  return path.resolve(__dirname, '../../../../..')
}

function parseTypeScriptErrors(output: string): Array<{ file: string; line: number; message: string }> {
  const errors: Array<{ file: string; line: number; message: string }> = []
  const pattern = /^(.+\.tsx?)\((\d+),\d+\):\s+error\s+(TS\d+:\s+.+)$/gm
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

function parseEslintErrors(output: string): Array<{ file: string; line: number; message: string }> {
  const errors: Array<{ file: string; line: number; message: string }> = []
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
  const tsc = await runCommand(webDir, 'pnpm exec tsc --noEmit')
  const tsErrors = parseTypeScriptErrors(tsc.output)
  const tsFiles = [...new Set(tsErrors.map((e) => e.file))]
  const { allowed: fixableTs, blocked: blockedTs } = filterLarryFixableFiles(tsFiles)

  results.push({
    id: 'T0.1',
    module: 'T0',
    name: 'TypeScript compile (apps/web)',
    status: tsc.ok ? 'pass' : 'fail',
    category: 'api',
    severity: 'high',
    error: tsc.ok ? undefined : `${tsErrors.length} TypeScript error(s)`,
    details: {
      errorCount: tsErrors.length,
      errors: tsErrors.slice(0, 20),
      fixableFiles: fixableTs,
      blockedFiles: blockedTs,
    },
    fixable: false, // Code patches require Cursor Larry (guardrail-enforced)
  })

  // T0.2 — ESLint
  const lint = await runCommand(webDir, 'pnpm exec eslint . --max-warnings 0 --format unix 2>/dev/null || pnpm exec eslint . --max-warnings 0')
  const lintErrors = parseEslintErrors(lint.output)
  const lintFiles = [...new Set(lintErrors.map((e) => e.file))]
  const { allowed: fixableLint, blocked: blockedLint } = filterLarryFixableFiles(lintFiles, 'T0.2')

  results.push({
    id: 'T0.2',
    module: 'T0',
    name: 'ESLint (apps/web)',
    status: lint.ok ? 'pass' : 'fail',
    category: 'api',
    severity: 'medium',
    error: lint.ok ? undefined : `${lintErrors.length} ESLint error(s)`,
    details: {
      errorCount: lintErrors.length,
      errors: lintErrors.slice(0, 20),
      fixableFiles: fixableLint,
      blockedFiles: blockedLint,
    },
    fixable: lintErrors.length > 0,
    fixId: 'fix_eslint_errors',
  })

  // T0.3 — Guardrail self-check
  const probeBlocked = assertLarryCanModify('apps/web/components/ui/button.tsx')
  const probeAllowed = assertLarryCanModify('apps/web/lib/debug/agent.ts')
  results.push({
    id: 'T0.3',
    module: 'T0',
    name: 'Larry guardrails active',
    status: probeBlocked !== null && probeAllowed === null ? 'pass' : 'fail',
    category: 'config',
    severity: 'critical',
    error:
      probeBlocked === null || probeAllowed !== null
        ? 'Guardrail path rules misconfigured'
        : undefined,
    fixable: false,
  })

  return results
}

export async function rerunCodebaseTest(testId: string): Promise<TestResult | null> {
  const all = await runCodebaseChecks()
  return all.find((t) => t.id === testId) ?? null
}
