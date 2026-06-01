import { env } from '@/lib/env'
import { Webhook } from 'svix'
import type { ResendWebhookEvent } from '@/lib/webhooks/resend/types'

export function verifyResendWebhook(payload: string, headers: Headers): ResendWebhookEvent {
  const secret = env.RESEND_WEBHOOK_SECRET
  if (!secret) {
    const host = headers.get('host') ?? ''
    if (!host.startsWith('localhost') && !host.startsWith('127.0.0.1')) {
      throw new Error('RESEND_WEBHOOK_SECRET is required outside localhost')
    }
    return JSON.parse(payload) as ResendWebhookEvent
  }

  const svixId = headers.get('svix-id')
  const svixTimestamp = headers.get('svix-timestamp')
  const svixSignature = headers.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    throw new Error('missing svix headers')
  }

  const wh = new Webhook(secret)
  return wh.verify(payload, {
    'svix-id': svixId,
    'svix-timestamp': svixTimestamp,
    'svix-signature': svixSignature,
  }) as ResendWebhookEvent
}
