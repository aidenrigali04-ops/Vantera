import { callModel, parseJsonResponse } from '@/lib/ai/client'
import type { ICPConfig } from '@/lib/aspire/types'
import { fetchSdrSegmentMemory } from '@/lib/sdr/memory'
import { scheduleSequenceSteps } from '@/lib/sdr/schedule'
import type { SDRDraftPayload, SDRSequenceStep, SdrOutreachWindow } from '@/lib/sdr/types'
import { DEFAULT_OUTREACH_WINDOW } from '@/lib/sdr/types'

const SEQUENCE_SYSTEM = `You write multi-step outbound sequences for a human sales rep.
The rep is NOT automated software. Never mention AI, bots, or automation.
Voice: peer-to-peer, direct, specific. Every message references the lead's situation.

Return ONLY valid JSON:
{
  "steps": [
    { "stepNumber": 1, "channel": "email", "subject": "...", "body": "...", "dayOffset": 0 },
    { "stepNumber": 2, "channel": "sms", "subject": null, "body": "...", "dayOffset": 2 },
    { "stepNumber": 3, "channel": "email", "subject": "...", "body": "...", "dayOffset": 4 },
    { "stepNumber": 4, "channel": "email", "subject": "...", "body": "...", "dayOffset": 8 },
    { "stepNumber": 5, "channel": "email", "subject": "...", "body": "...", "dayOffset": 14 }
  ]
}

Constraints:
- Email step 1: under 100 words, no generic openers, ends with one low-friction question
- SMS step 2: under 140 chars, curiosity only, must end "Reply STOP to opt out"
- Email step 3: vertical case study with a specific number, before/after
- Email step 4: name and disarm the top objection for this vertical
- Email step 5: breakup frame, under 60 words`

function buildDraftPayload(input: {
  accountId: string
  agentName: string
  accountDisplayName: string
  vertical: string
  firstName: string
  lastName: string
  title: string
  company: string
  employeeCount: number | null
  icpScore: number
  icpSignals: string[]
  memoryContext: string
}): SDRDraftPayload {
  return input
}

export async function generateSdrSequenceSteps(input: {
  accountId: string
  agentName: string
  accountDisplayName: string
  vertical: string
  firstName: string
  lastName: string
  title: string
  company: string
  employeeCount: number | null
  icpScore: number
  icpSignals: string[]
  icpConfig: ICPConfig
  outreachDays?: string[]
  outreachWindow?: SdrOutreachWindow
}): Promise<{ steps: SDRSequenceStep[]; scheduledFor: Date[] }> {
  const memoryContext = await fetchSdrSegmentMemory(
    input.accountId,
    input.vertical,
    input.employeeCount,
  )

  const payload = buildDraftPayload({ ...input, memoryContext })

  const userPrompt = [
    `Rep name: ${payload.agentName}`,
    `Business: ${payload.accountDisplayName}`,
    `Vertical: ${payload.vertical}`,
    `Lead: ${payload.firstName} ${payload.lastName}, ${payload.title} at ${payload.company}`,
    payload.employeeCount ? `Company size: ${payload.employeeCount} employees` : null,
    `ICP score: ${payload.icpScore}`,
    payload.icpSignals.length ? `ICP signals: ${payload.icpSignals.slice(0, 5).join(', ')}` : null,
    memoryContext ? `What worked before:\n${memoryContext}` : null,
    `Target titles: ${input.icpConfig.targetTitles.join(', ')}`,
  ]
    .filter(Boolean)
    .join('\n')

  const result = await callModel({
    accountId: input.accountId,
    toolName: 'draft-sdr-sequence',
    system: SEQUENCE_SYSTEM.replace('[agent_name]', input.agentName),
    user: userPrompt,
    maxTokens: 2000,
    timeoutMs: 60_000,
  })

  if (!result.ok) {
    throw new Error('Sequence generation failed')
  }

  const parsed = parseJsonResponse<{ steps: SDRSequenceStep[] }>(result.text, (raw) => {
    if (!raw || typeof raw !== 'object') return null
    const r = raw as Record<string, unknown>
    if (!Array.isArray(r.steps) || r.steps.length < 5) return null
    const steps = r.steps as SDRSequenceStep[]
    if (!steps.every((s) => s.body && s.channel && typeof s.dayOffset === 'number')) return null
    return { steps: steps.slice(0, 5) }
  })

  if (!parsed) {
    throw new Error('Invalid sequence JSON from model')
  }

  const scheduledFor = scheduleSequenceSteps(
    parsed.steps,
    input.outreachDays ?? ['mon', 'tue', 'wed', 'thu', 'fri'],
    input.outreachWindow ?? DEFAULT_OUTREACH_WINDOW,
  )

  return { steps: parsed.steps, scheduledFor }
}
