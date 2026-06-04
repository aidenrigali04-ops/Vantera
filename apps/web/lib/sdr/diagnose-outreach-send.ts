import { db } from '@/lib/db/client'
import type { Plan } from '@/lib/feature-flags/flags'
import { isAccountAutomaticOutreach } from '@/lib/sdr/outreach-automation-account'
import { isSdrEnabledForAccount } from '@/lib/sdr/guard'
import { findDueSdrSteps } from '@/lib/sdr/queries'
import { isOutreachDay, isWithinOutreachWindow } from '@/lib/sdr/schedule'
import type { SdrOutreachWindow } from '@/lib/sdr/types'
import { accounts, leads, sdrAgentConfigs, sdrSequences } from '@vantera/db'
import { and, eq, isNull } from 'drizzle-orm'

export const DEFAULT_OUTREACH_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri'] as const

export type OutreachSendSkipReason =
  | 'sdr_feature_disabled'
  | 'review_mode'
  | 'outside_send_window'
  | 'not_outreach_day'
  | 'no_due_steps'
  | 'config_inactive'
  | 'config_paused'

export type AccountSendDiagnostic = {
  accountId: string
  agentName: string
  skipped: boolean
  skipReason?: OutreachSendSkipReason
  detail?: string
  dueStepCount: number
  readyToSendCount: number
  outreachMode: 'automatic' | 'review' | 'unknown'
  inSendWindow: boolean
  onOutreachDay: boolean
  outreachDays: string[]
}

export type OutreachSendDiagnostics = {
  checkedAt: string
  accountsChecked: number
  accountsSkipped: number
  dueStepsTotal: number
  readyToSendTotal: number
  wouldSendWithoutDryRun: number
  accounts: AccountSendDiagnostic[]
  pipelineHints: string[]
}

function resolveOutreachDays(days: string[] | null | undefined): string[] {
  return days && days.length > 0 ? days : [...DEFAULT_OUTREACH_DAYS]
}

