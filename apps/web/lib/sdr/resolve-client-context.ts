import type { ICPConfig } from '@/lib/aspire/types'
import { db } from '@/lib/db/client'
import { evaluateFlag } from '@/lib/feature-flags/evaluate'
import type { Plan } from '@/lib/feature-flags/flags'
import {
  isAutomaticOutreachMode,
  resolveOutreachAutomationMode,
} from '@/lib/sdr/outreach-automation'
import type { SdrOutreachWindow } from '@/lib/sdr/types'
import { DEFAULT_OUTREACH_WINDOW } from '@/lib/sdr/types'
import { accounts, featureFlags, sdrAgentConfigs } from '@vantera/db'
import { and, eq, isNull } from 'drizzle-orm'

const VERTICAL_PAIN: Record<string, string> = {
  hvac: 'Missing calls when techs are in the field — losing 2–3 jobs per week',
  landscaping: 'Estimate follow-up is manual — close rate suffers without second touch',
  plumbing: 'Slow quote follow-up — prospects book whoever responds first',
  construction: 'Clients lack project visibility — constant status calls and referral loss',
  property_mgmt: 'Maintenance requests fall through spreadsheets until they explode',
  real_estate: 'Leads go cold within hours — response time drives conversion',
  agency: 'Manual follow-up and scattered tools — hard to look professional at scale',
}

const VERTICAL_PROOF: Record<string, string> = {
  hvac: 'Teams often recover several missed-call jobs in the first month with automated text-back',
  landscaping: 'Automated estimate follow-up commonly lifts close rates on open quotes',
  construction: 'Status updates and review requests reduce "what is happening?" calls',
  property_mgmt: 'Centralized maintenance tracking cuts duplicate vendor chasing',
  real_estate: 'Faster first response materially improves lead conversion',
  agency: 'White-label client portal makes the business look larger than headcount',
}

function verticalString(map: Record<string, string>, key: string, fallback = 'agency'): string {
  return map[key] ?? map[fallback] ?? ''
}

const VOICE_BY_VERTICAL: Record<string, string> = {
  hvac: 'direct and results-focused',
  landscaping: 'practical and seasonal',
  construction: 'clear and process-oriented',
  property_mgmt: 'organized and reassuring',
  real_estate: 'fast and relationship-aware',
  agency: 'confident and peer-level',
}

export type ClientAgentContext = {
  accountId: string
  businessName: string
  vertical: string
  plan: Plan
  agentName: string
  agentTitle: string
  fromEmail: string
  fromName: string
  signature: string | null
  icpConfig: ICPConfig
  targetVerticals: string[]
  targetCities: string[]
  excludeDomains: string[]
  searchFrequency: string
  maxNewLeadsDay: number
  maxActiveLeads: number
  outreachWindow: SdrOutreachWindow
  outreachDays: string[]
  prospectMode: string
  defaultMinIcpScore: number
  voiceTone: string
  keyDifferentiator: string
  primaryVerticalPain: string
  proofPoint: string
  bookingLink: string | null
  icpDescription: string | null
  valueProposition: string | null
  icpSummary: string | null
  autonomousOutreach: boolean
  sdrEnabled: boolean
}

