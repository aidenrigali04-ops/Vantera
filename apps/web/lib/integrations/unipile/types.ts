export type UnipileProvider = 'LINKEDIN'

export type UnipileAccountStatus = 'OK' | 'CREDENTIALS' | 'DISCONNECTED' | 'CONNECTING'

export type UnipileAccount = {
  id: string
  name: string
  type: UnipileProvider
  connection_status: UnipileAccountStatus
  created_at: string
}

export type UnipileHostedAuthResponse = {
  object: 'HostedAuth'
  url: string
  /** The Unipile user object_id — store to match the account after auth completes. */
  object_id: string
}

export type UnipileSendConnectionResponse = {
  object: 'LinkedInInvitationSent' | 'Error'
  id?: string
  error?: string
}

export type UnipileSendMessageResponse = {
  object: 'Message' | 'Error'
  id?: string
  error?: string
}

export type UnipileWebhookEvent = {
  type:
    | 'account_connected'
    | 'account_disconnected'
    | 'new_message'
    | 'invitation_accepted'
  account_id: string
  data: Record<string, unknown>
}

export type UnipileNewMessageEvent = UnipileWebhookEvent & {
  type: 'new_message'
  data: {
    id: string
    chat_id: string
    sender_id: string
    sender_name: string
    text: string
    timestamp: string
    is_outbound: boolean
    attachments?: Array<{ type: string; url: string }>
  }
}

export type UnipileAccountConnectedEvent = UnipileWebhookEvent & {
  type: 'account_connected'
  data: {
    account_id: string
    provider: UnipileProvider
    provider_id: string
  }
}
