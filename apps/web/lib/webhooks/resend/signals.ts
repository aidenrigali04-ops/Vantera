import { db } from '@/lib/db/client'
import { intelligenceSignals } from '@vantera/db'

type CreateSignalInput = {
  accountId: string
  signalType: string
  severity: 'red' | 'yellow' | 'green'
  headline: string
  recommendation?: string
  actionLabel?: string
  actionPayload?: Record<string, unknown>
  contactId?: string | null
  recordId?: string | null
  expiresInDays?: number
}

export async function createIntelligenceSignal(input: CreateSignalInput): Promise<void> {
  const expiresAt = input.expiresInDays
    ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
    : null

  await db.insert(intelligenceSignals).values({
    accountId: input.accountId,
    contactId: input.contactId ?? null,
    recordId: input.recordId ?? null,
    signalType: input.signalType,
    severity: input.severity,
    headline: input.headline.slice(0, 255),
    recommendation: input.recommendation,
    actionLabel: input.actionLabel,
    actionPayload: input.actionPayload ?? {},
    confidenceScore: 85,
    expiresAt,
  })
}
