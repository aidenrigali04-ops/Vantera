'use server'

import type { ActionResult } from '@/lib/auth/types'
import type { ICPConfig } from '@/lib/aspire/types'
import { db } from '@/lib/db/client'
import { logSdrActivity } from '@/lib/sdr/activity-log'
import { requireSDREnabled } from '@/lib/sdr/guard'
import { queueProspectScoutDiscovery } from '@/lib/prospect-scout/queue-discovery'
import type { CreateSDRConfigInput, SDRAgentConfig, SdrOutreachWindow } from '@/lib/sdr/types'
import { DEFAULT_OUTREACH_WINDOW } from '@/lib/sdr/types'
import { createIntelligenceSignal } from '@/lib/webhooks/resend/signals'
import { aiMemory, sdrAgentConfigs } from '@vantera/db'
import { and, eq, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

function mapConfig(row: typeof sdrAgentConfigs.$inferSelect): SDRAgentConfig {
  const contacted = row.totalContacted ?? 0
  const replied = row.totalReplied ?? 0
  const booked = row.totalBooked ?? 0

  return {
    id: row.id,
    accountId: row.accountId,
    agentName: row.agentName,
    agentTitle: row.agentTitle,
    fromEmail: row.fromEmail,
    fromName: row.fromName,
    signature: row.signature,
    icpConfig: row.icpConfig as ICPConfig,
    targetVerticals: row.targetVerticals ?? [],
    targetCities: row.targetCities ?? [],
    excludeDomains: row.excludeDomains ?? [],
    searchFrequency: (row.searchFrequency as 'daily' | 'weekly') ?? 'daily',
    outreachDays: row.outreachDays ?? ['mon', 'tue', 'wed', 'thu', 'fri'],
    outreachWindow: (row.outreachWindow as SdrOutreachWindow) ?? DEFAULT_OUTREACH_WINDOW,
    maxNewLeadsDay: row.maxNewLeadsDay,
    maxActiveLeads: row.maxActiveLeads,
    prospectMode: (row.prospectMode ?? 'inline_icp') as import('@/lib/sdr/types').ProspectMode,
    defaultMinIcpScore: row.defaultMinIcpScore ?? 70,
    syncIcpToSavedSearches: row.syncIcpToSavedSearches ?? true,
    isActive: row.isActive,
    isPaused: row.isPaused,
    pausedReason: row.pausedReason,
    stats: {
      totalLeadsFound: row.totalLeadsFound,
      totalContacted: contacted,
      totalReplied: replied,
      totalBooked: booked,
      replyRate: contacted > 0 ? Math.round((replied / contacted) * 100) : 0,
      bookingRate: replied > 0 ? Math.round((booked / replied) * 100) : 0,
    },
  }
}

export async function getSDRConfig(): Promise<SDRAgentConfig | null> {
  const { accountId } = await requireSDREnabled()

  const [row] = await db
    .select()
    .from(sdrAgentConfigs)
    .where(and(eq(sdrAgentConfigs.accountId, accountId), isNull(sdrAgentConfigs.deletedAt)))
    .limit(1)

  return row ? mapConfig(row) : null
}

export async function createSDRConfig(
  data: CreateSDRConfigInput,
): Promise<ActionResult<SDRAgentConfig>> {
  const { accountId } = await requireSDREnabled()

  if (!data.agentName?.trim()) {
    return { success: false, error: 'Agent name is required' }
  }

  const fromEmail = data.fromEmail?.trim()
  const fromName = data.fromName?.trim()
  if (!fromEmail || !fromName) {
    return {
      success: false,
      error: 'Sender identity could not be resolved — refresh and try again',
    }
  }

  const [existing] = await db
    .select({ id: sdrAgentConfigs.id })
    .from(sdrAgentConfigs)
    .where(and(eq(sdrAgentConfigs.accountId, accountId), isNull(sdrAgentConfigs.deletedAt)))
    .limit(1)

  if (existing) {
    return { success: false, error: 'SDR agent already configured — use update instead' }
  }

  const [created] = await db
    .insert(sdrAgentConfigs)
    .values({
      accountId,
      agentName: data.agentName.trim(),
      agentTitle: data.agentTitle?.trim() || 'Prospecting Agent',
      fromEmail,
      fromName,
      signature: data.signature ?? null,
      icpConfig: data.icpConfig,
      targetVerticals: data.targetVerticals ?? [],
      targetCities: data.targetCities ?? [],
      excludeDomains: data.excludeDomains ?? [],
      searchFrequency: data.searchFrequency ?? 'daily',
      outreachDays: data.outreachDays ?? ['mon', 'tue', 'wed', 'thu', 'fri'],
      outreachWindow: data.outreachWindow ?? DEFAULT_OUTREACH_WINDOW,
      maxNewLeadsDay: data.maxNewLeadsDay ?? 10,
      maxActiveLeads: data.maxActiveLeads ?? 200,
      prospectMode: data.prospectMode ?? 'inline_icp',
      defaultMinIcpScore: data.defaultMinIcpScore ?? 70,
      syncIcpToSavedSearches: data.syncIcpToSavedSearches ?? true,
      isActive: data.isActive ?? false,
    })
    .returning()

  await db.insert(aiMemory).values({
    accountId,
    kind: 'business_context',
    subjectType: 'account',
    subjectId: accountId,
    summary: `Prospecting agent ${data.agentName} configured for discovery`,
    evidence: { sdrAgent: true },
    confidence: 60,
  })

  revalidatePath('/admin/outreach/agents')
  return { success: true, data: mapConfig(created!) }
}

export async function updateSDRConfig(
  data: Partial<CreateSDRConfigInput>,
): Promise<ActionResult<SDRAgentConfig>> {
  const { accountId } = await requireSDREnabled()

  const [existing] = await db
    .select()
    .from(sdrAgentConfigs)
    .where(and(eq(sdrAgentConfigs.accountId, accountId), isNull(sdrAgentConfigs.deletedAt)))
    .limit(1)

  if (!existing) {
    return { success: false, error: 'No SDR agent configured' }
  }

  if (data.isActive === true) {
    if (!existing.fromEmail || !existing.agentName) {
      return { success: false, error: 'Complete agent identity before activating' }
    }
  }

  const activating = data.isActive === true && !existing.isActive

  const [updated] = await db
    .update(sdrAgentConfigs)
    .set({
      ...(data.agentName !== undefined ? { agentName: data.agentName.trim() } : {}),
      ...(data.agentTitle !== undefined ? { agentTitle: data.agentTitle.trim() } : {}),
      ...(data.fromEmail !== undefined ? { fromEmail: data.fromEmail.trim() } : {}),
      ...(data.fromName !== undefined ? { fromName: data.fromName.trim() } : {}),
      ...(data.signature !== undefined ? { signature: data.signature } : {}),
      ...(data.icpConfig !== undefined ? { icpConfig: data.icpConfig } : {}),
      ...(data.targetVerticals !== undefined ? { targetVerticals: data.targetVerticals } : {}),
      ...(data.targetCities !== undefined ? { targetCities: data.targetCities } : {}),
      ...(data.excludeDomains !== undefined ? { excludeDomains: data.excludeDomains } : {}),
      ...(data.searchFrequency !== undefined ? { searchFrequency: data.searchFrequency } : {}),
      ...(data.outreachDays !== undefined ? { outreachDays: data.outreachDays } : {}),
      ...(data.outreachWindow !== undefined ? { outreachWindow: data.outreachWindow } : {}),
      ...(data.maxNewLeadsDay !== undefined ? { maxNewLeadsDay: data.maxNewLeadsDay } : {}),
      ...(data.maxActiveLeads !== undefined ? { maxActiveLeads: data.maxActiveLeads } : {}),
      ...(data.prospectMode !== undefined ? { prospectMode: data.prospectMode } : {}),
      ...(data.defaultMinIcpScore !== undefined
        ? { defaultMinIcpScore: data.defaultMinIcpScore }
        : {}),
      ...(data.syncIcpToSavedSearches !== undefined
        ? { syncIcpToSavedSearches: data.syncIcpToSavedSearches }
        : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      updatedAt: new Date(),
    })
    .where(eq(sdrAgentConfigs.id, existing.id))
    .returning()

  if (activating) {
    void queueProspectScoutDiscovery(accountId).catch((err) => {
      console.error('[updateSDRConfig] failed to queue discovery after activation', err)
    })
  }

  revalidatePath('/admin/outreach/agents')
  return { success: true, data: mapConfig(updated!) }
}

export async function pauseSDRAgent(reason: string): Promise<ActionResult> {
  const { accountId } = await requireSDREnabled()

  const [config] = await db
    .select()
    .from(sdrAgentConfigs)
    .where(and(eq(sdrAgentConfigs.accountId, accountId), isNull(sdrAgentConfigs.deletedAt)))
    .limit(1)

  if (!config) return { success: false, error: 'No SDR agent configured' }

  await db
    .update(sdrAgentConfigs)
    .set({ isPaused: true, pausedReason: reason, updatedAt: new Date() })
    .where(eq(sdrAgentConfigs.id, config.id))

  await logSdrActivity({
    accountId,
    configId: config.id,
    eventType: 'agent_paused',
    metadata: { reason },
  })

  await createIntelligenceSignal({
    accountId,
    signalType: 'sdr_agent_paused',
    severity: 'yellow',
    headline: `SDR Agent paused — ${reason}`,
    actionLabel: 'Resume agent',
    actionPayload: { configId: config.id },
    expiresInDays: 3,
  })

  revalidatePath('/admin/outreach/agents')
  return { success: true, data: undefined }
}

export async function resumeSDRAgent(): Promise<
  ActionResult<{ discoveryQueued?: boolean; triggerRunId?: string }>
> {
  const { accountId } = await requireSDREnabled()

  const [config] = await db
    .select()
    .from(sdrAgentConfigs)
    .where(and(eq(sdrAgentConfigs.accountId, accountId), isNull(sdrAgentConfigs.deletedAt)))
    .limit(1)

  if (!config) return { success: false, error: 'No SDR agent configured' }

  await db
    .update(sdrAgentConfigs)
    .set({ isPaused: false, pausedReason: null, updatedAt: new Date() })
    .where(eq(sdrAgentConfigs.id, config.id))

  await logSdrActivity({
    accountId,
    configId: config.id,
    eventType: 'agent_resumed',
  })

  const queueResult = await queueProspectScoutDiscovery(accountId)
  if (queueResult.mode === 'failed') {
    return {
      success: false,
      error: queueResult.error,
    }
  }

  revalidatePath('/admin/outreach/agents')
  return {
    success: true,
    data: {
      discoveryQueued: queueResult.mode === 'trigger',
      triggerRunId: queueResult.mode === 'trigger' ? queueResult.triggerRunId : undefined,
    },
  }
}
