import { findLinkedinAccount } from '@/lib/linkedin/queries'
import type { ExtensionConnectionStatus } from '@/lib/extension/linkedin/types'

export async function getExtensionConnectionStatus(
  accountId: string,
  userId: string,
): Promise<ExtensionConnectionStatus> {
  const account = await findLinkedinAccount(accountId, userId)

  return {
    connected: Boolean(account?.extensionConnected),
    hasToken: Boolean(account?.extensionTokenHash && !account.extensionTokenRevokedAt),
    tokenPrefix: account?.extensionTokenPrefix ?? null,
    lastSeenAt: account?.extensionLastSeenAt?.toISOString() ?? null,
    dailyLimit: account?.dailyLimit ?? 50,
    dailySent: account?.dailySent ?? 0,
  }
}
