import { existsSync, readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

/** Canonical env vars Larry + Trigger tasks need at runtime in Trigger.dev cloud. */
const TRIGGER_SYNC_ENV_KEYS = [
  'DATABASE_URL',
  'DIRECT_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_JWT_SECRET',
  'NEXT_PUBLIC_APP_DOMAIN',
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'ANTHROPIC_API_KEY',
  'RESEND_API_KEY',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_PHONE_NUMBER',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'TRIGGER_SECRET_KEY',
  'TRIGGER_API_URL',
  'CRON_SECRET',
  'INTERNAL_API_BASE_URL',
  'GITHUB_TOKEN',
  'GITHUB_REPO',
  'DEBUG_TEST_ACCOUNT_ID_TEAM',
  'DEBUG_TEST_ACCOUNT_ID_ENTERPRISE',
  'DEBUG_TEST_CONTACT_ID_A',
  'DEBUG_TEST_CONTACT_ID_B',
  'DEBUG_TEST_CONTACT_ID_OTHER_ACCOUNT',
  'DEBUG_TEST_PORTAL_DOMAIN',
  'DEBUG_MAX_FIX_ATTEMPTS',
] as const

function sanitizeEnvValue(value: string): string {
  let trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    trimmed = trimmed.slice(1, -1).trim()
  }
  return trimmed
}

function parseEnvFile(content: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const value = sanitizeEnvValue(trimmed.slice(eq + 1))
    if (key) out[key] = value
  }
  return out
}

function findMonorepoRoot(startDir: string): string {
  let dir = resolve(startDir)
  while (true) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) {
      return dir
    }
    const parent = dirname(dir)
    if (parent === dir) {
      return startDir
    }
    dir = parent
  }
}

function loadEnvFiles(): Record<string, string> {
  const root = findMonorepoRoot(dirname(fileURLToPath(import.meta.url)))
  const candidates = [
    process.env.VANTERA_ENV_FILE,
    resolve(root, '.env'),
    resolve(root, 'apps/web/.env'),
  ].filter((path): path is string => Boolean(path))

  const merged: Record<string, string> = {}
  const seen = new Set<string>()

  for (const envPath of candidates) {
    if (seen.has(envPath) || !existsSync(envPath)) continue
    seen.add(envPath)
    Object.assign(merged, parseEnvFile(readFileSync(envPath, 'utf-8')))
  }

  // Shell / dotenv-cli vars win over file values (matches load-project-env behavior).
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === 'string' && value.length > 0) {
      merged[key] = sanitizeEnvValue(value)
    }
  }

  return merged
}

function applyAliases(env: Record<string, string>): void {
  env.TRIGGER_SECRET_KEY = env.TRIGGER_SECRET_KEY ?? env.TRIGGER_API_KEY
  env.SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_KEY
  env.SUPABASE_JWT_SECRET = env.SUPABASE_JWT_SECRET ?? env.JWT_SECRET
  env.DATABASE_URL = env.DATABASE_URL ?? env.POSTGRES_URL ?? env.POSTGRES_PRISMA_URL
}

/** Env vars pushed to Trigger.dev on every `pnpm trigger:deploy`. */
export function collectEnvVarsForTriggerSync(): Array<{ name: string; value: string }> {
  const env = loadEnvFiles()
  applyAliases(env)

  return TRIGGER_SYNC_ENV_KEYS.flatMap((key) => {
    const value = env[key]
    return value ? [{ name: key, value }] : []
  })
}
