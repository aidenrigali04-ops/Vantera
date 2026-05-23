// Workflow: bootstrap-business-context.
//
// Runs immediately after the owner completes onboarding (Step 6 → Done).
// Plants the seed memory that every other AI tool will read on subsequent
// calls. This is the moment the brain "wakes up" for this account.
//
// Steps:
//   1. Load live BusinessContext (everything captured during onboarding).
//   2. Run summarize-business-context → writes ai_memory['business_context'].
//   3. Run generate-signals → writes the first 0-5 intelligence_signals.
//
// Never throws — every step is best-effort. Returns a result object the
// caller can log. Designed to be safe to re-run (each tool is idempotent
// or upsert-based).

import { env } from '@/lib/env'
import { loadBusinessContext } from '../context'
import { generateSignals } from '../tools/generate-signals'
import { summarizeBusinessContext } from '../tools/summarize-business-context'

export type BootstrapResult = {
  ranAt: string
  contextSummary: { ok: boolean; reason?: string }
  signals: { ok: boolean; count?: number; reason?: string }
}

export async function bootstrapBusinessContext(
  accountId: string,
  ownerUserId: string,
): Promise<BootstrapResult> {
  const result: BootstrapResult = {
    ranAt: new Date().toISOString(),
    contextSummary: { ok: false },
    signals: { ok: false },
  }

  try {
    const ctx = await loadBusinessContext(
      accountId,
      ownerUserId,
      env.NEXT_PUBLIC_APP_URL,
      env.RESEND_API_KEY || null,
    )

    const summary = await summarizeBusinessContext(ctx)
    if (summary.ok) {
      result.contextSummary = { ok: true }
    } else {
      result.contextSummary = { ok: false, reason: summary.reason }
    }

    // Re-load context so signals can see the freshly written summary in
    // its prompt header. Cheap — same queries we just ran.
    const enrichedCtx = await loadBusinessContext(
      accountId,
      ownerUserId,
      env.NEXT_PUBLIC_APP_URL,
      env.RESEND_API_KEY || null,
    )

    const signals = await generateSignals(enrichedCtx)
    if (signals.ok) {
      result.signals = { ok: true, count: signals.signals.length }
    } else {
      result.signals = { ok: false, reason: signals.reason }
    }
  } catch (error) {
    // Any unhandled exception in the loader / DB → log and move on; the
    // caller's flow shouldn't fail because the AI brain couldn't bootstrap.
    const message = error instanceof Error ? error.message : 'unknown'
    if (!result.contextSummary.ok) result.contextSummary = { ok: false, reason: message }
    if (!result.signals.ok) result.signals = { ok: false, reason: message }
  }

  return result
}
