import { db } from '@/lib/db/client'
import { encryptCredentialValue } from '@/lib/integrations/credential-secrets'
import { validateStripeSecretKey } from '@/lib/stripe/validate'
import { integrationCredentials } from '@vantera/db'
import { and, eq } from 'drizzle-orm'

export async function connectStripe(
  accountId: string,
  input: { secretKey: string; publishableKey?: string },
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const secretKey = input.secretKey.trim()
  const publishableKey = input.publishableKey?.trim()

  if (!secretKey.startsWith('sk_')) {
    return { ok: false, reason: 'Stripe secret key must start with sk_' }
  }

  const valid = await validateStripeSecretKey(secretKey)
  if (!valid) {
    return { ok: false, reason: 'Invalid Stripe secret key — check the Dashboard → Developers → API keys.' }
  }

  const metadata: Record<string, string> = {}
  if (publishableKey) {
    metadata.publishableKey = publishableKey
  }

  await db
    .insert(integrationCredentials)
    .values({
      accountId,
      provider: 'stripe',
      accessToken: encryptCredentialValue(secretKey),
      metadata,
      isNativeMode: false,
    })
    .onConflictDoUpdate({
      target: [integrationCredentials.accountId, integrationCredentials.provider],
      set: {
        accessToken: encryptCredentialValue(secretKey),
        metadata,
        isNativeMode: false,
        updatedAt: new Date(),
      },
    })

  return { ok: true }
}

export async function disconnectStripe(accountId: string): Promise<void> {
  await db
    .delete(integrationCredentials)
    .where(
      and(
        eq(integrationCredentials.accountId, accountId),
        eq(integrationCredentials.provider, 'stripe'),
      ),
    )
}
