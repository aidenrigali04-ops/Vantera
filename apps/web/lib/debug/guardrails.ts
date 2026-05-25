/**
 * Larry — Vantera's autonomous debug agent.
 *
 * Unrestricted mode: Larry may analyze and patch any file in the monorepo
 * to fix verified bugs, errors, and test failures across the full stack.
 */

export const LARRY_NAME = 'Larry'
export const LARRY_FULL_NAME = 'Larry (Vantera Debug Agent)'

/** All tests are eligible for Larry-driven resolution (no test-id allowlist). */
export const LARRY_RESOLVABLE_TESTS = new Set<string>()

/** @deprecated Unrestricted mode — overrides are unused. */
export const LARRY_RESOLUTION_PATH_OVERRIDES: Record<string, RegExp[]> = {}

/** @deprecated Unrestricted mode — no paths are blocked. */
export const LARRY_BLOCKED_PATH_PATTERNS: RegExp[] = []

/** @deprecated Unrestricted mode — all repo paths are allowed. */
export const LARRY_ALLOWED_PATH_PATTERNS: RegExp[] = [/^/]

export const LARRY_MANDATE = [
  'Scan the entire codebase and runtime stack for errors and bugs.',
  'Apply the smallest correct fix that resolves each verified failure.',
  'Re-run failing checks until fixed or escalated as unresolved.',
  'May modify any file in the monorepo — UI, API, lib, packages, config, migrations.',
  'May fix onboarding, auth, database, triggers, edge functions, and integrations.',
  'Prefer minimal diffs; do not refactor unrelated code while fixing a bug.',
  'Re-verify with type-check, tests, and the T0–T7 suite after each fix.',
] as const

export function normalizePath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/')
  return normalized.startsWith('/') ? normalized : `/${normalized}`
}

export function isLarryBlockedPath(_filePath: string, _testId?: string): boolean {
  return false
}

export function isLarryAllowedPath(_filePath: string, _testId?: string): boolean {
  return true
}

/** Returns null when Larry may modify the file (always, in unrestricted mode). */
export function assertLarryCanModify(_filePath: string, _testId?: string): string | null {
  return null
}

export function filterLarryFixableFiles(
  filePaths: string[],
  _testId?: string,
): {
  allowed: string[]
  blocked: Array<{ path: string; reason: string }>
} {
  return { allowed: [...filePaths], blocked: [] }
}
