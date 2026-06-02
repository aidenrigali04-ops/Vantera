import { db } from '@/lib/db/client'
import {
  validateGoHighLevelCredentials,
} from '@/lib/integrations/gohighlevel/client'
import { validateHubSpotToken } from '@/lib/integrations/hubspot/client'
import { validateSalesforceCredentials } from '@/lib/integrations/salesforce/client'
import type { CrmProvider } from '@/lib/integrations/types'
import { encryptCredentialValue } from '@/lib/integrations/credential-secrets'
import { integrationCredentials } from '@vantera/db'
import { and, eq } from 'drizzle-orm'

export async function connectCrmIntegration(
  accountId: string,
  provider: CrmProvider,
  input: Record<string, string>,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  let accessToken: string | null = null
  const metadata: Record<string, string> = {}
  let refreshToken: string | null = null

  if (provider === 'hubspot') {
    const token = input.accessToken?.trim()
    if (!token) return { ok: false, reason: 'HubSpot access token is required' }
    const valid = await validateHubSpotToken(token)
    if (!valid) return { ok: false, reason: 'Invalid HubSpot access token' }
    accessToken = token
  }

  if (provider === 'gohighlevel') {
    const token = input.accessToken?.trim()
    const locationId = input.locationId?.trim()
    if (!token || !locationId) {
      return { ok: false, reason: 'GoHighLevel API key and Location ID are required' }
    }
    const valid = await validateGoHighLevelCredentials(token, locationId)
    if (!valid) return { ok: false, reason: 'Invalid GoHighLevel credentials' }
    accessToken = token
    metadata.locationId = locationId
  }

  if (provider === 'salesforce') {
    const token = input.accessToken?.trim()
    const instanceUrl = input.instanceUrl?.trim()
    if (!token || !instanceUrl) {
      return { ok: false, reason: 'Salesforce access token and instance URL are required' }
    }
    const valid = await validateSalesforceCredentials(token, instanceUrl)
    if (!valid) return { ok: false, reason: 'Invalid Salesforce credentials' }
    accessToken = token
    metadata.instanceUrl = instanceUrl.startsWith('http')
      ? instanceUrl.replace(/\/+$/, '')
      : `https://${instanceUrl.replace(/\/+$/, '')}`
    if (input.refreshToken?.trim()) {
      refreshToken = input.refreshToken.trim()
    }
  }

  await db
    .insert(integrationCredentials)
    .values({
      accountId,
      provider,
      accessToken: encryptCredentialValue(accessToken),
      refreshToken: encryptCredentialValue(refreshToken),
      metadata,
      isNativeMode: false,
    })
    .onConflictDoUpdate({
      target: [integrationCredentials.accountId, integrationCredentials.provider],
      set: {
        accessToken: encryptCredentialValue(accessToken),
        refreshToken: encryptCredentialValue(refreshToken),
        metadata,
        isNativeMode: false,
        updatedAt: new Date(),
      },
    })

  return { ok: true }
}

export async function disconnectCrmIntegration(
  accountId: string,
  provider: CrmProvider,
): Promise<void> {
  await db
    .delete(integrationCredentials)
    .where(
      and(
        eq(integrationCredentials.accountId, accountId),
        eq(integrationCredentials.provider, provider),
      ),
    )
}
