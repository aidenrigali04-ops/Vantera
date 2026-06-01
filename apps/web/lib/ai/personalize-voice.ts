// AI-driven voice rewrite for template messages.
//
// Sits between the sync `personalizeTemplate` pass and the database insert in
// `applyVerticalTemplate`. After substitution + channel reconciliation runs,
// this module:
//
//   1. Collects every action body that has a non-empty `templateBody`.
//   2. Sends them as a single batched Anthropic request — one prompt per
//      template apply, not one per message — and asks the model to rewrite
//      each in the requested voice while preserving `{{placeholders}}`.
//   3. Returns a personalized template with the rewritten bodies swapped in.
//
// Failure modes are non-fatal: if the Anthropic key is missing, if the call
// fails, or if the response shape is unexpected, we return the unmodified
// template. The caller's user-visible flow always succeeds.

import Anthropic from '@anthropic-ai/sdk'
import { env } from '@/lib/env'
import type {
  OnboardingProfile,
  VerticalTemplateData,
  VoiceTone,
} from '@vantera/db'

const MODEL = 'claude-3-5-sonnet-latest'
const MAX_TOKENS = 4096
const SOFT_TIMEOUT_MS = 12_000

// Hard floor on body length — bodies shorter than this are usually subjects or
// link-only blurbs that don't benefit from voice rewriting and waste tokens.
const MIN_BODY_LENGTH_FOR_REWRITE = 16

type PendingRewrite = {
  // Index path into the template's action list so we can write the rewrite
  // back into the same slot without rebuilding the whole structure.
  automationIndex: number
  actionIndex: number
  field: 'templateBody'
  original: string
}

export type VoiceRewriteOutcome = {
  /** Total candidate bodies considered for rewriting. */
  considered: number
  /** Total bodies actually returned by the model and applied. */
  applied: number
  /** True if AI rewriting was skipped (no key / no voice / no bodies). */
  skipped: boolean
  /** Populated when an error caused us to fall back to the original template. */
  errorMessage?: string
}

export async function personalizeVoiceWithAI(
  template: VerticalTemplateData,
  profile: OnboardingProfile,
): Promise<{ template: VerticalTemplateData; outcome: VoiceRewriteOutcome }> {
  const apiKey = env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey.length === 0) {
    return { template, outcome: { considered: 0, applied: 0, skipped: true } }
  }
  if (!profile.voice) {
    return { template, outcome: { considered: 0, applied: 0, skipped: true } }
  }

  const pending = collectPendingRewrites(template)
  if (pending.length === 0) {
    return { template, outcome: { considered: 0, applied: 0, skipped: true } }
  }

  try {
    const rewrites = await requestRewrites({
      apiKey,
      voice: profile.voice,
      profile,
      pending,
    })

    if (rewrites.size === 0) {
      return {
        template,
        outcome: {
          considered: pending.length,
          applied: 0,
          skipped: false,
          errorMessage: 'Model returned no usable rewrites',
        },
      }
    }

    const rewritten = applyRewrites(template, pending, rewrites)
    return {
      template: rewritten,
      outcome: { considered: pending.length, applied: rewrites.size, skipped: false },
    }
  } catch (error) {
    return {
      template,
      outcome: {
        considered: pending.length,
        applied: 0,
        skipped: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown AI rewrite failure',
      },
    }
  }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function collectPendingRewrites(template: VerticalTemplateData): PendingRewrite[] {
  const pending: PendingRewrite[] = []
  const automations = template.automations ?? []

  for (let aIdx = 0; aIdx < automations.length; aIdx += 1) {
    const actions = automations[aIdx]?.actions ?? []
    for (let actIdx = 0; actIdx < actions.length; actIdx += 1) {
      const body = actions[actIdx]?.templateBody
      if (typeof body !== 'string') continue
      const trimmed = body.trim()
      if (trimmed.length < MIN_BODY_LENGTH_FOR_REWRITE) continue
      pending.push({
        automationIndex: aIdx,
        actionIndex: actIdx,
        field: 'templateBody',
        original: body,
      })
    }
  }

  return pending
}

