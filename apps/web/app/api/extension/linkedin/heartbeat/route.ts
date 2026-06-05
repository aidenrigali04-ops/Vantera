import { recordExtensionHeartbeat } from '@/lib/linkedin/accounts'
import { requireExtensionSession } from '@/lib/extension/linkedin/auth-request'
import {
  extensionJsonResponse,
  extensionOptionsResponse,
} from '@/lib/extension/linkedin/cors'
import { getExtensionConnectionStatus } from '@/lib/extension/linkedin/status'

export async function OPTIONS() {
  return extensionOptionsResponse()
}

export async function POST(request: Request) {
  const session = await requireExtensionSession(request)
  if (!session) {
    return extensionJsonResponse({ success: false, error: 'Connection code not recognized' }, { status: 401 })
  }

  await recordExtensionHeartbeat(session.linkedinAccountId)

  const status = await getExtensionConnectionStatus(session.accountId, session.userId)

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? 'http://localhost:3000'

  return extensionJsonResponse({
    success: true,
    data: {
      ...status,
      apiBaseUrl: appUrl,
      accountId: session.accountId,
    },
  })
}
