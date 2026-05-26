import { exec } from 'child_process'
import path from 'path'
import { promisify } from 'util'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { intelligenceSignals } from '@vantera/db'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type { AppliedFix, TestResult } from '../types'
import { CORE_TENANT_TABLES } from '../config'
import { getAdminSql, probeAppHealthDetailed } from '../utils'
import { resolveDebugAdminSession } from '../api-auth'

const execAsync = promisify(exec)

export interface FixResult {
  success: boolean
  description: string
  error?: string
}

function getMonorepoRoot(): string {
  return path.resolve(__dirname, '../../../../..')
}

/** Apply an autonomous fix for a failed test. Returns whether the fix succeeded. */
export async function executeFix(failure: TestResult): Promise<FixResult> {
  if (!failure.fixable || !failure.fixId) {
    return {
      success: false,
      description: 'No automated fix available for this failure',
      error: failure.error,
    }
  }

  switch (failure.fixId) {
    case 'enable_rls_policies':
      return enableRlsPolicies(failure)
    case 'dismiss_expired_signals':
      return dismissExpiredSignals()
    case 'clamp_contact_scores':
      return clampContactScores()
    case 'seed_terminal_stages':
      return seedTerminalStages(failure)
    case 'fix_eslint_errors':
      return fixEslintErrors()
    case 'fix_typescript_errors':
      return fixTypeScriptErrors(failure)
    case 'configure_supabase_ws':
      return verifySupabaseAuthAdmin()
    case 'probe_app_urls':
      return probeAppUrls()
    case 'ensure_debug_auth':
      return ensureDebugAuth()
    case 'investigate_trigger_failures':
      return investigateTriggerFailures(failure)
    default:
      return {
        success: false,
        description: `Unknown fixId: ${failure.fixId}`,
        error: failure.error,
      }
  }
}

