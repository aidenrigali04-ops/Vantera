import { getIcpConfigForVertical, scoreICP } from '@/lib/aspire/icp-score'
import { isInteractiveAspireSearch, normalizeApolloFilters } from '@/lib/aspire/filters'
import { filterExistingLeads, searchApify } from '@/lib/aspire/search'
import type { ApolloSearchFilters, ApolloPersonResult } from '@/lib/aspire/types'
import { getSystemAutomationId } from '@/lib/automation/system-automation'
import { db } from '@/lib/db/client'
import {
  domainFromEmail,
  enrollProspect,
  notifyIcpMatches,
  recordFoundProspects,
} from '@/lib/prospect-scout/enroll'
import {
  effectiveMinIcp,
  resolveIcpConfig,
  type BindingWithSearch,
  type RunSearchResult,
  type SdrConfigRow,
} from '@/lib/prospect-scout/types'
import {
  aspireSavedSearches,
  aspireSearchRuns,
  automationRuns,
  sdrAgentConfigs,
} from '@vantera/db'
import { and, eq, isNull } from 'drizzle-orm'

type RunBoundSearchInput = {
  binding: BindingWithSearch
  config: SdrConfigRow
  headroom: number
  accountName?: string
  vertical?: string
}

type RunUnboundSearchInput = {
  search: typeof aspireSavedSearches.$inferSelect
  accountId: string
  vertical: string
  headroom?: number
  config?: SdrConfigRow | null
}

async function startRun(input: {
  accountId: string
  savedSearchId: string
  configId?: string
  query: ApolloSearchFilters
}): Promise<string> {
  const [row] = await db
    .insert(aspireSearchRuns)
    .values({
      accountId: input.accountId,
      savedSearchId: input.savedSearchId,
      configId: input.configId ?? null,
      query: input.query,
      status: 'running',
      resultCount: 0,
      enrolledCount: 0,
    })
    .returning({ id: aspireSearchRuns.id })
  return row!.id
}

async function finishRun(
  runId: string,
  patch: {
    status: 'success' | 'failed'
    resultCount: number
    enrolledCount: number
    errorMessage?: string
  },
): Promise<void> {
  await db
    .update(aspireSearchRuns)
    .set({
      status: patch.status,
      resultCount: patch.resultCount,
      enrolledCount: patch.enrolledCount,
      errorMessage: patch.errorMessage ?? null,
      finishedAt: new Date(),
    })
    .where(eq(aspireSearchRuns.id, runId))
}

function filterCandidates(
  people: ApolloPersonResult[],
  accountId: string,
  excludeDomains: string[],
): Promise<ApolloPersonResult[]> {
  return filterExistingLeads(accountId, people.map((p) => p.id)).then((existing) => {
    const existingIds = new Set(existing)
    const exclude = new Set(excludeDomains.map((d) => d.toLowerCase()))
    return people.filter((p) => {
      if (existingIds.has(p.id)) return false
      const domain = domainFromEmail(p.email)
      return !domain || !exclude.has(domain)
    })
  })
}

