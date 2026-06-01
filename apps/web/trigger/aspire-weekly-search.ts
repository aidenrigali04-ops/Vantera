import { getIcpConfigForVertical, scoreICP } from '@/lib/aspire/icp-score'
import { filterExistingLeads, searchApollo } from '@/lib/aspire/search'
import type { ApolloSearchFilters } from '@/lib/aspire/types'
import { getSystemAutomationId } from '@/lib/automation/system-automation'
import { db } from '@/lib/db/client'
import { createIntelligenceSignal } from '@/lib/webhooks/resend/signals'
import { accounts, aspireResults, aspireSavedSearches, automationRuns } from '@vantera/db'
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

  for (const { search, vertical } of searches) {
    const filters = search.filters as ApolloSearchFilters
    const icpConfig = getIcpConfigForVertical(vertical)

    try {
      const { people } = await searchApollo(filters, 1, 25)
      const existingIds = new Set(await filterExistingLeads(search.accountId, people.map((p) => p.id)))
      const fresh = people.filter((p) => !existingIds.has(p.id))

      if (fresh.length > 0) {
        await db.insert(aspireResults).values(
          fresh.map((person) => {
            const scored = scoreICP(person, icpConfig)
            return {
              accountId: search.accountId,
              searchId: search.id,
              apolloId: person.id,
              rawData: person,
              icpScore: scored.score,
              icpSignals: scored.signals,
              status: 'found',
            }
          }),
        )
        newMatches += fresh.length

        await createIntelligenceSignal({
          accountId: search.accountId,
          signalType: 'aspire_icp_match',
          severity: 'yellow',
          headline: `${fresh.length} new ICP leads found in ${search.name}`,
          actionLabel: 'Review matches',
          actionPayload: { searchId: search.id },
          expiresInDays: 7,
        })
      }

      await db
        .update(aspireSavedSearches)
        .set({
          lastRunAt: new Date(),
          totalFound: search.totalFound + fresh.length,
          updatedAt: new Date(),
        })
        .where(eq(aspireSavedSearches.id, search.id))

      const automationId = await getSystemAutomationId(search.accountId, 'aspire')
      await db.insert(automationRuns).values({
        accountId: search.accountId,
        automationId,
        triggerEvent: 'aspire_weekly_search',
        triggerPayload: { searchId: search.id },
        actionType: 'search_apollo',
        status: 'success',
        resultPayload: { newMatches: fresh.length },
      })

      searchesRun++
    } catch (error) {
      console.error('[aspireWeeklySearch] search failed:', search.id, error)
    }

    await sleep(300)
  }

  return { searchesRun, newMatches }
}

export const aspireWeeklySearch = schedules.task({
  id: 'aspire-weekly-search',
  cron: '0 8 * * MON',
  maxDuration: 1800,
  run: async () => runAspireWeeklySearch(),
})
