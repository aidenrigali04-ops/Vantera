import { requireExtensionSession } from '@/lib/extension/linkedin/auth-request'
import {
  extensionJsonResponse,
  extensionOptionsResponse,
} from '@/lib/extension/linkedin/cors'
import { isAccountAutomaticOutreach } from '@/lib/sdr/outreach-automation-account'

export async function OPTIONS() {
  return extensionOptionsResponse()
}

export async function GET(request: Request) {
  const session = await requireExtensionSession(request)
  if (!session) {
    return extensionJsonResponse({ success: false, error: 'Connection code not recognized' }, { status: 401 })
  }

  const automatic = await isAccountAutomaticOutreach(session.accountId)
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? 'http://localhost:3000'

  return extensionJsonResponse({
    success: true,
    data: {
      apiBaseUrl: appUrl,
      outreachMode: automatic ? 'automatic' : 'manual',
      pacing: {
        dailyLimit: session.dailyLimit,
        dailySent: session.dailySent,
      },
    },
  })
}
