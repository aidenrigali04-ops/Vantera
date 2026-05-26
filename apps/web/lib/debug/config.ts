/** Tables that must have RLS enabled with at least one policy. */
export const CORE_TENANT_TABLES = [
  'accounts',
  'users',
  'contacts',
  'stage_definitions',
  'records',
  'activities',
  'automations',
  'automation_runs',
  'messages',
  'invoices',
  'documents',
  'intelligence_signals',
  'feature_flags',
  'integration_credentials',
] as const

/** Required Trigger.dev job identifiers (checked when API key is configured). */
export const REQUIRED_TRIGGER_JOBS = [
  'automation-engine.missed-call-capture',
  'automation-engine.stage-changed',
  'automation-engine.invoice-overdue-scan',
  'automation-engine.portal-inactivity-scan',
  'automation-engine.date-relative-scan',
  'ai-service.signal-evaluator',
  'notification-service.send-sms',
  'notification-service.send-email',
] as const

export interface DebugTestConfig {
  testAccountIdTeam: string | undefined
  testAccountIdEnterprise: string | undefined
  testContactIdA: string | undefined
  testContactIdB: string | undefined
  testContactIdOtherAccount: string | undefined
  testPortalDomain: string | undefined
  internalApiBaseUrl: string
  githubToken: string | undefined
  githubRepo: string | undefined
  maxFixAttempts: number
}

/** Normalize env URLs to the Next.js app origin (not /api/v1 API base). */
export function normalizeAppBaseUrl(raw?: string): string | undefined {
  if (!raw) return undefined
  let url = raw.trim().replace(/\/$/, '')
  url = url.replace(/\/api\/v1\/?$/i, '')
  return url || undefined
}

export function getDebugTestConfig(): DebugTestConfig {
  const appUrl = normalizeAppBaseUrl(process.env.NEXT_PUBLIC_APP_URL) ?? 'http://lvh.me:3000'

  return {
    testAccountIdTeam: process.env.DEBUG_TEST_ACCOUNT_ID_TEAM,
    testAccountIdEnterprise: process.env.DEBUG_TEST_ACCOUNT_ID_ENTERPRISE,
    testContactIdA: process.env.DEBUG_TEST_CONTACT_ID_A,
    testContactIdB: process.env.DEBUG_TEST_CONTACT_ID_B,
    testContactIdOtherAccount: process.env.DEBUG_TEST_CONTACT_ID_OTHER_ACCOUNT,
    testPortalDomain: process.env.DEBUG_TEST_PORTAL_DOMAIN,
    internalApiBaseUrl:
      normalizeAppBaseUrl(process.env.INTERNAL_API_BASE_URL) ?? appUrl,
    githubToken: process.env.GITHUB_TOKEN,
    githubRepo: process.env.GITHUB_REPO,
    maxFixAttempts: Number(process.env.DEBUG_MAX_FIX_ATTEMPTS ?? '50'),
  }
}
