import { db } from '@/lib/db/client'
import { env } from '@/lib/env'
import { getPausedLinkedCampaignExclusions } from '@/lib/outreach-agent/queue-policy'
import { findAccountsWithDueCampaignSteps } from '@/lib/outreach/queries'
import { shouldCronAutoProcessCampaignSteps } from '@/lib/sdr/outreach-automation-policy'
import { processDueCampaignSteps } from '@/lib/outreach/runner'
import { users } from '@vantera/db'
import { and, eq } from 'drizzle-orm'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function GET(req: Request): Promise<Response> {
  if (!authorize(req)) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const accountIds = await findAccountsWithDueCampaignSteps()
  const results: Array<{
    accountId: string
    ok: boolean
    sent?: number
    failed?: number
    error?: string
  }> = []

  for (const accountId of accountIds) {
    if (!(await shouldCronAutoProcessCampaignSteps(accountId))) {
      continue
    }

    const [owner] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.accountId, accountId), eq(users.role, 'owner'), eq(users.isActive, true)))
      .limit(1)

    if (!owner) {
      results.push({ accountId, ok: false, error: 'no_active_owner' })
      continue
    }

    try {
      const excludeCampaignIds = await getPausedLinkedCampaignExclusions(accountId)
      const summary = await processDueCampaignSteps(accountId, owner.id, {
        excludeCampaignIds,
      })
      results.push({
        accountId,
        ok: true,
        sent: summary.sent,
        failed: summary.failed,
      })
    } catch (error) {
      results.push({
        accountId,
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
    const host = req.headers.get('host') ?? ''
    return host.startsWith('localhost') || host.startsWith('127.0.0.1')
  }

  const header = req.headers.get('authorization') ?? ''
  return header === `Bearer ${secret}`
}
