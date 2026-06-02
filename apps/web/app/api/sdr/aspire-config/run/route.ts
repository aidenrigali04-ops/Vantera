import { getAdminSession } from '@/lib/auth/session'
import { computeEnrollmentHeadroom } from '@/lib/prospect-scout/run-account'
import { queueProspectScoutDiscovery } from '@/lib/prospect-scout/queue-discovery'
import { runBoundSearch, runUnboundSearch } from '@/lib/prospect-scout/run-search'
import { findBindingsForConfig } from '@/lib/sdr/aspire-config'
import { requireSDREnabled } from '@/lib/sdr/guard'
import { SdrNotEnabledError } from '@/lib/sdr/guard'
import { findSavedSearches } from '@/lib/aspire/queries'
import { db } from '@/lib/db/client'
import { accounts, sdrAgentConfigs } from '@vantera/db'
import { and, eq, isNull } from 'drizzle-orm'
import { NextResponse } from 'next/server'

/** Apify sync runs can exceed serverless limits — queue full scout runs via Trigger.dev. */
export const maxDuration = 300

export async function POST(request: Request) {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await requireSDREnabled()
    const body = (await request.json().catch(() => ({}))) as { searchId?: string }

    const [config] = await db
      .select()
      .from(sdrAgentConfigs)
      .where(
        and(eq(sdrAgentConfigs.accountId, session.accountId), isNull(sdrAgentConfigs.deletedAt)),
      )
      .limit(1)

    if (!config) {
      return NextResponse.json({ success: false, error: 'SDR agent not configured' }, { status: 400 })
    }

    if (body.searchId) {
      const bindings = await findBindingsForConfig(config.id, body.searchId)
      const binding = bindings[0]

      if (binding) {
        const headroom = await computeEnrollmentHeadroom(config)
        const [account] = await db
          .select({ name: accounts.name, vertical: accounts.vertical })
          .from(accounts)
          .where(eq(accounts.id, session.accountId))
          .limit(1)

        const result = await runBoundSearch({
          binding,
          config,
          headroom: headroom || binding.maxLeadsPerRun,
          accountName: account?.name,
          vertical: account?.vertical,
        })
        return NextResponse.json({ success: true, data: result })
      }

      const searches = await findSavedSearches(session.accountId)
      const search = searches.find((s) => s.id === body.searchId)
      if (!search) {
        return NextResponse.json({ success: false, error: 'Search not found' }, { status: 404 })
      }

      const [account] = await db
        .select({ vertical: accounts.vertical })
        .from(accounts)
        .where(eq(accounts.id, session.accountId))
        .limit(1)

      const headroom = await computeEnrollmentHeadroom(config)
      const result = await runUnboundSearch({
        search,
        accountId: session.accountId,
        vertical: account?.vertical ?? 'agency',
        config,
        headroom: headroom > 0 ? headroom : undefined,
      })
      return NextResponse.json({ success: true, data: result })
    }

    const result = await queueProspectScoutDiscovery(session.accountId)
    if ('queued' in result) {
      return NextResponse.json({ success: true, data: { queued: true } })
    }
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    const message =
      error instanceof SdrNotEnabledError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Run failed'
    return NextResponse.json({ success: false, error: message }, { status: 403 })
  }
}
