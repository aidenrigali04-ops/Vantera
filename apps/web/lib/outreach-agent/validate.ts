import { isAccountAutomaticOutreach } from '@/lib/sdr/outreach-automation-account'
import type { LaunchOutreachAgentInput } from '@/lib/outreach-agent/types'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function normalizeLinkedCampaignIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const unique = new Set<string>()
  for (const value of raw) {
    if (typeof value !== 'string') continue
    const id = value.trim()
    if (!UUID_RE.test(id)) continue
    unique.add(id)
  }
  return [...unique]
}

export function validateLaunchOutreachAgentInput(
  input: LaunchOutreachAgentInput,
  options?: { automaticOutreach?: boolean },
): string | null {
  const agentName = input.agentName?.trim()
  if (!agentName) return 'Agent name is required'

  const linkedCampaignIds = normalizeLinkedCampaignIds(input.linkedCampaignIds)
  if (!options?.automaticOutreach && linkedCampaignIds.length === 0) {
    return 'Link at least one campaign to activate Outreach Agent (or enable Automatic on the Agents hub)'
  }

  return null
}

export async function validateLaunchOutreachAgentForAccount(
  accountId: string,
  input: LaunchOutreachAgentInput,
): Promise<string | null> {
  const automaticOutreach = await isAccountAutomaticOutreach(accountId)
  return validateLaunchOutreachAgentInput(input, { automaticOutreach })
}

export function validateUpdateOutreachAgentInput(
  input: {
    agentName?: string
    linkedCampaignIds?: unknown
  },
  options?: { automaticOutreach?: boolean },
): string | null {
  if (input.agentName !== undefined && !input.agentName.trim()) {
    return 'Agent name cannot be empty'
  }

  if (input.linkedCampaignIds !== undefined) {
    const ids = normalizeLinkedCampaignIds(input.linkedCampaignIds)
    if (!options?.automaticOutreach && ids.length === 0) {
      return 'Keep at least one linked campaign (not required in Automatic mode)'
    }
  }

  return null
}
