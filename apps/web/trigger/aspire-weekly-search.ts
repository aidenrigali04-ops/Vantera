import { runBoundSearch, runUnboundSearch } from '@/lib/prospect-scout/run-search'
import { findBindingsForConfig } from '@/lib/sdr/aspire-config'
import { db } from '@/lib/db/client'
import { computeEnrollmentHeadroom } from '@/lib/prospect-scout/run-account'
import {
  accounts,
  aspireSavedSearches,
  sdrAgentConfigs,
  sdrAspireBindings,
} from '@vantera/db'
import { and, eq, isNull, lt, or, sql } from 'drizzle-orm'
import { schedules } from '@trigger.dev/sdk'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function runAspireWeeklySearch(): Promise<{ searchesRun: number; newMatches: number }> {
  const searches = await db
    .select({
      search: aspireSavedSearches,
      vertical: accounts.vertical,
      accountId: accounts.id,
    })
    .from(aspireSavedSearches)
    .innerJoin(accounts, eq(aspireSavedSearches.accountId, accounts.id))
    .where(
      and(
        eq(aspireSavedSearches.isActive, true),
        isNull(aspireSavedSearches.deletedAt),
        or(
          isNull(aspireSavedSearches.lastRunAt),
          lt(aspireSavedSearches.lastRunAt, sql`now() - interval '6 days'`),
        ),
      ),
    )

  let searchesRun = 0
  let newMatches = 0

  for (const { search, vertical, accountId } of searches) {
    const [binding] = await db
      .select({ bindingId: sdrAspireBindings.id })
      .from(sdrAspireBindings)
      .where(
        and(
          eq(sdrAspireBindings.savedSearchId, search.id),
          eq(sdrAspireBindings.isActive, true),
        ),
      )
      .limit(1)

    if (binding) {
      continue
    }

    const [config] = await db
      .select()
      .from(sdrAgentConfigs)
      .where(
        and(
          eq(sdrAgentConfigs.accountId, accountId),
          eq(sdrAgentConfigs.isActive, true),
          isNull(sdrAgentConfigs.deletedAt),
        ),
      )
      .limit(1)

    const headroom = config ? await computeEnrollmentHeadroom(config) : 0

    try {
      const result = await runUnboundSearch({
        search,
        accountId,
        vertical,
        config: config ?? null,
        headroom: headroom > 0 ? headroom : undefined,
      })
      searchesRun += 1
      newMatches += result.found
    } catch (error) {
      console.error('[aspireWeeklySearch] search failed:', search.id, error)
    }

    await sleep(300)
  }

  const boundConfigs = await db
    .select({ config: sdrAgentConfigs })
    .from(sdrAgentConfigs)
    .where(
      and(
        eq(sdrAgentConfigs.isActive, true),
        eq(sdrAgentConfigs.isPaused, false),
        isNull(sdrAgentConfigs.deletedAt),
      ),
    )

  for (const { config } of boundConfigs) {
    const bindings = await findBindingsForConfig(config.id)
    let headroom = await computeEnrollmentHeadroom(config)

    for (const binding of bindings) {
      if (headroom <= 0) break

      const lastRun = binding.search.lastRunAt
      const due =
        !lastRun || lastRun.getTime() < Date.now() - 6 * 86_400_000

      if (!due || !binding.search.isActive) continue

      const [account] = await db
        .select({ name: accounts.name, vertical: accounts.vertical })
        .from(accounts)
        .where(eq(accounts.id, config.accountId))
        .limit(1)

      try {
        const result = await runBoundSearch({
          binding,
          config,
          headroom,
          accountName: account?.name ?? undefined,
          vertical: account?.vertical ?? undefined,
        })
        searchesRun += 1
        newMatches += result.found
        headroom = Math.max(0, headroom - result.enrolled)
      } catch (error) {
        console.error('[aspireWeeklySearch] bound search failed:', binding.id, error)
      }

      await sleep(300)
    }
  }

  return { searchesRun, newMatches }
}

export const aspireWeeklySearch = schedules.task({
  id: 'aspire-weekly-search',
  cron: '0 8 * * MON',
  maxDuration: 1800,
  run: async () => runAspireWeeklySearch(),
})