export async function runBoundSearch(input: RunBoundSearchInput): Promise<RunSearchResult> {
  const { binding, config, headroom } = input
  const search = binding.search
  const rawFilters = search.filters as Partial<ApolloSearchFilters>
  const vertical = input.vertical ?? 'agency'
  const interactive = isInteractiveAspireSearch(rawFilters)
  const filters = normalizeApolloFilters(vertical, rawFilters, { interactive })
  const icpConfig = resolveIcpConfig(config, search)
  const minIcp = effectiveMinIcp(binding, config)
  const limit = Math.min(headroom, binding.maxLeadsPerRun, 25)

  const runId = await startRun({
    accountId: config.accountId,
    savedSearchId: search.id,
    configId: config.id,
    query: filters,
  })

  try {
    const { people } = await searchApify(filters, 1, 25, interactive)
    const fresh = await filterCandidates(people, config.accountId, config.excludeDomains ?? [])

    const scored = fresh
      .map((person) => ({
        person,
        icp: scoreICP(person, icpConfig),
      }))
      .sort((a, b) => b.icp.score - a.icp.score)

    let enrolled = 0
    const belowThreshold: typeof scored = []

    for (const { person, icp } of scored) {
      if (icp.score < minIcp) {
        belowThreshold.push({ person, icp })
        continue
      }
      if (enrolled >= limit) {
        belowThreshold.push({ person, icp })
        continue
      }

      const shouldEnroll =
        binding.autoEnrollSdr && config.isActive && !config.isPaused && headroom > enrolled

      if (shouldEnroll) {
        const result = await enrollProspect({
          accountId: config.accountId,
          config,
          person,
          searchId: search.id,
          icpScore: icp.score,
          icpSignals: icp.signals,
          startSdrSequence: true,
          accountName: input.accountName,
        })
        if (result.enrolled) enrolled += 1
      } else {
        await recordFoundProspects({
          accountId: config.accountId,
          searchId: search.id,
          people: [{ person, icpScore: icp.score, icpSignals: icp.signals }],
        })
      }
    }

    if (belowThreshold.length > 0 && enrolled === 0) {
      await recordFoundProspects({
        accountId: config.accountId,
        searchId: search.id,
        people: belowThreshold.slice(0, 10).map(({ person, icp }) => ({
          person,
          icpScore: icp.score,
          icpSignals: icp.signals,
        })),
      })
    }

    const found = scored.length
    if (found > enrolled) {
      await notifyIcpMatches(config.accountId, search.name, found - enrolled, search.id)
    }

    await db
      .update(aspireSavedSearches)
      .set({
        lastRunAt: new Date(),
        totalFound: search.totalFound + found,
        updatedAt: new Date(),
        ...(config.syncIcpToSavedSearches ? { icpConfig } : {}),
      })
      .where(eq(aspireSavedSearches.id, search.id))

    await db
      .update(sdrAgentConfigs)
      .set({ lastRunAt: new Date(), updatedAt: new Date() })
      .where(eq(sdrAgentConfigs.id, config.id))

    const automationId = await getSystemAutomationId(config.accountId, 'aspire')
    await db.insert(automationRuns).values({
      accountId: config.accountId,
      automationId,
      triggerEvent: 'prospect_scout_bound',
      triggerPayload: { searchId: search.id, bindingId: binding.id },
      actionType: 'search_apify',
      status: 'success',
      resultPayload: { found, enrolled, runId },
    })

    await finishRun(runId, { status: 'success', resultCount: found, enrolledCount: enrolled })

    return {
      runId,
      searchId: search.id,
      found,
      enrolled,
      status: 'success',
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Search failed'
    await finishRun(runId, { status: 'failed', resultCount: 0, enrolledCount: 0, errorMessage: message })
    return {
      runId,
      searchId: search.id,
      found: 0,
      enrolled: 0,
      status: 'failed',
      errorMessage: message,
    }
  }
}

/** Weekly/manual run for a saved search without an SDR binding. */
export async function runUnboundSearch(input: RunUnboundSearchInput): Promise<RunSearchResult> {
  const { search, accountId, vertical } = input
  const rawFilters = search.filters as Partial<ApolloSearchFilters>
  const interactive = isInteractiveAspireSearch(rawFilters)
  const filters = normalizeApolloFilters(vertical, rawFilters, { interactive })
  const icpConfig =
    (search.icpConfig as ReturnType<typeof resolveIcpConfig> | null) ??
    getIcpConfigForVertical(vertical)

  const runId = await startRun({
    accountId,
    savedSearchId: search.id,
    configId: input.config?.id,
    query: filters,
  })

  try {
    const { people } = await searchApify(filters, 1, 25, interactive)
    const fresh = await filterCandidates(
      people,
      accountId,
      input.config?.excludeDomains ?? [],
    )

    const scored = fresh
      .map((person) => ({
        person,
        icp: scoreICP(person, icpConfig),
      }))
      .sort((a, b) => b.icp.score - a.icp.score)

    const minIcp = input.config?.defaultMinIcpScore ?? 70
    let enrolled = 0
    const enrolledIds = new Set<string>()

    if (input.config && input.headroom && input.headroom > 0) {
      for (const { person, icp } of scored) {
        if (icp.score < minIcp || enrolled >= input.headroom) break
        const result = await enrollProspect({
          accountId,
          config: input.config,
          person,
          searchId: search.id,
          icpScore: icp.score,
          icpSignals: icp.signals,
          startSdrSequence: true,
        })
        if (result.enrolled) {
          enrolled += 1
          enrolledIds.add(person.id)
        }
      }
    }

    let toStore = scored.filter(
      ({ person, icp }) => icp.score >= minIcp && !enrolledIds.has(person.id),
    )
    if (toStore.length === 0 && enrolled === 0 && scored.length > 0) {
      toStore = scored.slice(0, 10)
    }

    if (toStore.length > 0) {
      await recordFoundProspects({
        accountId,
        searchId: search.id,
        people: toStore.map(({ person, icp }) => ({
          person,
          icpScore: icp.score,
          icpSignals: icp.signals,
        })),
      })
      await notifyIcpMatches(accountId, search.name, toStore.length, search.id)
    }

    const found = toStore.length > 0 ? toStore.length : fresh.length

    await db
      .update(aspireSavedSearches)
      .set({
        lastRunAt: new Date(),
        totalFound: search.totalFound + found,
        updatedAt: new Date(),
      })
      .where(eq(aspireSavedSearches.id, search.id))

    const automationId = await getSystemAutomationId(accountId, 'aspire')
    await db.insert(automationRuns).values({
      accountId,
      automationId,
      triggerEvent: 'aspire_weekly_search',
      triggerPayload: { searchId: search.id },
      actionType: 'search_apify',
      status: 'success',
      resultPayload: { newMatches: found, enrolled, runId },
    })

    await finishRun(runId, { status: 'success', resultCount: found, enrolledCount: enrolled })

    return { runId, searchId: search.id, found, enrolled, status: 'success' }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Search failed'
    await finishRun(runId, { status: 'failed', resultCount: 0, enrolledCount: 0, errorMessage: message })
    return {
      runId,
      searchId: search.id,
      found: 0,
      enrolled: 0,
      status: 'failed',
      errorMessage: message,
    }
  }
}
