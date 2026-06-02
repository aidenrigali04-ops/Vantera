export type EmailDraftItem = {
  id: string
  channel: 'email' | 'sms'
  subject: string | null
  body: string
  draftedBy: string
  createdAt: Date
  lead: {
    id: string
    firstName: string | null
    lastName: string | null
    company: string
    email: string | null
    phone: string | null
  }
  metadata: Record<string, unknown>
}

export type LinkedInDraftItem = {
  id: string
  source: 'campaign' | 'sdr_sequence'
  stepIndex: number
  body: string
  scheduledFor: Date
  campaignName: string | null
  lead: {
    id: string
    firstName: string | null
    lastName: string | null
    company: string
    linkedinUrl: string | null
  }
}

export type MessageDrafterStats = {
  emailPending: number
  linkedInPending: number
  sentThisWeek: number
}

export type MessageDrafterPayload = {
  emailDrafts: EmailDraftItem[]
  linkedInDrafts: LinkedInDraftItem[]
  stats: MessageDrafterStats
}
