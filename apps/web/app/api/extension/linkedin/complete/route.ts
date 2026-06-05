import { requireExtensionSession } from '@/lib/extension/linkedin/auth-request'
import { completeExtensionLinkedInStep } from '@/lib/extension/linkedin/complete'
import {
  extensionJsonResponse,
  extensionOptionsResponse,
} from '@/lib/extension/linkedin/cors'

export async function OPTIONS() {
  return extensionOptionsResponse()
}

export async function POST(request: Request) {
  const session = await requireExtensionSession(request)
  if (!session) {
    return extensionJsonResponse({ success: false, error: 'Connection code not recognized' }, { status: 401 })
  }

  const body = (await request.json()) as {
    stepId?: string
    source?: 'campaign' | 'sdr_sequence'
  }

  if (!body.stepId || !body.source) {
    return extensionJsonResponse({ success: false, error: 'stepId and source required' }, { status: 400 })
  }

  const result = await completeExtensionLinkedInStep({
    session,
    stepId: body.stepId,
    source: body.source,
  })

  if (!result.ok) {
    const messages: Record<string, string> = {
      daily_limit_reached: 'You have reached today’s LinkedIn send limit',
      step_not_found: 'This message was not found',
      already_sent: 'Already marked as sent',
      step_not_ready: 'This message is not ready to send yet',
      'LinkedIn step not found': 'This message was not found',
      'Step already processed': 'Already marked as sent',
    }
    return extensionJsonResponse(
      { success: false, error: messages[result.reason] ?? result.reason },
      { status: 400 },
    )
  }

  return extensionJsonResponse({ success: true, data: result })
}
