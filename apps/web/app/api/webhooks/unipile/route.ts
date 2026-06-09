import { handleUnipileWebhook } from '@/lib/integrations/unipile/webhook'
import type { UnipileWebhookEvent } from '@/lib/integrations/unipile/types'
import { NextResponse, type NextRequest } from 'next/server'
import { createHmac } from 'crypto'

function verifySignature(body: string, signature: string | null, secret: string): boolean {
  if (!signature || !secret) return !secret // skip verification if no secret configured
  const expected = createHmac('sha256', secret).update(body).digest('hex')
  return signature === expected || signature === `sha256=${expected}`
}

export async function POST(req: NextRequest) {
  const secret = process.env.UNIPILE_WEBHOOK_SECRET ?? ''
  const rawBody = await req.text()
  const signature = req.headers.get('x-unipile-signature')

  if (!verifySignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let event: UnipileWebhookEvent
  try {
    event = JSON.parse(rawBody) as UnipileWebhookEvent
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  await handleUnipileWebhook(event).catch((err) => {
    console.error('[unipile webhook]', event.type, err)
  })

  return NextResponse.json({ received: true })
}
