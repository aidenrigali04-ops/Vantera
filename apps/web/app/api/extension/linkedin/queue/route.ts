import { requireExtensionSession } from '@/lib/extension/linkedin/auth-request'
import {
  extensionJsonResponse,
  extensionOptionsResponse,
} from '@/lib/extension/linkedin/cors'
import { findExtensionLinkedInQueue } from '@/lib/extension/linkedin/queue'

export async function OPTIONS() {
  return extensionOptionsResponse()
}

export async function GET(request: Request) {
  const session = await requireExtensionSession(request)
  if (!session) {
    return extensionJsonResponse({ success: false, error: 'Connection code not recognized' }, { status: 401 })
  }

  const queue = await findExtensionLinkedInQueue(session.accountId, {
    dailyLimit: session.dailyLimit,
    dailySent: session.dailySent,
  })

  return extensionJsonResponse({ success: true, data: queue })
}
