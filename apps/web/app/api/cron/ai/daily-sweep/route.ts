// Cron endpoint: daily AI intelligence sweep.
//
// Wakes every active account's brain once per day. Vercel Cron hits this at
// the time defined in `vercel.json`. We authenticate by checking for the
// `Authorization: Bearer <CRON_SECRET>` header that Vercel injects.
//
// For each account that has completed onboarding, we run the full daily
// sweep workflow: refresh business context, re-score stale records,
// regenerate signals, expire old ones. Each account is processed
// sequentially with a soft per-account timeout so one bad account can't
// starve the rest.
//
// The endpoint is idempotent — running it twice in the same day is safe;
// memory rows upsert and signals are dedup'd by recency.

import { db } from '@/lib/db/client'
import { env } from '@/lib/env'
import { dailyIntelligenceSweep } from '@/lib/ai'
import { accounts, users } from '@vantera/db'
import { and, eq, sql } from 'drizzle-orm'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes — enough for ~50 accounts at ~5s each

const PER_ACCOUNT_TIMEOUT_MS = 30_000

export async function GET(req: Request): Promise<Response> {
  if (!authorize(req)) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const completedAccounts = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(sql`${accounts.onboardingCompletedAt} IS NOT NULL`)

  const results: Array<{ accountId: string; ok: boolean; summary?: unknown; error?: string }> = []

  for (const row of completedAccounts) {
    // Pick the account owner as the user the workflow runs as. If there's no
    // owner row we skip — the brain needs a user to attribute observations
    // (and for context that depends on owner identity in prompts).
    const [owner] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.accountId, row.id), eq(users.role, 'owner'), eq(users.isActive, true)))
      .limit(1)

    if (!owner) {
      results.push({ accountId: row.id, ok: false, error: 'no_active_owner' })
      continue
    }

    try {
      const summary = await withTimeout(
        dailyIntelligenceSweep(row.id, owner.id),
        PER_ACCOUNT_TIMEOUT_MS,
      )
      results.push({ accountId: row.id, ok: true, summary })
    } catch (error) {
      results.push({
        accountId: row.id,
        ok: false,
        error: error instanceof Error ? error.message : 'unknown',
      })
    }
  }

  return Response.json({
    ok: true,
    accountsProcessed: results.length,
    results,
  })
}

function authorize(req: Request): boolean {
  const secret = env.CRON_SECRET
  if (!secret || secret.length === 0) {
    // No secret configured → only allow from localhost (so devs can hit it
    // manually). In production this should be configured.
    const host = req.headers.get('host') ?? ''
    return host.startsWith('localhost') || host.startsWith('127.0.0.1')
  }

  const header = req.headers.get('authorization') ?? ''
  return header === `Bearer ${secret}`
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`per-account sweep timed out after ${ms}ms`)), ms)
    promise
      .then((value) => {
        clearTimeout(timer)
        resolve(value)
      })
      .catch((reason) => {
        clearTimeout(timer)
        reject(reason)
      })
  })
}