export async function diagnoseOutreachSend(options?: {
  accountId?: string
  now?: Date
}): Promise<OutreachSendDiagnostics> {
  const now = options?.now ?? new Date()
  const filters = [
    eq(sdrAgentConfigs.isActive, true),
    eq(sdrAgentConfigs.isPaused, false),
    isNull(sdrAgentConfigs.deletedAt),
  ]
  if (options?.accountId) {
    filters.push(eq(sdrAgentConfigs.accountId, options.accountId))
  }

  const configs = await db
    .select({
      config: sdrAgentConfigs,
      plan: accounts.plan,
    })
    .from(sdrAgentConfigs)
    .innerJoin(accounts, eq(sdrAgentConfigs.accountId, accounts.id))
    .where(and(...filters))

  const accountsDiag: AccountSendDiagnostic[] = []
  const pipelineHints = new Set<string>()
  let dueStepsTotal = 0
  let readyToSendTotal = 0

  for (const { config, plan } of configs) {
    const outreachDays = resolveOutreachDays(config.outreachDays)
    const window = (config.outreachWindow as SdrOutreachWindow) ?? {
      startHour: 8,
      endHour: 17,
      tz: 'America/New_York',
    }
    const inSendWindow = isWithinOutreachWindow(now, window)
    const onOutreachDay = isOutreachDay(now, outreachDays, window.tz)
    const sdrEnabled = await isSdrEnabledForAccount(config.accountId, plan as Plan)
    const automatic = sdrEnabled ? await isAccountAutomaticOutreach(config.accountId) : false
    const dueSteps = await findDueSdrSteps(config.accountId, 50)
    dueStepsTotal += dueSteps.length

    let skipReason: OutreachSendSkipReason | undefined
    let detail: string | undefined

    if (!sdrEnabled) {
      skipReason = 'sdr_feature_disabled'
      detail = 'Enable SDR agents (sdr_agent_enabled) for this workspace.'
      pipelineHints.add('SDR module is off — run setup / activate SDR from Agents hub.')
    } else if (!automatic) {
      skipReason = 'review_mode'
      detail = 'Outreach automation is Review before send — scheduler will not auto-send.'
      pipelineHints.add('Set outreach mode to Automatic in SDR hub, or approve drafts in Message Drafter.')
    } else if (!inSendWindow) {
      skipReason = 'outside_send_window'
      detail = `Current time is outside ${window.startHour}:00–${window.endHour}:00 ${window.tz}.`
      pipelineHints.add('Trigger test during send window, or widen outreach window in SDR setup.')
    } else if (!onOutreachDay) {
      skipReason = 'not_outreach_day'
      detail = `Today (${window.tz}) is not in outreach days: ${outreachDays.join(', ') || '(empty)'}.`
      if (config.outreachDays?.length === 0) {
        pipelineHints.add('outreach_days was empty — scheduler treated as no send days (use Mon–Fri).')
      }
    } else if (dueSteps.length === 0) {
      skipReason = 'no_due_steps'
      detail = 'No sequence steps with status=scheduled and scheduledFor <= now.'
      pipelineHints.add('Complete pipeline: Scout enroll → Lead Profiler drafts → steps must be scheduled in the past.')
    }

    let readyToSendCount = 0
    if (!skipReason) {
      for (const step of dueSteps) {
        const [sequence] = await db
          .select({ status: sdrSequences.status })
          .from(sdrSequences)
          .where(eq(sdrSequences.id, step.sequenceId))
          .limit(1)

        if (!sequence || sequence.status !== 'active') continue

        const [lead] = await db
          .select({ email: leads.email, phone: leads.phone, tags: leads.tags })
          .from(leads)
          .where(eq(leads.id, step.leadId))
          .limit(1)

        if (!lead || lead.tags?.includes('unsubscribed')) continue
        if (step.channel === 'email' && !lead.email) continue
        if (step.channel === 'sms' && !lead.phone) continue
        if (step.channel === 'linkedin') continue

        readyToSendCount += 1
      }
      readyToSendTotal += readyToSendCount

      if (dueSteps.length > 0 && readyToSendCount === 0) {
        detail =
          'Due steps exist but none are send-ready (inactive sequence, missing email/phone, or LinkedIn-only).'
        pipelineHints.add('Check sequences are active and leads have email for email steps.')
      }
    }

    accountsDiag.push({
      accountId: config.accountId,
      agentName: config.agentName,
      skipped: Boolean(skipReason),
      skipReason,
      detail,
      dueStepCount: dueSteps.length,
      readyToSendCount,
      outreachMode: !sdrEnabled ? 'unknown' : automatic ? 'automatic' : 'review',
      inSendWindow,
      onOutreachDay,
      outreachDays,
    })
  }

  if (configs.length === 0) {
    pipelineHints.add('No active, unpaused sdr_agent_configs — complete SDR setup wizard first.')
  }

  const inactiveConfigs = await db
    .select({ id: sdrAgentConfigs.id, isActive: sdrAgentConfigs.isActive, isPaused: sdrAgentConfigs.isPaused })
    .from(sdrAgentConfigs)
    .where(
      options?.accountId
        ? and(eq(sdrAgentConfigs.accountId, options.accountId), isNull(sdrAgentConfigs.deletedAt))
        : isNull(sdrAgentConfigs.deletedAt),
    )

  for (const row of inactiveConfigs) {
    if (!row.isActive) pipelineHints.add('SDR config exists but isActive=false.')
    if (row.isPaused) pipelineHints.add('SDR config is paused — resume from Agents hub.')
  }

  return {
    checkedAt: now.toISOString(),
    accountsChecked: configs.length,
    accountsSkipped: accountsDiag.filter((a) => a.skipped).length,
    dueStepsTotal,
    readyToSendTotal,
    wouldSendWithoutDryRun: readyToSendTotal,
    accounts: accountsDiag,
    pipelineHints: [...pipelineHints],
  }
}
