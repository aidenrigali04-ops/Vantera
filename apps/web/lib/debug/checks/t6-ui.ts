import { env } from '@/lib/env'
import { fetchAccountById } from '@/lib/onboarding/account-store'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type { TestResult } from '../types'
import { getDebugTestConfig } from '../config'
import { fetchAppPath, fetchWithTimeout, getAdminSql, probeAppHealth } from '../utils'

/** Resolve a tenant portal URL — never the bare marketing host (which legitimately shows Vantera). */
async function resolveTenantPortalUrl(
  cfg: ReturnType<typeof getDebugTestConfig>,
): Promise<string> {
  if (cfg.testPortalDomain) {
    return cfg.testPortalDomain.startsWith('http')
      ? cfg.testPortalDomain
      : `http://${cfg.testPortalDomain}`
  }

  const admin = getAdminSql()
  let slug: string | undefined

  if (cfg.testAccountIdTeam) {
    const rows = await admin<{ slug: string }[]>`
      SELECT slug FROM accounts WHERE id = ${cfg.testAccountIdTeam}::uuid LIMIT 1
    `
    slug = rows[0]?.slug
  }

  if (!slug) {
    const rows = await admin<{ slug: string }[]>`
      SELECT slug FROM accounts
      WHERE onboarding_completed_at IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 1
    `
    slug = rows[0]?.slug
  }

  if (!slug) {
    throw new Error(
      'No tenant account found — complete onboarding or set DEBUG_TEST_PORTAL_DOMAIN',
    )
  }

  const appUrl = new URL(env.NEXT_PUBLIC_APP_URL)
  const port = appUrl.port ? `:${appUrl.port}` : ''
  return `${appUrl.protocol}//${slug}.${env.NEXT_PUBLIC_APP_DOMAIN}${port}`
}

export async function runUiChecks(): Promise<TestResult[]> {
  const results: TestResult[] = []
  const cfg = getDebugTestConfig()
  let portalUrl: string | undefined

  try {
    portalUrl = await resolveTenantPortalUrl(cfg)
  } catch (error) {
    results.push({
      id: 'T6.1',
      module: 'T6',
      name: 'Portal home loads without Vantera branding',
      status: 'skip',
      category: 'ui',
      severity: 'critical',
      error: error instanceof Error ? error.message : 'No portal URL available',
      fixable: false,
    })
    portalUrl = undefined
  }

  // T6.1 — Portal home load + no Vantera branding
  if (portalUrl) {
    try {
      let res: Response
      let resolvedBase = portalUrl

      try {
        // Public portal entry — not the marketing homepage at /
        const loginUrl = `${portalUrl.replace(/\/$/, '')}/auth/portal-login`
        res = await fetchWithTimeout(loginUrl, { redirect: 'follow' })
      } catch {
        const probe = await probeAppHealth()
        if (!probe) throw new Error('App unreachable — start dev server or set INTERNAL_API_BASE_URL')
        resolvedBase = probe.baseUrl
        const fetched = await fetchAppPath('/', { redirect: 'follow' })
        res = fetched.response
      }

      const html = await res.text()
      const visibleHtml = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/[\w-]+\.vantera\.app/gi, '')
      const hasVanteraBranding =
        /\bvantera\b/i.test(visibleHtml) && !visibleHtml.includes('vantera-test.internal')
      results.push({
        id: 'T6.1',
        module: 'T6',
        name: 'Portal home loads without Vantera branding',
        status: res.ok && !hasVanteraBranding ? 'pass' : 'fail',
        category: 'ui',
        severity: 'critical',
        error: !res.ok
          ? `HTTP ${res.status}`
          : hasVanteraBranding
            ? 'Vantera branding detected in client-facing HTML'
            : undefined,
        details: { baseUrl: resolvedBase, portalUrl },
        fixable: false,
      })
    } catch (error) {
      results.push({
        id: 'T6.1',
        module: 'T6',
        name: 'Portal home loads without Vantera branding',
        status: 'fail',
        category: 'ui',
        severity: 'critical',
        error: error instanceof Error ? error.message : 'fetch failed',
        fixable: true,
        fixId: 'probe_app_urls',
      })
    }
  }

  // T6.2 — Auth wall on dashboard
  try {
    const { response: res } = await fetchAppPath('/portal/dashboard', { redirect: 'manual' })
    const ok = res.status === 401 || res.status === 302 || res.status === 307
    results.push({
      id: 'T6.2',
      module: 'T6',
      name: 'Portal dashboard requires auth',
      status: ok ? 'pass' : 'fail',
      category: 'ui',
      severity: 'high',
      error: ok ? undefined : `Expected redirect/401, got ${res.status}`,
      fixable: false,
    })
  } catch (error) {
    results.push({
      id: 'T6.2',
      module: 'T6',
      name: 'Portal dashboard requires auth',
      status: 'skip',
      category: 'ui',
      severity: 'high',
      error: error instanceof Error ? error.message : 'unreachable',
      fixable: false,
    })
  }

  for (const [id, name] of [
    ['T6.3', 'Estimate approval flow'],
    ['T6.4', 'Invoice pay link'],
    ['T6.5', 'Portal inactivity signal'],
  ] as const) {
    results.push({
      id,
      module: 'T6',
      name,
      status: 'skip',
      category: 'ui',
      severity: 'medium',
      error: 'Requires full portal + payment integration',
      fixable: false,
    })
  }

  // T6.6 — Onboarding account resolvable via service role (Complete setup guard)
  try {
    const cfg = getDebugTestConfig()
    const admin = getSupabaseAdmin()

    let accountId = cfg.testAccountIdTeam
    if (!accountId) {
      const { data } = await admin
        .from('accounts')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      accountId = data?.id
    }

    if (!accountId) {
      results.push({
        id: 'T6.6',
        module: 'T6',
        name: 'Onboarding account service-role lookup',
        status: 'skip',
        category: 'ui',
        severity: 'high',
        error: 'No account in database to probe',
        fixable: false,
      })
    } else {
      const account = await fetchAccountById(accountId)
      const { data: stages, error: stageError } = await admin
        .from('stage_definitions')
        .select('id')
        .eq('account_id', accountId)
        .limit(1)

      const ok = Boolean(account) && !stageError
      results.push({
        id: 'T6.6',
        module: 'T6',
        name: 'Onboarding account service-role lookup',
        status: ok ? 'pass' : 'fail',
        category: 'ui',
        severity: 'high',
        error: ok
          ? undefined
          : stageError?.message ?? 'Service-role client cannot read tenant account for onboarding',
        details: {
          accountId,
          hasStages: (stages?.length ?? 0) > 0,
          onboardingComplete: Boolean(account?.onboarding_completed_at),
        },
        fixable: false,
      })
    }
  } catch (error) {
    results.push({
      id: 'T6.6',
      module: 'T6',
      name: 'Onboarding account service-role lookup',
      status: 'fail',
      category: 'ui',
      severity: 'high',
      error: error instanceof Error ? error.message : 'onboarding probe failed',
      fixable: false,
    })
  }

  return results
}

export async function rerunUiTest(testId: string): Promise<TestResult | null> {
  const all = await runUiChecks()
  return all.find((t) => t.id === testId) ?? null
}
