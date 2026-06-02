import { db } from '@/lib/db/client'
import { runInlineProspectFind } from '@/lib/prospect-scout/inline-find'
import { runBoundSearch } from '@/lib/prospect-scout/run-search'
import type { ProspectMode, RunAccountResult, SdrConfigRow } from '@/lib/prospect-scout/types'
import { countActiveSdrSequences, countSdrEnrolledToday } from '@/lib/sdr/queries'
import { findBindingsForConfig } from '@/lib/sdr/aspire-config'
import { accounts, sdrAgentConfigs } from '@vantera/db'
import { and, eq, isNull } from 'drizzle-orm'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function computeEnrollmentHeadroom(config: SdrConfigRow): Promise<number> {
  const activeCount = await countActiveSdrSequences(config.accountId)
  if (activeCount >= config.maxActiveLeads) return 0

  const enrolledToday = await countSdrEnrolledToday(config.accountId)
  return Math.max(
    0,
    Math.min(config.maxNewLeadsDay - enrolledToday, config.maxActiveLeads - activeCount),
  )
}

export async function runAccountProspectScout(
  accountId: string,
  options?: { searchId?: string; force?: boolean },
): Promise<RunAccountResult> {
  const [config] = await db
    .select()
    .from(sdrAgentConfigs)
    .where(and(eq(sdrAgentConfigs.accountId, accountId), isNull(sdrAgentConfigs.deletedAt)))
    .limit(1)

  if (!config) {
    return { accountId, searchesRun: 0, found: 0, enrolled: 0, runs: [] }
  }

  const mode = (config.prospectMode ?? 'aspire_bound') as ProspectMode
  if (mode === 'inline_icp') {
    const inline = await runInlineProspectFind(config)
    return {
      accountId,
      searchesRun: 1,
      found: inline.found,
      enrolled: inline.enrolled,
      runs: [],
    }
  }

  const [account] = await db
    .select({ name: accounts.name, vertical: accounts.vertical })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1)

  let headroom = await computeEnrollmentHeadroom(config)
  const bindings = await findBindingsForConfig(config.id, options?.searchId)

  const runs: RunAccountResult['runs'] = []
  let found = 0
  let enrolled = 0

  const activeBindings = bindings.filter((b) => b.isActive && b.search.isActive)

  for (const binding of activeBindings) {
    if (headroom <= 0 && mode !== 'hybrid') break

    const result = await runBoundSearch({
      binding,
      config,
      headroom: headroom || binding.maxLeadsPerRun,
      accountName: account?.name ?? undefined,
      vertical: account?.vertical ?? undefined,
    })

    runs.push(result)
    found += result.found
    enrolled += result.enrolled
    headroom = Math.max(0, headroom - result.enrolled)
    await sleep(200)
  }

  if (mode === 'hybrid' && headroom > 0) {
    const inline = await runInlineProspectFind(config)
    found += inline.found
    enrolled += inline.enrolled
  }

  return {
    accountId,
    searchesRun: runs.length,
    found,
    enrolled,
    runs,
  }
}

export async function runAllActiveProspectScouts(): Promise<{
  accountsRun: number
  leadsEnrolled: number
}> {
  const configs = await db
    .select()
    .from(sdrAgentConfigs)
    .where(
      and(
        eq(sdrAgentConfigs.isActive, true),
        eq(sdrAgentConfigs.isPaused, false),
        isNull(sdrAgentConfigs.deletedAt),
      ),
    )

  let accountsRun = 0
  let leadsEnrolled = 0

  for (const config of configs) {
    try {
      const mode = (config.prospectMode ?? 'aspire_bound') as ProspectMode
      if (mode === 'inline_icp') {
        const inline = await runInlineProspectFind(config)
        if (inline.enrolled > 0) accountsRun += 1
        leadsEnrolled += inline.enrolled
      } else {
        const result = await runAccountProspectScout(config.accountId)
        if (result.searchesRun > 0 || result.enrolled > 0) accountsRun += 1
        leadsEnrolled += result.enrolled
      }
    } catch (error) {
      console.error('[prospect-scout] account failed:', config.accountId, error)
    }
    await sleep(300)
  }

  return { accountsRun, leadsEnrolled }
}
