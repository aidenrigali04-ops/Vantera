export type ExtensionLinkedInQueueItem = {
  id: string
  source: 'campaign' | 'sdr_sequence'
  outreachMode: 'automatic' | 'manual'
  leadId: string
  leadName: string
  company: string | null
  linkedinUrl: string
  message: string
  scheduledAt: string
  campaignName: string | null
  campaignId: string | null
  stepIndex: number
}

export type ExtensionLinkedInQueueSnapshot = {
  updatedAt: string
  outreachMode: 'automatic' | 'manual'
  pacing: {
    dailyLimit: number
    dailySent: number
    canSend: boolean
  }
  items: ExtensionLinkedInQueueItem[]
}

export type ExtensionConnectionStatus = {
  connected: boolean
  hasToken: boolean
  tokenPrefix: string | null
  lastSeenAt: string | null
  dailyLimit: number
  dailySent: number
}
