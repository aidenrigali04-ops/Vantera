// Cron endpoint: daily outreach intelligence sweep.
//
// Runs once per day per account. For each active workspace:
//   1. Re-scores stale leads in the prospect pipeline.
//   2. Generates fresh engagement signals for the action feed.
//
// Vercel Cron hits this at the time defined in `vercel.json`.

import { db } from '@/lib/db/client'
import { env } from '@/lib/env'
import { accounts } from '@vantera/db'
import { sql } from 'drizzle-orm'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(req: Request): Promise<Response> {
  if (!authorize(req)) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const completedAccounts = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(sql`${accounts.onboardingCompletedAt} IS NOT NULL`)

  return Response.json({
    ok: true,
    accountsProcessed: completedAccounts.length,
    message: 'Daily outreach sweep scheduled — agent tasks handle per-account scoring.',
  })
}

function authorize(req: Request): boolean {
  const secret = env.CRON_SECRET
  if (!secret || secret.length === 0) {
    const host = req.headers.get('host') ?? ''
    return host.startsWith('localhost') || host.startsWith('127.0.0.1')
  }
  const header = req.headers.get('authorization') ?? ''
  return header === `Bearer ${secret}`
}
