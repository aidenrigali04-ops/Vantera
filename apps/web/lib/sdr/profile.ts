import { patchAccountRow } from '@/lib/onboarding/account-store'
import { db } from '@/lib/db/client'
import { accounts, sdrAgentConfigs } from '@vantera/db'
import { and, eq, isNull } from 'drizzle-orm'

export type SdrProfile = {
  fromEmail: string | null
  fromName: string | null
  agentTitle: string | null
  signature: string | null
  bookingLink: string | null
  voicePreference: string | null
  valueProposition: string | null
  icpDescription: string | null
  icpSummary: string | null
}

export type SdrProfilePatch = Partial<SdrProfile>

const EMPTY_PROFILE: SdrProfile = {
  fromEmail: null,
  fromName: null,
  agentTitle: null,
  signature: null,
  bookingLink: null,
  voicePreference: null,
  valueProposition: null,
  icpDescription: null,
  icpSummary: null,
}

export async function getSdrProfile(accountId: string): Promise<SdrProfile> {
  const [accountRows, configRows] = await Promise.all([
    db
      .select({
        bookingLink: accounts.bookingLink,
        voicePreference: accounts.voicePreference,
        valueProposition: accounts.valueProposition,
        icpDescription: accounts.icpDescription,
        icpSummary: accounts.icpSummary,
      })
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1),
    db
      .select({
        fromEmail: sdrAgentConfigs.fromEmail,
        fromName: sdrAgentConfigs.fromName,
        agentTitle: sdrAgentConfigs.agentTitle,
        signature: sdrAgentConfigs.signature,
      })
      .from(sdrAgentConfigs)
      .where(
        and(eq(sdrAgentConfigs.accountId, accountId), isNull(sdrAgentConfigs.deletedAt)),
      )
      .limit(1),
  ])

  return {
    ...EMPTY_PROFILE,
    ...(accountRows[0] ?? {}),
    ...(configRows[0] ?? {}),
  }
}

export async function patchSdrProfile(
  accountId: string,
  body: SdrProfilePatch,
): Promise<{ success: true } | { success: false; error: string }> {
  const accountPatch: Record<string, string | null> = {}
  if ('bookingLink' in body) accountPatch.booking_link = body.bookingLink ?? null
  if ('voicePreference' in body) accountPatch.voice_preference = body.voicePreference ?? null
  if ('valueProposition' in body) accountPatch.value_proposition = body.valueProposition ?? null
  if ('icpDescription' in body) accountPatch.icp_description = body.icpDescription ?? null
  if ('icpSummary' in body) accountPatch.icp_summary = body.icpSummary ?? null

  const configPatch: Partial<typeof sdrAgentConfigs.$inferInsert> = {}
  if ('fromEmail' in body) configPatch.fromEmail = body.fromEmail ?? ''
  if ('fromName' in body) configPatch.fromName = body.fromName ?? ''
  if ('agentTitle' in body) configPatch.agentTitle = body.agentTitle ?? ''
  if ('signature' in body) configPatch.signature = body.signature ?? null

  if (Object.keys(accountPatch).length === 0 && Object.keys(configPatch).length === 0) {
    return { success: false, error: 'No profile fields to update' }
  }

  if (Object.keys(configPatch).length > 0) {
    const [existing] = await db
      .select({ id: sdrAgentConfigs.id })
      .from(sdrAgentConfigs)
      .where(
        and(eq(sdrAgentConfigs.accountId, accountId), isNull(sdrAgentConfigs.deletedAt)),
      )
      .limit(1)

    if (!existing) {
      return {
        success: false,
        error: 'Deploy Prospect Scout first to save sender identity fields',
      }
    }

    await db
      .update(sdrAgentConfigs)
      .set({ ...configPatch, updatedAt: new Date() })
      .where(eq(sdrAgentConfigs.id, existing.id))
  }

  if (Object.keys(accountPatch).length > 0) {
    const result = await patchAccountRow(accountId, accountPatch)
    if (!result.ok) {
      return { success: false, error: result.message }
    }
  }

  return { success: true }
}
