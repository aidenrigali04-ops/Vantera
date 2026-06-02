import { recoverStaleAspireSearchRuns } from '@/lib/prospect-scout/recover-stale-runs'
import { scoreICP } from '@/lib/aspire/icp-score'
import { getAspireApifyFetchCount } from '@/lib/aspire/apify-client'
import { filterExistingLeads, searchApify } from '@/lib/aspire/search'
import type { ApolloSearchFilters } from '@/lib/aspire/types'
import { getSystemAutomationId } from '@/lib/automation/system-automation'
import { db } from '@/lib/db/client'
import {
  domainFromEmail,
  enrollProspect,
  notifyIcpMatches,
  recordFoundProspects,
} from '@/lib/prospect-scout/enroll'
import type { SdrConfigRow } from '@/lib/prospect-scout/types'
import { countActiveSdrSequences, countSdrEnrolledToday } from '@/lib/sdr/queries'
import type { ICPConfig } from '@/lib/aspire/types'
import { aspireSearchRuns, automationRuns, sdrAgentConfigs } from '@vantera/db'
import { eq } from 'drizzle-orm'

export function buildScoutApolloFilters(config: SdrConfigRow): ApolloSearchFilters {
  const icp = config.icpConfig as {
    targetTitles?: string[]
    targetIndustries?: string[]
    targetSizes?: [number, number]
  }

  return {
    jobTitles: icp.targetTitles ?? ['Owner', 'CEO', 'Founder', 'President'],
    industries: config.targetVerticals.length
      ? config.targetVerticals
      : (icp.targetIndustries ?? []),
    companySizeRanges: icp.targetSizes
      ? [`${icp.targetSizes[0]},${icp.targetSizes[1]}`]
      : ['1,10', '11,50', '51,200'],
    locations: config.targetCities.length ? config.targetCities : ['United States'],
    contactEmailStatus: undefined,
  }
}

export type ScoutDiscoveryResult = {
  runId: string
  found: number
  stored: number
  enrolled: number
}

/**
 * Prospect Scout: Apify discovery → ICP score → pipeline leads (and optional SDR sequence).
 * Uses aspire_results as internal staging; not the manual Aspire search UI.
 */
export async function runProspectScoutDiscovery(
  config: SdrConfigRow,
  options?: { autoEnroll?: boolean; perPage?: number },
): Promise<ScoutDiscoveryResult> {
  const icpConfig = config.icpConfig as ICPConfig
  const filters = buildScoutApolloFilters(config)
  const perPage = options?.perPage ?? getAspireApifyFetchCount()
  const autoEnroll = options?.autoEnroll ?? true

  await recoverStaleAspireSearchRuns(config.accountId)

  const [runRow] = await db
    .insert(aspireSearchRuns)
    .values({
      accountId: config.accountId,
      savedSearchId: null,
      configId: config.id,
      query: filters,
      status: 'running',
      resultCount: 0,
      enrolledCount: 0,
    })
    .returning({ id: aspireSearchRuns.id })

  const runId = runRow!.id

  try {
    const activeCount = await countActiveSdrSequences(config.accountId)
    const enrolledToday = await countSdrEnrolledToday(config.accountId)
    let headroom =
      activeCount >= config.maxActiveLeads
        ? 0
        : Math.min(
            config.maxNewLeadsDay - enrolledToday,
            config.maxActiveLeads - activeCount,
          )

    const { people } = await searchApify(filters, 1, perPage)
    const existingIds = new Set(await filterExistingLeads(config.accountId, people.map((p) => p.id)))
    const excludeDomains = new Set((config.excludeDomains ?? []).map((d) => d.toLowerCase()))

    const fresh = people.filter((p) => {
      if (existingIds.has(p.id)) return false
      const domain = domainFromEmail(p.email)
      return !domain || !excludeDomains.has(domain)
    })

    const scored = fresh.map((person) => ({
      person,
      icp: scoreICP(person, icpConfig),
    }))

    const stored = await recordFoundProspects({
      accountId: config.accountId,
      searchId: null,
      people: scored.map(({ person, icp }) => ({
        person,
        icpScore: icp.score,
        icpSignals: icp.signals,
      })),
    })

    let enrolled = 0
    const minIcp = config.defaultMinIcpScore ?? 70
    const shouldEnroll =
      autoEnroll && config.isActive && !config.isPaused && headroom > 0

    for (const { person, icp } of scored.sort((a, b) => b.icp.score - a.icp.score)) {
      if (icp.score < minIcp) continue
      if (!shouldEnroll) continue

      const withSequence = headroom > 0
      const result = await enrollProspect({
        accountId: config.accountId,
        config,
        person,
        searchId: null,
        icpScore: icp.score,
        icpSignals: icp.signals,
        startSdrSequence: withSequence,
        pipelineOnlyFromScout: !withSequence,
      })

      if (result.enrolled) {
        enrolled += 1
        if (withSequence) headroom -= 1
      }
    }

    if (stored > 0) {
      await notifyIcpMatches(config.accountId, 'Prospect Scout', stored, '')
    }

    await db
      .update(sdrAgentConfigs)
      .set({
        totalLeadsFound: config.totalLeadsFound + fresh.length,
        lastRunAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(sdrAgentConfigs.id, config.id))

    await db
      .update(aspireSearchRuns)
      .set({
        status: 'success',
        resultCount: fresh.length,
        enrolledCount: enrolled,
        finishedAt: new Date(),
      })
      .where(eq(aspireSearchRuns.id, runId))

    const automationId = await getSystemAutomationId(config.accountId, 'sdr_find')
    await db.insert(automationRuns).values({
      accountId: config.accountId,
      automationId,
      triggerEvent: 'prospect_scout_discover',
      actionType: 'lead_discovery',
      status: 'success',
      resultPayload: { found: fresh.length, stored, enrolled, runId },
    })

    return { runId, found: fresh.length, stored, enrolled }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Discovery failed'
    await db
      .update(aspireSearchRuns)
      .set({
        status: 'failed',
        errorMessage: message,
        finishedAt: new Date(),
      })
      .where(eq(aspireSearchRuns.id, runId))
    throw error
  }
}