async function requestRewrites(args: {
  apiKey: string
  voice: VoiceTone
  profile: OnboardingProfile
  pending: PendingRewrite[]
}): Promise<Map<string, string>> {
  const client = new Anthropic({ apiKey: args.apiKey })

  const payload = args.pending.map((p, idx) => ({ id: String(idx), body: p.original }))

  const systemPrompt = [
    'You rewrite short sales message templates in a specific tone of voice.',
    'You must:',
    '  - Preserve every {{placeholder}} EXACTLY as written. Do not invent new placeholders.',
    '  - Keep each message concise — never longer than 1.4× the original length.',
    '  - Preserve the original intent (confirmation, follow-up, payment request, etc.).',
    '  - Keep SMS-appropriate bodies SMS-length (under 320 characters).',
    '  - Match the tone requested in the user message.',
    '',
    'Return ONLY a JSON array of the form:',
    '  [{"id": "0", "body": "..."}, {"id": "1", "body": "..."}]',
    'No prose, no markdown, no code fences. JSON only.',
  ].join('\n')

  const userPrompt = [
    `Voice: ${args.voice}`,
    `Business: ${args.profile.businessName}`,
    args.profile.ownerFullName ? `Owner: ${args.profile.ownerFullName}` : null,
    `Timezone: ${args.profile.timezone}`,
    '',
    'Rewrite each message in the voice above. Return the JSON array described in the system prompt.',
    '',
    'Messages:',
    JSON.stringify(payload, null, 2),
  ]
    .filter((line): line is string => typeof line === 'string')
    .join('\n')

  const response = await withTimeout(
    client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
    SOFT_TIMEOUT_MS,
  )

  const text = extractText(response)
  return parseRewriteResponse(text)
}

function extractText(response: Anthropic.Message): string {
  const block = response.content.find((c) => c.type === 'text')
  if (!block || block.type !== 'text') return ''
  return block.text
}

function parseRewriteResponse(text: string): Map<string, string> {
  const out = new Map<string, string>()
  if (!text) return out

  // The model is asked for raw JSON but sometimes wraps it in a code fence
  // or adds a leading sentence. Be tolerant.
  const trimmed = text.trim()
  const jsonStart = trimmed.indexOf('[')
  const jsonEnd = trimmed.lastIndexOf(']')
  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) return out

  const slice = trimmed.slice(jsonStart, jsonEnd + 1)
  let parsed: unknown
  try {
    parsed = JSON.parse(slice)
  } catch {
    return out
  }
  if (!Array.isArray(parsed)) return out

  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue
    const id = (item as { id?: unknown }).id
    const body = (item as { body?: unknown }).body
    if (typeof id === 'string' && typeof body === 'string' && body.length > 0) {
      out.set(id, body)
    }
  }
  return out
}

function applyRewrites(
  template: VerticalTemplateData,
  pending: PendingRewrite[],
  rewrites: Map<string, string>,
): VerticalTemplateData {
  // Deep-copy only what we're mutating so the result is safe to insert
  // without aliasing back to the input object graph.
  const nextAutomations = (template.automations ?? []).map((automation) => ({
    ...automation,
    actions: (automation.actions ?? []).map((action) => ({ ...action })),
  }))

  for (let idx = 0; idx < pending.length; idx += 1) {
    const item = pending[idx]
    if (!item) continue
    const rewrite = rewrites.get(String(idx))
    if (!rewrite) continue

    // Sanity guard: make sure the rewrite preserves every {{placeholder}} that
    // was in the original. If a placeholder is missing, treat as failed and
    // keep the original body — better to ship a working message than a
    // creative one that drops {{payment_link}}.
    if (!preservesPlaceholders(item.original, rewrite)) continue

    const automation = nextAutomations[item.automationIndex]
    if (!automation) continue
    const action = automation.actions?.[item.actionIndex]
    if (!action) continue
    action[item.field] = rewrite
  }

  return { ...template, automations: nextAutomations }
}

function preservesPlaceholders(original: string, rewrite: string): boolean {
  const re = /\{\{[a-z0-9_.]+\}\}/gi
  const originalPlaceholders = original.match(re) ?? []
  for (const placeholder of originalPlaceholders) {
    if (!rewrite.includes(placeholder)) return false
  }
  return true
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`AI voice rewrite timed out after ${ms}ms`)), ms)
    promise
      .then((value) => {
        clearTimeout(timer)
        resolve(value)
      })
      .catch((reason) => {
        clearTimeout(timer)
        reject(reason)
      })
  })
}
