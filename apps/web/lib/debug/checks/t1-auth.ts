import { env } from '@/lib/env'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type { TestResult } from '../types'
import { getDebugTestConfig } from '../config'

export async function runAuthChecks(): Promise<TestResult[]> {
  const results: TestResult[] = []

  // T1.1 — Supabase auth reachable
  try {
    const admin = getSupabaseAdmin()
    const { error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 })
    results.push({
      id: 'T1.1',
      module: 'T1',
      name: 'Supabase auth admin reachable',
      status: error ? 'fail' : 'pass',
      category: 'auth',
      severity: 'high',
      error: error?.message,
      fixable: Boolean(error),
      fixId: error ? 'configure_supabase_ws' : undefined,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown'
    const needsWs = /WebSocket/i.test(message)
    results.push({
      id: 'T1.1',
      module: 'T1',
      name: 'Supabase auth admin reachable',
      status: 'fail',
      category: 'auth',
      severity: 'high',
      error: message,
      fixable: needsWs,
      fixId: needsWs ? 'configure_supabase_ws' : undefined,
    })
  }

  const cfg = getDebugTestConfig()

  // T1.4 — Portal auth scope (requires test contact IDs)
  if (!cfg.testContactIdA || !cfg.testContactIdB) {
    results.push({
      id: 'T1.4',
      module: 'T1',
      name: 'Portal auth scope isolation',
      status: 'skip',
      category: 'auth',
      severity: 'critical',
      error: 'Set DEBUG_TEST_CONTACT_ID_A and DEBUG_TEST_CONTACT_ID_B to enable',
      fixable: false,
    })
  } else {
    results.push({
      id: 'T1.4',
      module: 'T1',
      name: 'Portal auth scope isolation',
      status: 'skip',
      category: 'auth',
      severity: 'critical',
      error: 'Portal JWT isolation test requires /api/v1 routes (not yet implemented)',
      fixable: false,
    })
  }

  // T1.5 — JWT secret configured
  results.push({
    id: 'T1.5',
    module: 'T1',
    name: 'JWT secret configured',
    status: env.SUPABASE_JWT_SECRET.length > 0 ? 'pass' : 'fail',
    category: 'auth',
    severity: 'critical',
    error: env.SUPABASE_JWT_SECRET.length > 0 ? undefined : 'SUPABASE_JWT_SECRET missing',
    fixable: false,
  })

  return results
}
