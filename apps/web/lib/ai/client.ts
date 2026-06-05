// Shared Anthropic client wrapper.
//
// Every AI tool in this codebase goes through `callModel()`. It centralizes:
//   * API key sourcing (env.ANTHROPIC_API_KEY) and "no key → skip" semantics
//   * Soft timeouts (default 30s — extended for Opus adaptive thinking)
//   * Telemetry — every successful or failed call is recorded in
//     `ai_observations` as a `tool_called` row so the learning loop can see
//     what the brain has been doing
//   * JSON-mode response parsing with placeholder-preserving guards
//   * Model selection (env override → caller override → default)
//
// Tools never instantiate `Anthropic` directly; they call this module so the
// telemetry and fallback behavior are consistent everywhere.

import Anthropic from '@anthropic-ai/sdk'
import { env } from '@/lib/env'
import { db } from '@/lib/db/client'
import { aiObservations } from '@vantera/db'

const DEFAULT_MODEL = 'claude-opus-4-8'
const DEFAULT_MAX_TOKENS = 4096
// Opus 4.8 with adaptive thinking can take longer on complex reasoning passes;
// 30s gives it room without blocking the request path on simple tool calls.
const DEFAULT_TIMEOUT_MS = 30_000

export type CallModelArgs = {
  accountId: string
  /** Human-readable tool name (e.g. 'summarize-business-context'). Used in telemetry. */
  toolName: string
  system: string
  user: string
  /** Override the default model. */
  model?: string
  maxTokens?: number
  timeoutMs?: number
  /** Persist a row in ai_observations after the call. Default true. */
  recordObservation?: boolean
  /** Extra metadata for the observation payload. */
  metadata?: Record<string, unknown>
}

export type CallModelResult =
  | {
      ok: true
      text: string
      model: string
      latencyMs: number
      stopReason: string | null
      inputTokens: number
      outputTokens: number
      thinkingTokens: number
    }
  | {
      ok: false
      reason: 'no_api_key' | 'timeout' | 'api_error' | 'unknown'
      errorMessage?: string
      latencyMs?: number
    }

export async function callModel(args: CallModelArgs): Promise<CallModelResult> {
  const apiKey = env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey.length === 0) {
    await recordObservation(args, { ok: false, reason: 'no_api_key' })
    return { ok: false, reason: 'no_api_key' }
  }

  const model = args.model ?? DEFAULT_MODEL
  const maxTokens = args.maxTokens ?? DEFAULT_MAX_TOKENS
  const timeoutMs = args.timeoutMs ?? DEFAULT_TIMEOUT_MS

  const client = new Anthropic({ apiKey })
  const start = Date.now()

  try {
    // Cast params to the base param type to allow `thinking`, then narrow the
    // result to Message: the base-param overload returns `Message | Stream`, but
    // we never stream here, so assert Message for downstream field access.
    const response = (await withTimeout(
      client.messages.create({
        model,
        max_tokens: maxTokens,
        // Adaptive thinking: Opus 4.8 decides when and how long to reason.
        // Ignored by older models (they strip unknown params client-side).
        thinking: { type: 'adaptive' },
        system: args.system,
        messages: [{ role: 'user', content: args.user }],
      } as Parameters<typeof client.messages.create>[0]),
      timeoutMs,
    )) as Anthropic.Message

    const latencyMs = Date.now() - start
    const text = extractText(response)
    const thinkingTokens = extractThinkingTokens(response)
    const result: CallModelResult = {
      ok: true,
      text,
      model,
      latencyMs,
      stopReason: response.stop_reason ?? null,
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
      thinkingTokens,
    }

    await recordObservation(args, result)
    return result
  } catch (error) {
    const latencyMs = Date.now() - start
    const isTimeout = error instanceof Error && /timed out/i.test(error.message)
    const failure: CallModelResult = {
      ok: false,
      reason: isTimeout ? 'timeout' : 'api_error',
      errorMessage: error instanceof Error ? error.message : String(error),
      latencyMs,
    }
    await recordObservation(args, failure)
    return failure
  }
}

/**
 * Convenience wrapper for tools that expect strict JSON output. Strips code
 * fences, tolerates leading prose, and applies a typed parser.
 */
export function parseJsonResponse<T>(
  text: string,
  parser: (value: unknown) => T | null,
): T | null {
  if (!text) return null
  const trimmed = text.trim()

  // Try direct parse first.
  try {
    return parser(JSON.parse(trimmed))
  } catch {
    /* fall through */
  }

  // Pull the first {...} or [...] block out of the response. Models sometimes
  // wrap JSON in code fences or chatty preambles even when told not to.
  const blockStart = trimmed.search(/[{[]/)
  const blockEnd = Math.max(trimmed.lastIndexOf('}'), trimmed.lastIndexOf(']'))
  if (blockStart === -1 || blockEnd === -1 || blockEnd <= blockStart) return null

  const slice = trimmed.slice(blockStart, blockEnd + 1)
  try {
    return parser(JSON.parse(slice))
  } catch {
    return null
  }
}

export function isAiEnabled(): boolean {
  return Boolean(env.ANTHROPIC_API_KEY && env.ANTHROPIC_API_KEY.length > 0)
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

async function recordObservation(args: CallModelArgs, result: CallModelResult): Promise<void> {
  if (args.recordObservation === false) return

  try {
    await db.insert(aiObservations).values({
      accountId: args.accountId,
      kind: 'tool_called',
      payload: {
        tool: args.toolName,
        ok: result.ok,
        reason: result.ok ? null : result.reason,
        latencyMs: result.ok ? result.latencyMs : (result.latencyMs ?? null),
        inputTokens: result.ok ? result.inputTokens : null,
        outputTokens: result.ok ? result.outputTokens : null,
        thinkingTokens: result.ok ? result.thinkingTokens : null,
        model: result.ok ? result.model : null,
        errorMessage: result.ok ? null : (result.errorMessage ?? null),
        ...(args.metadata ?? {}),
      },
      outcome: result.ok ? 'success' : 'failure',
    })
  } catch {
    // Telemetry must never break the caller. Swallow.
  }
}

function extractText(response: Anthropic.Message): string {
  const block = response.content.find((c) => c.type === 'text')
  if (!block || block.type !== 'text') return ''
  return block.text
}

function extractThinkingTokens(response: Anthropic.Message): number {
  // Thinking blocks carry their own token count in the usage field when
  // the model actually used adaptive thinking for this call.
  const usage = response.usage as unknown as Record<string, unknown> | undefined
  const thinking = usage?.['thinking_tokens']
  return typeof thinking === 'number' ? thinking : 0
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Anthropic call timed out after ${ms}ms`)),
      ms,
    )
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
