'use server'

import type { ActionResult } from '@/lib/auth/types'
import { requireAdminSession } from '@/lib/auth/require-session'
import { db } from '@/lib/db/client'
import { logOutreachAgentActivity } from '@/lib/outreach-agent/activity-log'
import {
  assertCampaignsBelongToAccount,
  findOutreachAgentConfigByAccount,
} from '@/lib/outreach-agent/queries'
import type {
  LaunchOutreachAgentInput,
  UpdateOutreachAgentInput,
} from '@/lib/outreach-agent/types'
import { isAccountAutomaticOutreach } from '@/lib/sdr/outreach-automation-account'
import {
  normalizeLinkedCampaignIds,
  validateLaunchOutreachAgentForAccount,
  validateUpdateOutreachAgentInput,
} from '@/lib/outreach-agent/validate'
import { outreachAgentConfigs } from '@vantera/db'
import { and, eq, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

function revalidateOutreachAgentPaths() {
  revalidatePath('/admin/outreach/agents')
  revalidatePath('/admin/outreach/agents/outreach')
  revalidatePath('/admin/outreach/agents/outreach/setup')
}

export async function launchOutreachAgent(
  input: LaunchOutreachAgentInput,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminSession()
  if (session.role !== 'owner') {
    return { success: false, error: 'Only the account owner can activate Outreach Agent' }
  }
  const accountId = session.accountId

  const validationError = await validateLaunchOutreachAgentForAccount(accountId, input)
  if (validationError) return { success: false, error: validationError }

  const existing = await findOutreachAgentConfigByAccount(accountId)
  if (existing) {
    return { success: false, error: 'Outreach Agent is already configured' }
  }

  const linkedCampaignIds = normalizeLinkedCampaignIds(input.linkedCampaignIds)
  const ownership = await assertCampaignsBelongToAccount(accountId, linkedCampaignIds)
  if (!ownership.ok) return { success: false, error: ownership.error }

  const [row] = await db
    .insert(outreachAgentConfigs)
    .values({
      accountId,
      agentName: input.agentName.trim(),
      linkedCampaignIds,
      isActive: true,
      isPaused: false,
      pausedReason: null,
    })
    .returning({ id: outreachAgentConfigs.id })

  await logOutreachAgentActivity(accountId, {
    eventType: 'outreach_agent_launched',
    metadata: {
      agentName: input.agentName.trim(),
      linkedCampaigns: linkedCampaignIds.length,
    },
  })

  const { flushAutomaticOutreachPipelines } = await import(
    '@/lib/sdr/outreach-automation-policy'
  )
  try {
    await flushAutomaticOutreachPipelines(accountId)
  } catch {
    // Non-fatal: agent is active; user can run queue from command center.
  }

  revalidateOutreachAgentPaths()
  return { success: true, data: { id: row!.id } }
}

export async function updateOutreachAgentConfig(
  input: UpdateOutreachAgentInput,
): Promise<ActionResult> {
  const session = await requireAdminSession()
  const automaticOutreach = await isAccountAutomaticOutreach(session.accountId)
  const validationError = validateUpdateOutreachAgentInput(input, { automaticOutreach })
  if (validationError) return { success: false, error: validationError }

  const existing = await findOutreachAgentConfigByAccount(session.accountId)
  if (!existing) return { success: false, error: 'Configure Outreach Agent first' }

  const linkedCampaignIds =
    input.linkedCampaignIds !== undefined
      ? normalizeLinkedCampaignIds(input.linkedCampaignIds)
      : existing.linkedCampaignIds

  if (input.linkedCampaignIds !== undefined) {
    const ownership = await assertCampaignsBelongToAccount(session.accountId, linkedCampaignIds)
    if (!ownership.ok) return { success: false, error: ownership.error }
  }

  await db
    .update(outreachAgentConfigs)
    .set({
      agentName: input.agentName?.trim() ?? existing.agentName,
      linkedCampaignIds,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(outreachAgentConfigs.accountId, session.accountId),
        isNull(outreachAgentConfigs.deletedAt),
      ),
    )

  revalidateOutreachAgentPaths()
  return { success: true, data: undefined }
}

export async function pauseOutreachAgent(reason?: string): Promise<ActionResult> {
  const session = await requireAdminSession()
  const existing = await findOutreachAgentConfigByAccount(session.accountId)
  if (!existing) return { success: false, error: 'Configure Outreach Agent first' }

  await db
    .update(outreachAgentConfigs)
    .set({
      isPaused: true,
      pausedReason: reason?.trim() || 'Paused from command center',
      updatedAt: new Date(),
    })
    .where(eq(outreachAgentConfigs.accountId, session.accountId))

  await logOutreachAgentActivity(session.accountId, {
    eventType: 'outreach_agent_paused',
    metadata: { reason: reason?.trim() || 'Paused from command center' },
  })

  revalidateOutreachAgentPaths()
  return { success: true, data: undefined }
}

export async function resumeOutreachAgent(): Promise<ActionResult> {
  const session = await requireAdminSession()
  const existing = await findOutreachAgentConfigByAccount(session.accountId)
  if (!existing) return { success: false, error: 'Configure Outreach Agent first' }

  await db
    .update(outreachAgentConfigs)
    .set({
      isActive: true,
      isPaused: false,
      pausedReason: null,
      updatedAt: new Date(),
    })
    .where(eq(outreachAgentConfigs.accountId, session.accountId))

  await logOutreachAgentActivity(session.accountId, {
    eventType: 'outreach_agent_resumed',
  })

  revalidateOutreachAgentPaths()
  return { success: true, data: undefined }
}

export async function runLinkedCampaignQueueNow(): Promise<
  ActionResult<{ sent: number; manualReady: number; failed: number; processed: number }>
> {
  const session = await requireAdminSession()
  const existing = await findOutreachAgentConfigByAccount(session.accountId)
  if (!existing) return { success: false, error: 'Configure Outreach Agent first' }
  if (existing.isPaused) {
    return { success: false, error: 'Resume Outreach Agent before processing the queue' }
  }

  const { getOutreachEmailSendReadiness } = await import('@/lib/outreach/send-identity')
  const readiness = await getOutreachEmailSendReadiness(session.accountId)
  if (!readiness.ready) {
    return { success: false, error: readiness.message }
  }

  const { processDueCampaignSteps } = await import('@/lib/outreach/runner')
  const result = await processDueCampaignSteps(session.accountId, session.userId, {
    campaignIds: existing.linkedCampaignIds,
  })

  await logOutreachAgentActivity(session.accountId, {
    eventType: 'outreach_queue_run',
    metadata: {
      sent: result.sent,
      manualReady: result.manualReady,
      failed: result.failed,
      processed: result.processed,
    },
  })

  revalidateOutreachAgentPaths()
  return {
    success: true,
    data: {
      sent: result.sent,
      manualReady: result.manualReady,
      failed: result.failed,
      processed: result.processed,
    },
  }
}
