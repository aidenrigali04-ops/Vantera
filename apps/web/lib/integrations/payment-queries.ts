import { env } from '@/lib/env'
import { db } from '@/lib/db/client'
import { integrationCredentials } from '@vantera/db'
import { and, eq } from 'drizzle-orm'

export type StripeConnectionStatus = {
  connected: boolean
  connectedAt?: string
  publishableKey?: string
  mode: 'workspace' | 'platform' | 'none'
}

export async function findStripeConnection(accountId: string): Promise<StripeConnectionStatus> {
  const [row] = await db
    .select({
      createdAt: integrationCredentials.createdAt,
      metadata: integrationCredentials.metadata,
      accessToken: integrationCredentials.accessToken,
    })
    .from(integrationCredentials)
    .where(
      and(
        eq(integrationCredentials.accountId, accountId),
        eq(integrationCredentials.provider, 'stripe'),
      ),
    )
    .limit(1)

  if (row?.accessToken) {
    const metadata = (row.metadata ?? {}) as Record<string, string>
    return {
      connected: true,
      connectedAt: row.createdAt.toISOString(),
      publishableKey: metadata.publishableKey,
      mode: 'workspace',
    }
  }

  if (env.STRIPE_SECRET_KEY) {
    return {
      connected: true,
      mode: 'platform',
      publishableKey: env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || undefined,
    }
  }

  return { connected: false, mode: 'none' }
}
