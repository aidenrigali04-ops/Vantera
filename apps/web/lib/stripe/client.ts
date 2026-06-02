import { env } from '@/lib/env'
import { decryptCredentialValue } from '@/lib/integrations/credential-secrets'
import { db } from '@/lib/db/client'
import { integrationCredentials } from '@vantera/db'
import { and, eq } from 'drizzle-orm'
import Stripe from 'stripe'

const API_VERSION = '2024-04-10' as const

export type StripeClientResult =
  | { ok: true; stripe: Stripe; mode: 'workspace' | 'platform' }
  | { ok: false; reason: string }

/** Stripe SDK for a workspace (connected account) or platform fallback env key. */
export async function getStripeForAccount(accountId: string): Promise<StripeClientResult> {
  const [row] = await db
    .select({
      accessToken: integrationCredentials.accessToken,
      metadata: integrationCredentials.metadata,
    })
    .from(integrationCredentials)
    .where(
      and(
        eq(integrationCredentials.accountId, accountId),
        eq(integrationCredentials.provider, 'stripe'),
      ),
    )
    .limit(1)

  const secret = decryptCredentialValue(row?.accessToken)
  if (secret) {
    return { ok: true, stripe: new Stripe(secret, { apiVersion: API_VERSION }), mode: 'workspace' }
  }

  if (env.STRIPE_SECRET_KEY) {
    return {
      ok: true,
      stripe: new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: API_VERSION }),
      mode: 'platform',
    }
  }

  return {
    ok: false,
    reason: 'Connect Stripe in Billing settings or set STRIPE_SECRET_KEY for development.',
  }
}
