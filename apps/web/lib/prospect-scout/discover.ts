import { recoverStaleAspireSearchRuns } from '@/lib/prospect-scout/recover-stale-runs'
import { scoreICP } from '@/lib/aspire/icp-score'
import { getAspireApifyFetchCount } from '@/lib/aspire/apify-client'
import { searchApify } from '@/lib/aspire/search'
import { getSystemAutomationId } from '@/lib/automation/system-automation'
import { db } from '@/lib/db/client'
import {
  enrollProspect,
  notifyIcpMatches,
  recordFoundProspects,
} from '@/lib/prospect-scout/enroll'
import { buildScoutApifyFilters } from '@/lib/prospect-scout/filters'
import {
  filterKnownProspectIds,
  partitionFreshProspects,
} from '@/lib/prospect-scout/filter-known-prospects'
import {
  buildRotatedScoutApifyFilters,
  persistScoutRotationIndex,
  readScoutRotationIndex,
} from '@/lib/prospect-scout/rotation'
import type { SdrConfigRow } from '@/lib/prospect-scout/types'
import type { ApifyLead } from '@/lib/aspire/types'
import type { ProspectSearchMeta } from '@/lib/aspire/apify-client'
import { logSdrActivity } from '@/lib/sdr/activity-log'
import { runAutomaticOutreachAfterScout } from '@/lib/sdr/automatic-pipeline'
import { isAccountAutomaticOutreach } from '@/lib/sdr/outreach-automation-account'
import type { ScoutRunEnrollment } from '@/lib/outreach/automatic-scout-campaign'
import { countActiveSdrSequences, countSdrEnrolledToday } from '@/lib/sdr/queries'
import type { ICPConfig } from '@/lib/aspire/types'
import { aspireSearchRuns, automationRuns, sdrAgentConfigs } from '@vantera/db'
import { eq } from 'drizzle-orm'

export { buildScoutApifyFilters } from '@/lib/prospect-scout/filters'

const ROTATION_ATTEMPTS = 4
const MIN_FRESH_PER_RUN = 3

export type ScoutDiscoveryResult = {
  runId: string
  found: number
  stored: number
  enrolled: number
  enrollments: ScoutRunEnrollment[]
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
  const perPage = options?.perPage ?? getAspireApifyFetchCount()
  const autoEnroll = options?.autoEnroll ?? true

  await recoverStaleAspireSearchRuns(config.accountId)

  const [runRow] = await db
    .insert(aspireSearchRuns)
    .values({
      accountId: config.accountId,
      savedSearchId: null,
      configId: config.id,
      query: buildScoutApifyFilters(config),
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

    const rotationIndex = readScoutRotationIndex(config.icpConfig)
    const excludeDomains = new Set((config.excludeDomains ?? []).map((d) => d.toLowerCase()))

    let apifyReturned = 0
    let skippedKnown = 0
    let skippedDomain = 0
    let rotationAttempts = 0
    let searchMeta: ProspectSearchMeta | null = null
    const freshById = new Map<string, ApifyLead>()

    for (let attempt = 0; attempt < ROTATION_ATTEMPTS; attempt += 1) {
      const rotatedFilters = buildRotatedScoutApifyFilters(
        config,
        rotationIndex + attempt,
      )
      const { people, meta } = await searchApify(rotatedFilters, 1, perPage)
      rotationAttempts += 1
      apifyReturned += people.length
      searchMeta = meta

      const knownIds = await filterKnownProspectIds(config.accountId, people)
      const partition = partitionFreshProspects(people, knownIds, excludeDomains)
      skippedKnown += partition.skippedKnown
      skippedDomain += partition.skippedDomain

      for (const person of partition.fresh) {
        freshById.set(person.id, person)
      }

      if (freshById.size >= MIN_FRESH_PER_RUN) break
      if (people.length === 0) break
    }

    const fresh = [...freshById.values()]

    await persistScoutRotationIndex(config.id, config.icpConfig, rotationIndex + 1)

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
    const scoutEnrollments: ScoutRunEnrollment[] = []
    const minIcp = config.defaultMinIcpScore ?? 70
    const shouldEnroll = autoEnroll && config.isActive && !config.isPaused
    let skippedBelowIcp = 0

    for (const { person, icp } of scored.sort((a, b) => b.icp.score - a.icp.score)) {
      if (icp.score < minIcp) {
        skippedBelowIcp += 1
        continue
      }
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
      if (result.sequenceId && result.leadId) {
        scoutEnrollments.push({
          leadId: result.leadId,
          sequenceId: result.sequenceId,
        })
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

    if (enrolled > 0 && (await isAccountAutomaticOutreach(config.accountId))) {
      try {
        const pipeline = await runAutomaticOutreachAfterScout(config.accountId, {
          configId: config.id,
          runId,
          enrollments: scoutEnrollments,
        })
        await logSdrActivity({
          accountId: config.accountId,
          configId: config.id,
          eventType: 'auto_outreach_flush',
          metadata: {
            runId,
            drafted: pipeline.drafted,
            campaignLaunched: pipeline.campaignLaunched,
            campaignStepsCreated: pipeline.campaignStepsCreated,
            campaignSent: pipeline.campaignSent,
          },
        })
      } catch (error) {
        console.error('[prospect-scout] automatic outreach after scout failed', error)
      }
    }

    const discoveryMeta = {
      found: fresh.length,
      stored,
      enrolled,
      runId,
      headroom,
      enrolledToday,
      activeSequences: activeCount,
      rotationIndex,
      rotationAttempts,
      apifyReturned,
      skippedKnown,
      skippedDomain,
      skippedBelowIcp,
      minIcp,
      apifySource: searchMeta?.source ?? null,
      apifyError: searchMeta?.providerError ?? null,
      zeroLeadsReason:
        fresh.length === 0
          ? apifyReturned === 0
            ? 'apify_empty'
            : skippedKnown >= apifyReturned
              ? 'all_already_in_workspace'
              : 'filters_or_icp'
          : enrolled === 0 && headroom <= 0
            ? 'daily_or_active_cap_reached'
            : enrolled === 0 && skippedBelowIcp > 0
              ? 'below_min_icp_score'
              : null,
    }

    await logSdrActivity({
      accountId: config.accountId,
      configId: config.id,
      eventType: 'discovery_completed',
      metadata: discoveryMeta,
    })

    const automationId = await getSystemAutomationId(config.accountId, 'sdr_find')
    await db.insert(automationRuns).values({
      accountId: config.accountId,
      automationId,
      triggerEvent: 'prospect_scout_discover',
      actionType: 'lead_discovery',
      status: 'success',
      resultPayload: discoveryMeta,
    })

    return { runId, found: fresh.length, stored, enrolled, enrollments: scoutEnrollments }
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
