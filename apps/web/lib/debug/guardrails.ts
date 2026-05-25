/**
 * Larry — Vantera's autonomous debug agent.
 *
 * Larry scans for runtime/integration failures and applies minimal bug fixes.
 * He NEVER modifies UI, foundation code, architecture, or UX — except when
 * resolving a specific registered test failure (see LARRY_RESOLVABLE_TESTS).
 */

export const LARRY_NAME = 'Larry'
export const LARRY_FULL_NAME = 'Larry (Vantera Debug Agent)'

/** Tests Larry may resolve with scoped path overrides (debug-only). */
export const LARRY_RESOLVABLE_TESTS = new Set([
  'T0.2', // ESLint
  'T1.1', // Supabase admin WebSocket transport
  'T2.6', // Terminal win/loss stages
  'T3.0', // Health endpoint
  'T4.2', // Serverless health
  'T5.2', // Trigger.dev failed runs window
  'T6.1', // Portal home reachability
])

/**
 * Extra path patterns allowed when fixing a specific test ID.
 * Only applies to tests in LARRY_RESOLVABLE_TESTS — never a blanket UI/foundation waiver.
 */
export const LARRY_RESOLUTION_PATH_OVERRIDES: Record<string, RegExp[]> = {
  'T0.2': [
    /\/apps\/web\/components\//,
    /\/apps\/web\/hooks\//,
    /\/apps\/web\/app\//,
    /\/apps\/web\/lib\/ai\//,
    /\/apps\/web\/lib\/debug\//,
    /tailwind\.config\.ts$/,
  ],
  'T1.1': [/\/apps\/web\/lib\/supabase\//],
  'T2.6': [/\/apps\/web\/lib\/debug\//],
  'T3.0': [/\/apps\/web\/lib\/debug\//],
  'T4.2': [/\/apps\/web\/lib\/debug\//],
  'T5.2': [/\/apps\/web\/lib\/debug\//, /\/apps\/web\/trigger\//],
  'T6.1': [/\/apps\/web\/lib\/debug\//],
}

/** Paths/patterns Larry must NEVER modify — UI, foundation, architecture, UX. */
export const LARRY_BLOCKED_PATH_PATTERNS: RegExp[] = [
  // UI & UX
  /\/apps\/web\/components\//,
  /\/apps\/web\/app\/\(admin\)\//,
  /\/apps\/web\/app\/\(portal\)\//,
  /\/apps\/web\/app\/\(auth\)\//,
  /\/page\.tsx$/,
  /\/layout\.tsx$/,
  /\/loading\.tsx$/,
  /\/error\.tsx$/,
  /\/globals\.css$/,
  /tailwind\.config/,
  /postcss\.config/,
  /\/lib\/branding\//,
  /framer-motion/,
  // Foundation & architecture
  /\/packages\/db\/schema\.ts$/,
  /\/packages\/db\/migrations\//,
  /\/\.cursor\/architecture/,
  /\/turbo\.json$/,
  /\/pnpm-workspace\.yaml$/,
  /\/trigger\.config\.ts$/,
  /\/eslint\.config/,
  /\/tsconfig\.json$/,
  /\/next\.config/,
  /\/vercel\.json$/,
  /Vantera_Architecture/,
]

/** Paths Larry MAY patch when fixing a verified bug (debug-only). */
export const LARRY_ALLOWED_PATH_PATTERNS: RegExp[] = [
  /\/apps\/web\/lib\/debug\//,
  /\/apps\/web\/lib\/(auth|db|supabase|ai|env)\//,
  /\/apps\/web\/lib\/[^/]+\.ts$/,
  /\/apps\/web\/app\/api\//,
  /\/apps\/web\/trigger\//,
  /\/packages\/db\/scripts\//,
]

export const LARRY_MANDATE = [
  'Scan the codebase and runtime stack for errors and bugs.',
  'Apply the smallest possible fix that resolves the failure.',
  'Re-run failing checks until fixed or escalated as unresolved.',
  'NEVER change UI components, pages, layouts, styles, or branding (except scoped ESLint fixes for T0.2).',
  'NEVER change foundation code (schema, migrations, monorepo config, tsconfig).',
  'NEVER change architecture docs, project structure, or dependency graph.',
  'NEVER change UX flows, copy, animations, or visual behavior.',
  'Debug fixes only — logic errors, misconfig, bad queries, missing guards.',
] as const

export function normalizePath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/')
  return normalized.startsWith('/') ? normalized : `/${normalized}`
}

export function isLarryBlockedPath(filePath: string, testId?: string): boolean {
  const normalized = normalizePath(filePath)

  if (testId && LARRY_RESOLVABLE_TESTS.has(testId)) {
    const overrides = LARRY_RESOLUTION_PATH_OVERRIDES[testId]
    if (overrides?.some((pattern) => pattern.test(normalized))) {
      return false
    }
  }

  return LARRY_BLOCKED_PATH_PATTERNS.some((pattern) => pattern.test(normalized))
}

export function isLarryAllowedPath(filePath: string, testId?: string): boolean {
  const normalized = normalizePath(filePath)
  if (isLarryBlockedPath(normalized, testId)) return false
  return LARRY_ALLOWED_PATH_PATTERNS.some((pattern) => pattern.test(normalized))
}

/** Returns null if Larry may modify the file; otherwise a rejection reason. */
export function assertLarryCanModify(filePath: string, testId?: string): string | null {
  const normalized = normalizePath(filePath)

  if (testId && LARRY_RESOLVABLE_TESTS.has(testId)) {
    const overrides = LARRY_RESOLUTION_PATH_OVERRIDES[testId]
    if (overrides?.some((pattern) => pattern.test(normalized))) {
      return null
    }
  }

  if (LARRY_BLOCKED_PATH_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return `Larry cannot modify ${normalized} — protected (UI/foundation/architecture/UX)`
  }
  if (!LARRY_ALLOWED_PATH_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return `Larry cannot modify ${normalized} — outside debug-allowed paths`
  }
  return null
}

export function filterLarryFixableFiles(
  filePaths: string[],
  testId?: string,
): {
  allowed: string[]
  blocked: Array<{ path: string; reason: string }>
} {
  const allowed: string[] = []
  const blocked: Array<{ path: string; reason: string }> = []

  for (const filePath of filePaths) {
    const reason = assertLarryCanModify(filePath, testId)
    if (reason) blocked.push({ path: filePath, reason })
    else allowed.push(filePath)
  }

  return { allowed, blocked }
}