async function enableRlsPolicies(failure: TestResult): Promise<FixResult> {
  const admin = getAdminSql()
  const tablesWithoutRls = (failure.details?.tablesWithoutRls as string[] | undefined) ?? []
  const tablesWithoutPolicy = (failure.details?.tablesWithoutPolicy as string[] | undefined) ?? []
  const targets = [...new Set([...tablesWithoutRls, ...tablesWithoutPolicy])]

  if (targets.length === 0) {
    const tableRls = await admin<{ tablename: string; rowsecurity: boolean }[]>`
      SELECT tablename, rowsecurity FROM pg_tables
      WHERE schemaname = 'public' AND tablename = ANY(${CORE_TENANT_TABLES as unknown as string[]})
    `
    targets.push(...tableRls.filter((t) => !t.rowsecurity).map((t) => t.tablename))

    const policies = await admin<{ tablename: string }[]>`
      SELECT tablename FROM pg_policies WHERE schemaname = 'public'
    `
    const withPolicy = new Set(policies.map((p) => p.tablename))
    for (const table of CORE_TENANT_TABLES) {
      if (!withPolicy.has(table)) targets.push(table)
    }
  }

  const uniqueTargets = [...new Set(targets)]
  if (uniqueTargets.length === 0) {
    return { success: true, description: 'RLS already enabled on all core tables' }
  }

  try {
    for (const table of uniqueTargets) {
      await admin.unsafe(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`)

      const policyName = `${table}_account_isolation`
      const exists = await admin<{ count: string }[]>`
        SELECT COUNT(*)::text AS count FROM pg_policies
        WHERE schemaname = 'public' AND tablename = ${table} AND policyname = ${policyName}
      `

      if (exists[0]?.count === '0') {
        const usingClause =
          table === 'accounts'
            ? `id = (auth.jwt()->>'account_id')::uuid`
            : `account_id = (auth.jwt()->>'account_id')::uuid`

        await admin.unsafe(`
          CREATE POLICY "${policyName}" ON "${table}"
            FOR ALL USING (${usingClause})
        `)
      }
    }

    return {
      success: true,
      description: `Enabled RLS + account isolation policies on: ${uniqueTargets.join(', ')}`,
    }
  } catch (error) {
    return {
      success: false,
      description: 'Failed to apply RLS policies',
      error: error instanceof Error ? error.message : 'unknown',
    }
  }
}

async function dismissExpiredSignals(): Promise<FixResult> {
  try {
    const result = await db
      .update(intelligenceSignals)
      .set({ isDismissed: true })
      .where(
        sql`${intelligenceSignals.expiresAt} < now() AND ${intelligenceSignals.isDismissed} = false`,
      )
      .returning({ id: intelligenceSignals.id })

    return {
      success: true,
      description: `Dismissed ${result.length} expired intelligence signal(s)`,
    }
  } catch (error) {
    return {
      success: false,
      description: 'Failed to dismiss expired signals',
      error: error instanceof Error ? error.message : 'unknown',
    }
  }
}

async function clampContactScores(): Promise<FixResult> {
  try {
    const admin = getAdminSql()
    const result = await admin`
      UPDATE contacts
      SET
        churn_risk_score = LEAST(100, GREATEST(0, churn_risk_score)),
        upsell_score = LEAST(100, GREATEST(0, upsell_score))
      WHERE churn_risk_score NOT BETWEEN 0 AND 100
         OR upsell_score NOT BETWEEN 0 AND 100
      RETURNING id
    `

    return {
      success: true,
      description: `Clamped scores on ${result.length} contact(s)`,
    }
  } catch (error) {
    return {
      success: false,
      description: 'Failed to clamp contact scores',
      error: error instanceof Error ? error.message : 'unknown',
    }
  }
}

async function seedTerminalStages(failure: TestResult): Promise<FixResult> {
  const admin = getAdminSql()
  let accountIds = (failure.details?.accountIds as string[] | undefined) ?? []

  if (accountIds.length === 0) {
    const rows = await admin<{ id: string }[]>`
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
      LIMIT 50
    `
    accountIds = rows.map((r) => r.id)
  }

  if (accountIds.length === 0) {
    return { success: true, description: 'All accounts already have terminal win/loss stages' }
  }

  try {
    let inserted = 0
    for (const accountId of accountIds) {
      const hasWin = await admin<{ exists: boolean }[]>`
        SELECT EXISTS (
          SELECT 1 FROM stage_definitions
          WHERE account_id = ${accountId} AND is_terminal_win = true
        ) AS exists
      `
      if (!hasWin[0]?.exists) {
        const [maxPos] = await admin<{ pos: number }[]>`
          SELECT COALESCE(MAX(position), 0)::int + 1 AS pos
          FROM stage_definitions WHERE account_id = ${accountId}
        `
        await admin`
          INSERT INTO stage_definitions (
            account_id, record_type, label, position, color,
            triggers_automation, is_terminal_win, is_terminal_loss
          ) VALUES (
            ${accountId}, 'deal', 'Won', ${maxPos?.pos ?? 99}, '#10B981',
            false, true, false
          )
        `
        inserted++
      }

      const hasLoss = await admin<{ exists: boolean }[]>`
        SELECT EXISTS (
          SELECT 1 FROM stage_definitions
          WHERE account_id = ${accountId} AND is_terminal_loss = true
        ) AS exists
      `
      if (!hasLoss[0]?.exists) {
        const [maxPos] = await admin<{ pos: number }[]>`
          SELECT COALESCE(MAX(position), 0)::int + 1 AS pos
          FROM stage_definitions WHERE account_id = ${accountId}
        `
        await admin`
          INSERT INTO stage_definitions (
            account_id, record_type, label, position, color,
            triggers_automation, is_terminal_win, is_terminal_loss
          ) VALUES (
            ${accountId}, 'deal', 'Lost', ${maxPos?.pos ?? 100}, '#EF4444',
            false, false, true
          )
        `
        inserted++
      }
    }

    return {
      success: true,
      description: `Seeded ${inserted} terminal stage(s) across ${accountIds.length} account(s)`,
    }
  } catch (error) {
    return {
      success: false,
      description: 'Failed to seed terminal stages',
      error: error instanceof Error ? error.message : 'unknown',
    }
  }
}

async function fixEslintErrors(): Promise<FixResult> {
  const webDir = path.join(getMonorepoRoot(), 'apps/web')
  try {
    await execAsync('pnpm exec eslint . --fix --max-warnings 0', {
      cwd: webDir,
      maxBuffer: 10 * 1024 * 1024,
      env: process.env,
    })
  } catch {
    // --fix may exit non-zero when not all rules are auto-fixable; verify next.
  }

  try {
    await execAsync('pnpm exec eslint . --max-warnings 0 --format json', {
      cwd: webDir,
      maxBuffer: 10 * 1024 * 1024,
      env: process.env,
    })
    return { success: true, description: 'ESLint --fix applied; lint is clean' }
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; message?: string }
    const output = [err.stdout, err.stderr, err.message].filter(Boolean).join('\n')
    return {
      success: false,
      description: 'ESLint --fix applied but errors remain',
      error: output.slice(0, 500),
    }
  }
}

async function fixTypeScriptErrors(failure: TestResult): Promise<FixResult> {
  const webDir = path.join(getMonorepoRoot(), 'apps/web')

  // ESLint --fix resolves many TS-adjacent issues (unused vars, import order, etc.)
  const eslintFix = await fixEslintErrors()

  try {
    await execAsync('pnpm exec tsc --noEmit --pretty false', {
      cwd: webDir,
      maxBuffer: 10 * 1024 * 1024,
      env: process.env,
    })
    return {
      success: true,
      description: eslintFix.success
        ? 'TypeScript compile clean after ESLint --fix'
        : 'TypeScript compile clean (ESLint may still have manual fixes)',
    }
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; message?: string }
    const output = [err.stdout, err.stderr, err.message].filter(Boolean).join('\n')
    const parsedCount = (failure.details?.errorCount as number | undefined) ?? 0
    return {
      success: false,
      description:
        parsedCount > 0
          ? `TypeScript still has ${parsedCount} error(s) after auto-fix — manual patch required`
          : 'TypeScript compile failed after auto-fix — see error output',
      error: output.slice(0, 500),
    }
  }
}

async function verifySupabaseAuthAdmin(): Promise<FixResult> {
  try {
    const admin = getSupabaseAdmin()
    const { error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 })
    if (error) {
      return {
        success: false,
        description: 'Supabase auth admin still unreachable',
        error: error.message,
      }
    }
    return {
      success: true,
      description: 'Supabase auth admin reachable (ws transport via lib/supabase/admin.ts)',
    }
  } catch (error) {
    return {
      success: false,
      description: 'Supabase auth admin verification failed',
      error: error instanceof Error ? error.message : 'unknown',
    }
  }
}

async function probeAppUrls(): Promise<FixResult> {
  const probe = await probeAppHealthDetailed({
    timeoutMs: 10_000,
    retries: 3,
    retryDelayMs: 1_000,
  })

  if (probe.ok && probe.baseUrl) {
    return {
      success: true,
      description: `App reachable at ${probe.baseUrl} (/api/health ok:true)`,
    }
  }

  const attemptSummary = probe.attempts
    .slice(0, 6)
    .map((a) => `${a.baseUrl}: ${a.error}`)
    .join('; ')

  return {
    success: false,
    description:
      'Start the app (pnpm dev) or set INTERNAL_API_BASE_URL to the Next.js app origin (not /api/v1)',
    error: attemptSummary || 'No reachable /api/health endpoint among configured base URLs',
  }
}

async function ensureDebugAuth(): Promise<FixResult> {
  const session = await resolveDebugAdminSession()
  if (session) {
    return {
      success: true,
      description: `Debug admin session resolved for ${session.email} (${session.role})`,
    }
  }

  return {
    success: false,
    description:
      'No active admin user for API smoke tests — complete signup or set DEBUG_TEST_ACCOUNT_ID_TEAM',
    error: 'resolveDebugAdminSession returned null',
  }
}

function investigateTriggerFailures(failure: TestResult): FixResult {
  const tasks = (failure.details?.tasks as string[] | undefined) ?? []
  return {
    success: false,
    description:
      tasks.length > 0
        ? `Recent Trigger.dev failures for: ${tasks.join(', ')} — inspect runs in Trigger dashboard`
        : 'Recent Trigger.dev failures — inspect runs in Trigger dashboard and redeploy fixed tasks',
    error: failure.error,
  }
}

export function toAppliedFix(failure: TestResult, result: FixResult): AppliedFix {
  return {
    testId: failure.id,
    fixId: failure.fixId ?? 'unknown',
    description: result.description,
    success: result.success,
    error: result.error,
  }
}
