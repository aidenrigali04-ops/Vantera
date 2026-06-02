import { scoreICP } from '@/lib/aspire/icp-score'
import { filterExistingLeads, searchApollo } from '@/lib/aspire/search'
import { getSystemAutomationId } from '@/lib/automation/system-automation'
import { db } from '@/lib/db/client'
import { domainFromEmail, enrollProspect } from '@/lib/prospect-scout/enroll'
import type { SdrConfigRow } from '@/lib/prospect-scout/types'
import { countActiveSdrSequences, countSdrEnrolledToday } from '@/lib/sdr/queries'
import type { ICPConfig } from '@/lib/aspire/types'
import { automationRuns, sdrAgentConfigs } from '@vantera/db'
import { eq } from 'drizzle-orm'

function buildApolloFilters(config: SdrConfigRow) {
  const icp = config.icpConfig as {
    targetTitles?: string[]
    targetIndustries?: string[]
    targetSizes?: [number, number]
  }

  return {
    jobTitles: icp.targetTitles ?? ['Owner', 'CEO', 'Founder'],
    industries: config.targetVerticals.length
      ? config.targetVerticals
      : (icp.targetIndustries ?? []),
    companySizeRanges: icp.targetSizes
      ? [`${icp.targetSizes[0]},${icp.targetSizes[1]}`]
      : ['1,200'],
    locations: config.targetCities ?? [],
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Legacy inline Apollo discovery (no saved Aspire search). */
export async function runInlineProspectFind(config: SdrConfigRow): Promise<{
  found: number
  enrolled: number
}> {
  const activeCount = await countActiveSdrSequences(config.accountId)
  if (activeCount >= config.maxActiveLeads) return { found: 0, enrolled: 0 }

  const enrolledToday = await countSdrEnrolledToday(config.accountId)
  const headroom = Math.min(
    config.maxNewLeadsDay - enrolledToday,
    config.maxActiveLeads - activeCount,
  )
  if (headroom <= 0) return { found: 0, enrolled: 0 }

  const filters = buildApolloFilters(config)
  const icpConfig = config.icpConfig as ICPConfig
  const { people } = await searchApollo(filters, 1, 25)
  const existingIds = new Set(await filterExistingLeads(config.accountId, people.map((p) => p.id)))
  const excludeDomains = new Set((config.excludeDomains ?? []).map((d) => d.toLowerCase()))

  const candidates = people
    .filter((p) => !existingIds.has(p.id))
    .filter((p) => {
      const domain = domainFromEmail(p.email)
      return !domain || !excludeDomains.has(domain)
    })
    .map((person) => ({
      person,
      icp: scoreICP(person, icpConfig),
    }))
    .sort((a, b) => b.icp.score - a.icp.score)
    .slice(0, headroom)

  let enrolled = 0
  for (const { person, icp } of candidates) {
    if (icp.score < config.defaultMinIcpScore) continue

    const result = await enrollProspect({
      accountId: config.accountId,
      config,
      person,
      searchId: '',
      icpScore: icp.score,
      icpSignals: icp.signals,
      startSdrSequence: true,
    })
    if (result.enrolled) enrolled += 1
  }

  await db
    .update(sdrAgentConfigs)
    .set({
      totalLeadsFound: config.totalLeadsFound + candidates.length,
      lastRunAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(sdrAgentConfigs.id, config.id))

  const automationId = await getSystemAutomationId(config.accountId, 'sdr_find')
  await db.insert(automationRuns).values({
    accountId: config.accountId,
    automationId,
    triggerEvent: 'sdr_agent_find',
    actionType: 'lead_discovery',
    status: 'success',
    resultPayload: { enrolled, mode: 'inline_icp' },
  })

  return { found: candidates.length, enrolled }
}

export async function runInlineProspectFindBatch(
  configs: SdrConfigRow[],
): Promise<{ accountsRun: number; leadsEnrolled: number }> {
  let accountsRun = 0
  let leadsEnrolled = 0

  for (const config of configs) {
    try {
      const { enrolled } = await runInlineProspectFind(config)
      if (enrolled > 0 || config.isActive) accountsRun += 1
      leadsEnrolled += enrolled
    } catch (error) {
      console.error('[prospect-scout:inline] account failed:', config.accountId, error)
    }
    await sleep(300)
  }

  return { accountsRun, leadsEnrolled }
}
