import { db } from '@/lib/db/client'
import {
  clientContextToPromptBlock,
  resolveClientContext,
} from '@/lib/sdr/resolve-client-context'
import { accounts } from '@vantera/db'
import { eq } from 'drizzle-orm'
import { readFile } from 'fs/promises'
import { join } from 'path'

/** Matches `lib/agents/sdr-agents.ts` agent ids. */
export type AgentPromptId =
  | 'prospect_scout'
  | 'outreach_agent'
  | 'message_drafter'
  | 'pipeline_analyst'

const AGENT_CONTENT_DIR = join(process.cwd(), 'content', 'agents')

const TOOL_TO_AGENT: Record<string, AgentPromptId> = {
  'draft-sdr-sequence': 'message_drafter',
  'draft-outreach-email': 'message_drafter',
  'draft-outreach-sms': 'message_drafter',
  'draft-campaign-step': 'message_drafter',
  'draft-on-enroll': 'message_drafter',
}

export function agentIdForTool(toolName: string): AgentPromptId {
  return TOOL_TO_AGENT[toolName] ?? 'message_drafter'
}

async function loadAccountName(accountId: string): Promise<string> {
  const [row] = await db
    .select({ name: accounts.name })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1)
  return row?.name ?? 'Vantera workspace'
}

async function readAgentFile(filename: string): Promise<string | null> {
  try {
    const raw = await readFile(join(AGENT_CONTENT_DIR, filename), 'utf-8')
    const trimmed = raw.trim()
    return trimmed.length > 0 ? trimmed : null
  } catch {
    return null
  }
}

export type AssembleAgentPromptInput = {
  accountId: string
  agentId: AgentPromptId
  /** Task-specific instructions (JSON shape, channel rules, etc.) */
  taskInstructions: string
  /** Optional per-call context (lead, rep name, sequence rules) */
  callContext?: string
  /** Extra client-specific notes (e.g. from DB later) */
  clientOverride?: string | null
}

export type AssembledAgentPrompt = {
  system: string
  user: string
  agentId: AgentPromptId
  usedBaseFile: boolean
  usedAgentFile: boolean
}

/**
 * Builds system + user prompts for outreach agents:
 * 1. `content/agents/_base.md` — shared voice/rules
 * 2. `content/agents/{agentId}.md` — agent-specific playbook
 * 3. Live business context from DB (per client / account)
 * 4. Task instructions + per-call context
 */
export async function assembleAgentPrompt(
  input: AssembleAgentPromptInput,
): Promise<AssembledAgentPrompt> {
  const [baseFile, agentFile, accountName, clientCtx] = await Promise.all([
    readAgentFile('_base.md'),
    readAgentFile(`${input.agentId}.md`),
    loadAccountName(input.accountId),
    resolveClientContext(input.accountId),
  ])

  const clientBlock = clientCtx ? clientContextToPromptBlock(clientCtx) : null

  const systemParts = [
    baseFile ? `## Base context\n${baseFile}` : null,
    agentFile ? `## Agent: ${input.agentId}\n${agentFile}` : null,
    `## Workspace\nAccount: ${accountName}`,
    clientBlock ? `## SDR agent (this account)\n${clientBlock}` : null,
    input.clientOverride?.trim() ? `## Client notes\n${input.clientOverride.trim()}` : null,
    `## Task\n${input.taskInstructions.trim()}`,
  ].filter(Boolean)

  const userParts = [input.callContext?.trim()].filter(Boolean)

  return {
    system: systemParts.join('\n\n'),
    user: userParts.length > 0 ? userParts.join('\n\n') : 'See task and client context above.',
    agentId: input.agentId,
    usedBaseFile: Boolean(baseFile),
    usedAgentFile: Boolean(agentFile),
  }
}
