import { sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { contacts, intelligenceSignals } from '@vantera/db'
import type { TestResult } from '../types'
import { CORE_TENANT_TABLES } from '../config'
import { getAdminSql } from '../utils'

export async function runDatabaseChecks(): Promise<TestResult[]> {
  const results: TestResult[] = []
  const admin = getAdminSql()

  // T2.1 — RLS enabled on core tables
  const tableRls = await admin<{ tablename: string; rowsecurity: boolean }[]>`
    SELECT tablename, rowsecurity
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename = ANY(${CORE_TENANT_TABLES as unknown as string[]})
  `

  const rlsOff = tableRls.filter((t) => !t.rowsecurity).map((t) => t.tablename)
  results.push({
    id: 'T2.1',
    module: 'T2',
    name: 'RLS enabled on core tenant tables',
    status: rlsOff.length === 0 ? 'pass' : 'fail',
    category: 'database',
    severity: 'critical',
    error: rlsOff.length ? `RLS disabled on: ${rlsOff.join(', ')}` : undefined,
    details: { tablesWithoutRls: rlsOff },
    fixable: rlsOff.length > 0,
    fixId: 'enable_rls_policies',
  })

  // T2.2 — Policy existence
  const policies = await admin<{ tablename: string; policyname: string }[]>`
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  `
  const tablesWithoutPolicy = CORE_TENANT_TABLES.filter(
    (table) => !policies.some((p) => p.tablename === table),
  )
  results.push({
    id: 'T2.2',
    module: 'T2',
    name: 'RLS policies exist on core tables',
    status: tablesWithoutPolicy.length === 0 ? 'pass' : 'fail',
    category: 'database',
    severity: 'critical',
    error: tablesWithoutPolicy.length
      ? `Missing policies on: ${tablesWithoutPolicy.join(', ')}`
      : undefined,
    details: { tablesWithoutPolicy },
    fixable: tablesWithoutPolicy.length > 0,
    fixId: 'enable_rls_policies',
  })

  // T2.4 — Expired intelligence signals
  const expired = await db
    .select({ id: intelligenceSignals.id })
    .from(intelligenceSignals)
    .where(
      sql`${intelligenceSignals.expiresAt} < now() AND ${intelligenceSignals.isDismissed} = false`,
    )
    .limit(100)

  results.push({
    id: 'T2.4',
    module: 'T2',
    name: 'No stale expired intelligence signals',
    status: expired.length === 0 ? 'pass' : 'fail',
    category: 'database',
    severity: 'medium',
    error: expired.length ? `${expired.length} expired undismissed signal(s)` : undefined,
    details: { count: expired.length },
    fixable: expired.length > 0,
    fixId: 'dismiss_expired_signals',
  })

  // T2.5 — Score range
  const badScores = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(
      sql`${contacts.churnRiskScore} NOT BETWEEN 0 AND 100 OR ${contacts.upsellScore} NOT BETWEEN 0 AND 100`,
    )
    .limit(50)

  results.push({
    id: 'T2.5',
    module: 'T2',
    name: 'Contact scores within 0–100',
    status: badScores.length === 0 ? 'pass' : 'fail',
    category: 'database',
    severity: 'medium',
    error: badScores.length ? `${badScores.length} contact(s) with out-of-range scores` : undefined,
    details: { count: badScores.length },
    fixable: badScores.length > 0,
    fixId: 'clamp_contact_scores',
  })

  // T2.6 — Terminal stage definitions
  const accountsMissingTerminal = await admin<{ id: string }[]>`
    SELECT a.id
    FROM accounts a
    WHERE NOT EXISTS (
      SELECT 1 FROM stage_definitions sd
      WHERE sd.account_id = a.id AND sd.is_terminal_win = true
    )
    OR NOT EXISTS (
      SELECT 1 FROM stage_definitions sd
      WHERE sd.account_id = a.id AND sd.is_terminal_loss = true
    )
    LIMIT 20
  `

  results.push({
    id: 'T2.6',
    module: 'T2',
    name: 'Accounts have terminal win/loss stages',
    status: accountsMissingTerminal.length === 0 ? 'pass' : 'fail',
    category: 'database',
    severity: 'high',
    error: accountsMissingTerminal.length
      ? `${accountsMissingTerminal.length} account(s) missing terminal stages`
      : undefined,
    details: { accountIds: accountsMissingTerminal.map((a) => a.id) },
    fixable: accountsMissingTerminal.length > 0,
    fixId: 'seed_terminal_stages',
  })

  return results
}

/** Re-run a single database test after a fix was applied. */
export async function rerunDatabaseTest(testId: string): Promise<TestResult | null> {
  const all = await runDatabaseChecks()
  return all.find((t) => t.id === testId) ?? null
}
