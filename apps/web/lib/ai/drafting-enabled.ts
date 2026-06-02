import { env } from '@/lib/env'
import { evaluateFlag } from '@/lib/feature-flags/evaluate'
import type { Plan } from '@/lib/feature-flags/flags'

export function hasAnthropicConfigured(): boolean {
  return Boolean(env.ANTHROPIC_API_KEY?.trim())
}

/** AI copy generation runs when Anthropic is configured or the plan flag allows it. */
export async function isAiMessageDraftingEnabled(
  accountId: string,
  plan: Plan,
): Promise<boolean> {
  if (hasAnthropicConfigured()) return true
  return evaluateFlag({ accountId, plan, flagName: 'ai_message_drafting' })
}