export async function resolveClientContext(accountId: string): Promise<ClientAgentContext | null> {
  const [account] = await db
    .select({
      name: accounts.name,
      vertical: accounts.vertical,
      plan: accounts.plan,
      bookingLink: accounts.bookingLink,
      voicePreference: accounts.voicePreference,
      icpDescription: accounts.icpDescription,
      valueProposition: accounts.valueProposition,
      icpSummary: accounts.icpSummary,
    })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1)

  if (!account) return null

  const plan = (account.plan ?? 'team') as Plan

  const [flagRow] = await db
    .select({ isEnabled: featureFlags.isEnabled })
    .from(featureFlags)
    .where(
      and(eq(featureFlags.accountId, accountId), eq(featureFlags.flagName, 'sdr_agent_enabled')),
    )
    .limit(1)

  const sdrEnabled = flagRow
    ? flagRow.isEnabled
    : await evaluateFlag({ accountId, plan, flagName: 'sdr_agent_enabled' })

  if (!sdrEnabled) return null

  const [config] = await db
    .select()
    .from(sdrAgentConfigs)
    .where(and(eq(sdrAgentConfigs.accountId, accountId), isNull(sdrAgentConfigs.deletedAt)))
    .limit(1)

  if (!config) return null

  const vertical = account.vertical ?? 'agency'
  const verticalKey = vertical in VERTICAL_PAIN ? vertical : 'agency'
  const automationMode = await resolveOutreachAutomationMode(
    accountId,
    plan,
    config.outreachAutomationMode,
  )
  const autonomousOutreach = isAutomaticOutreachMode(automationMode)

  const icpConfig = config.icpConfig as ICPConfig

  return {
    accountId,
    businessName: account.name,
    vertical,
    plan,
    agentName: config.agentName,
    agentTitle: config.agentTitle,
    fromEmail: config.fromEmail,
    fromName: config.fromName,
    signature: config.signature,
    icpConfig,
    targetVerticals: config.targetVerticals ?? [],
    targetCities: config.targetCities ?? [],
    excludeDomains: config.excludeDomains ?? [],
    searchFrequency: config.searchFrequency,
    maxNewLeadsDay: config.maxNewLeadsDay,
    maxActiveLeads: config.maxActiveLeads,
    outreachWindow: (config.outreachWindow as SdrOutreachWindow) ?? DEFAULT_OUTREACH_WINDOW,
    outreachDays: config.outreachDays ?? ['mon', 'tue', 'wed', 'thu', 'fri'],
    prospectMode: config.prospectMode ?? 'inline_icp',
    defaultMinIcpScore: config.defaultMinIcpScore ?? 70,
    voiceTone:
      account.voicePreference ??
      (verticalString(VOICE_BY_VERTICAL, verticalKey) || 'direct and professional'),
    keyDifferentiator:
      account.valueProposition?.trim() ||
      'white-label client portal, stage-aware automations, and missed-call text-back in under 90 seconds',
    primaryVerticalPain:
      account.icpDescription?.trim() ||
      verticalString(VERTICAL_PAIN, verticalKey) ||
      verticalString(VERTICAL_PAIN, 'agency'),
    proofPoint: verticalString(VERTICAL_PROOF, verticalKey) || verticalString(VERTICAL_PROOF, 'agency'),
    bookingLink: account.bookingLink,
    icpDescription: account.icpDescription,
    valueProposition: account.valueProposition,
    icpSummary: account.icpSummary,
    autonomousOutreach,
    sdrEnabled,
  }
}

export function clientContextToPromptBlock(ctx: ClientAgentContext): string {
  const targetTitles = ctx.icpConfig.targetTitles?.length
    ? ctx.icpConfig.targetTitles.join(', ')
    : 'any'

  return [
    `Rep: ${ctx.agentName}, ${ctx.agentTitle} at ${ctx.businessName}`,
    `From: ${ctx.fromName} <${ctx.fromEmail}>`,
    ctx.signature?.trim() ? `Email signature: ${ctx.signature.trim()}` : null,
    `Vertical: ${ctx.vertical}`,
    `Voice: ${ctx.voiceTone}`,
    ctx.icpSummary?.trim() ? `ICP summary: ${ctx.icpSummary.trim()}` : null,
    `What we do: ${ctx.keyDifferentiator}`,
    `Primary pain: ${ctx.primaryVerticalPain}`,
    `Proof: ${ctx.proofPoint}`,
    ctx.bookingLink ? `Booking link: ${ctx.bookingLink}` : null,
    `Target titles: ${targetTitles}`,
    `Target cities: ${ctx.targetCities.join(', ') || 'any'}`,
    `Exclude domains: ${ctx.excludeDomains.join(', ') || 'none'}`,
    `Autonomous send: ${ctx.autonomousOutreach ? 'yes (copy goes to campaigns/sequences, not the review queue)' : 'review required in Message Drafter'}`,
  ]
    .filter(Boolean)
    .join('\n')
}
