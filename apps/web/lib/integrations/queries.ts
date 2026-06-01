import { db } from '@/lib/db/client'
import type { CrmConnectionStatus, CrmProvider } from '@/lib/integrations/types'
import { CRM_PROVIDERS } from '@/lib/integrations/types'
import { integrationCredentials } from '@vantera/db'
import { and, eq } from 'drizzle-orm'

export async function findCrmConnections(accountId: string): Promise<CrmConnectionStatus[]> {
  const rows = await db
    .select({
      provider: integrationCredentials.provider,
      metadata: integrationCredentials.metadata,
      createdAt: integrationCredentials.createdAt,
    })
    .from(integrationCredentials)
    .where(eq(integrationCredentials.accountId, accountId))

  const byProvider = new Map(rows.map((row) => [row.provider, row]))

  return CRM_PROVIDERS.map((provider) => {
    const row = byProvider.get(provider)
    if (!row) {
      return { provider, connected: false }
    }

    const metadata = (row.metadata ?? {}) as Record<string, string>
    const publicMetadata: Record<string, string> = {}
    if (metadata.locationId) publicMetadata.locationId = metadata.locationId
    if (metadata.instanceUrl) publicMetadata.instanceUrl = metadata.instanceUrl

    return {
      provider,
      connected: true,
      connectedAt: row.createdAt.toISOString(),
      metadata: publicMetadata,
    }
  })
}

export async function findCrmCredential(accountId: string, provider: CrmProvider) {
  const [row] = await db
    .select()
    .from(integrationCredentials)
    .where(
      and(
        eq(integrationCredentials.accountId, accountId),
        eq(integrationCredentials.provider, provider),
      ),
    )
    .limit(1)

  return row ?? null
}
