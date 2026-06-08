'use client'

import { AgentAnalyticsPanel } from '@/components/agents/AgentAnalyticsPanel'
import { AgentCapabilityCard } from '@/components/agents/AgentCapabilityCard'
import { AgentConfigSection } from '@/components/agents/AgentConfigSection'
import {
  AgentFormField,
  agentInputClassName,
  agentTextareaClassName,
} from '@/components/agents/AgentFormField'
import { AgentWorkspaceLayout } from '@/components/agents/AgentWorkspaceLayout'
import { MessageDrafterCommandCenterClient } from '@/components/message-drafter/MessageDrafterCommandCenterClient'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { AGENT_DEFAULT_INSTRUCTIONS, AGENT_PAGE_COPY } from '@/lib/agents/default-instructions'
import type { MessageDrafterPayload } from '@/lib/message-drafter/types'
import { isAutomaticOutreachMode } from '@/lib/sdr/outreach-automation-mode'
import type { OutreachAutomationMode } from '@/lib/sdr/outreach-automation-mode'
import { cn } from '@/lib/utils'
import { Check, Mail, MessageCircle, PenLine, Shield } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

type Props = {
  initialPayload: MessageDrafterPayload
  outreachAutomationMode: OutreachAutomationMode
}

export function MessageDrafterAgentWorkspace({
  initialPayload,
  outreachAutomationMode,
}: Props) {
  const copy = AGENT_PAGE_COPY.message_drafter
  const automatic = isAutomaticOutreachMode(outreachAutomationMode)
  const { stats } = initialPayload

  const [agentName, setAgentName] = useState(copy.defaultName)
  const [agentDescription, setAgentDescription] = useState(copy.defaultDescription)
  const [instructions, setInstructions] = useState(AGENT_DEFAULT_INSTRUCTIONS.message_drafter)
  const [conversationStarters, setConversationStarters] = useState(
    'Draft a personalized cold email for the next lead in queue\nGenerate a 5-step sequence for a high-scoring HVAC owner\nReview and improve the last batch of drafted messages',
  )
  const [requireReview, setRequireReview] = useState(!automatic)
  const [linkedinManual, setLinkedinManual] = useState(true)

  const statusLabel = stats.emailPending + stats.linkedInPending > 0 ? 'Review needed' : 'Clear'
  const statusTone = stats.emailPending + stats.linkedInPending > 0 ? 'warning' : 'success'

  const configPanel = (
    <>
      <AgentConfigSection title="Agent Identity">
        <AgentFormField id="drafter-name" label="Name">
          <Input
            id="drafter-name"
            className={agentInputClassName}
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
          />
        </AgentFormField>
        <AgentFormField id="drafter-description" label="Description">
          <Input
            id="drafter-description"
            className={agentInputClassName}
            value={agentDescription}
            onChange={(e) => setAgentDescription(e.target.value)}
          />
        </AgentFormField>
      </AgentConfigSection>

      <AgentConfigSection title="Instructions System">
        <AgentFormField id="drafter-instructions" label="Instruction">
          <Textarea
            id="drafter-instructions"
            rows={7}
            className={cn(agentTextareaClassName, 'font-mono')}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
          />
        </AgentFormField>
        <AgentFormField id="drafter-starters" label="Conversation starters">
          <Textarea
            id="drafter-starters"
            rows={3}
            placeholder="One starter per line…"
            className={agentTextareaClassName}
            value={conversationStarters}
            onChange={(e) => setConversationStarters(e.target.value)}
          />
        </AgentFormField>
        <p className="text-[12px] text-[var(--text-secondary)]">
          Workspace outreach mode is{' '}
          <Link href="/admin/outreach/agents" className="font-medium text-[var(--accent)] hover:underline">
            {automatic ? 'Automatic' : 'Manual'}
          </Link>
          . Change it on the Agents hub Settings tab.
        </p>
      </AgentConfigSection>

      <AgentConfigSection title="Capabilities">
        <div className="space-y-3">
          <AgentCapabilityCard
            icon={Shield}
            title="Require review before send"
            description="Hold email and SMS drafts for approval when workspace mode is Manual."
            checked={requireReview}
            onCheckedChange={setRequireReview}
            disabled={automatic}
          />
          <AgentCapabilityCard
            icon={MessageCircle}
            title="LinkedIn manual sequence"
            description="Surface LinkedIn steps separately for copy-and-send via the add-on."
            checked={linkedinManual}
            onCheckedChange={setLinkedinManual}
            disabled
          />
          <AgentCapabilityCard
            icon={PenLine}
            title="Personalized copy generation"
            description="Draft using lead context, company signals, and sequence goals."
            checked
            onCheckedChange={() => {}}
            disabled
          />
        </div>
      </AgentConfigSection>
    </>
  )

  const analyticsPanel = (
    <AgentAnalyticsPanel
      kpis={[
        { label: 'Email & SMS pending', value: stats.emailPending },
        { label: 'LinkedIn waiting', value: stats.linkedInPending },
        { label: 'Sent this week', value: stats.sentThisWeek },
        { label: 'Total queue', value: stats.emailPending + stats.linkedInPending },
      ]}
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/40 p-4">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--text-primary)]">
            <Mail className="h-4 w-4 text-[var(--text-secondary)]" aria-hidden />
            Email & SMS pipeline
          </div>
          <p className="mt-2 text-[24px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
            {stats.emailPending}
          </p>
          <p className="mt-1 text-[12px] text-[var(--text-secondary)]">drafts awaiting review</p>
        </div>
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/40 p-4">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--text-primary)]">
            <MessageCircle className="h-4 w-4 text-[var(--accent)]" aria-hidden />
            LinkedIn manual queue
          </div>
          <p className="mt-2 text-[24px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
            {stats.linkedInPending}
          </p>
          <p className="mt-1 text-[12px] text-[var(--text-secondary)]">steps ready to send</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-[var(--success-muted)] bg-[var(--success-muted)]/40 px-4 py-3 text-[12px] text-[var(--text-secondary)]">
          <Check className="h-4 w-4 text-[var(--success)]" aria-hidden />
          {stats.sentThisWeek} messages approved and sent this week
        </div>
      </div>
    </AgentAnalyticsPanel>
  )

  return (
    <AgentWorkspaceLayout
      title={copy.title}
      subtitle={copy.subtitle}
      statusLabel={statusLabel}
      statusTone={statusTone}
      config={configPanel}
      analytics={analyticsPanel}
      footer={
        <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-[var(--shadow-sm)]">
          <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
            Review queue
          </h2>
          <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
            Approve, edit, or discard drafts before they go out.
          </p>
          <div className="mt-4">
            <MessageDrafterCommandCenterClient initialPayload={initialPayload} embedded />
          </div>
        </section>
      }
    />
  )
}
