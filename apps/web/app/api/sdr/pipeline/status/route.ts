import { getAdminSession } from '@/lib/auth/session'
import { db } from '@/lib/db/client'
import { evaluateFlag } from '@/lib/feature-flags/evaluate'
import type { Plan } from '@/lib/feature-flags/flags'
import { findSdrConfigByAccount } from '@/lib/sdr/queries'
import { getSdrPipelineDiagnostics } from '@/lib/trigger/sdr-pipeline'
import { accounts, sdrActivityLog } from '@vantera/db'
import { and, desc, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

/** Pipeline health for SDR / Prospect Scout — Trigger, Apify, flag, last discovery. */
export async function GET() {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const [account] = await db
    .select({ plan: accounts.plan })
    .from(accounts)
    .where(eq(accounts.id, session.accountId))
    .limit(1)

  const plan = (account?.plan ?? 'team') as Plan
  const [config, sdrEnabled, lastDiscovery] = await Promise.all([
    findSdrConfigByAccount(session.accountId),
    evaluateFlag({
      accountId: session.accountId,
      plan,
      flagName: 'sdr_agent_enabled',
    }),
    db
      .select({
        eventType: sdrActivityLog.eventType,
        createdAt: sdrActivityLog.createdAt,
        metadata: sdrActivityLog.metadata,
      })
      .from(sdrActivityLog)
      .where(
        and(
          eq(sdrActivityLog.accountId, session.accountId),
          eq(sdrActivityLog.eventType, 'discovery_completed'),
        ),
      )
      .orderBy(desc(sdrActivityLog.createdAt))
      .limit(1),
  ])

  const diagnostics = getSdrPipelineDiagnostics()

  return NextResponse.json({
    success: true,
    data: {
      ...diagnostics,
      sdrModuleEnabled: sdrEnabled,
      agentConfigured: Boolean(config),
      agentActive: Boolean(config?.isActive && !config?.isPaused),
      prospectMode: config?.prospectMode ?? null,
      searchFrequency: config?.searchFrequency ?? null,
      lastDiscovery: lastDiscovery[0] ?? null,
      ready:
        diagnostics.triggerConfigured &&
        diagnostics.apifyConfigured &&
        sdrEnabled &&
        Boolean(config?.isActive && !config?.isPaused),
      hints: buildHints(diagnostics, sdrEnabled, config),
    },
  })
}

function buildHints(
  diagnostics: ReturnType<typeof getSdrPipelineDiagnostics>,
  sdrEnabled: boolean,
  config: Awaited<ReturnType<typeof findSdrConfigByAccount>>,
): string[] {
  const hints: string[] = []

  if (!diagnostics.triggerConfigured) {
    hints.push('Add TRIGGER_SECRET_KEY to Vercel and run pnpm trigger:deploy from the repo root.')
  }
  if (!diagnostics.apifyConfigured) {
    hints.push('Add APIFY_API_TOKEN to Vercel and Trigger.dev (synced on deploy).')
  }
  if (!sdrEnabled) {
    hints.push('Enable SDR Agents for this workspace (owner activation on setup).')
  }
  if (!config) {
    hints.push('Complete the Prospect Scout setup wizard.')
  } else if (!config.isActive) {
    hints.push('Activate the agent from the command center.')
  } else if (config.isPaused) {
    hints.push('Resume the agent to run discovery.')
  } else if (config.prospectMode === 'aspire_bound') {
    hints.push('Saved-search mode requires at least one active Aspire binding.')
  }

  return hints
}

export async function HEAD() {
  return GET()
}
