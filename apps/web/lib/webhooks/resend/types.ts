export type ResendWebhookEvent = {
  type: string
  created_at?: string
  data: ResendWebhookEventData
}

export type ResendWebhookEventData = {
  email_id?: string
  from?: string
  to?: string[]
  subject?: string
  message_id?: string
  click?: { link?: string }
  bounce?: { message?: string }
}

export type ResendHandlerResult = {
  handled: boolean
  detail?: string
}
