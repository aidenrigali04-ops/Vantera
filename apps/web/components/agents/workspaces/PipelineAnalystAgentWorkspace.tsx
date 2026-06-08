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
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { AGENT_DEFAULT_INSTRUCTIONS, AGENT_PAGE_COPY } from '@/lib/agents/default-instructions'
import type { SdrAgentSnapshot } from '@/lib/agents/types'
import { cn } from '@/lib/utils'
import { Activity, Brain, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

type Props = {
  snapshot: SdrAgentSnapshot
}

export function PipelineAnalystAgentWorkspace({ snapshot }: Props) {
  const copy = AGENT_PAGE_COPY.pipeline_analyst

  const [agentName, setAgentName] = useState(copy.defaultName)
  const [agentDescription, setAgentDescription] = useState(copy.defaultDescription)
  const [instructions, setInstructions] = useState(AGENT_DEFAULT_INSTRUCTIONS.pipeline_analyst)
  const [conversationStarters, setConversationStarters] = useState(
    'Show me the top 10 highest-intent leads right now\nWhich sequences have the best reply rates this month?\nFlag leads that haven\'t moved in 7 days',
  )
  const [dailyScoring, setDailyScoring] = useState(true)
  const [engagementSignals, setEngagementSignals] = useState(true)

  const configPanel = (
    <>
      <AgentConfigSection title="Agent Identity">
        <AgentFormField id="analyst-name" label="Name">
          <Input
            id="analyst-name"
            className={agentInputClassName}
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
          />
        </AgentFormField>
        <AgentFormField id="analyst-description" label="Description">
          <Input
            id="analyst-description"
            className={agentInputClassName}
            value={agentDescription}
            onChange={(e) => setAgentDescription(e.target.value)}
          />
        </AgentFormField>
      </AgentConfigSection>

      <AgentConfigSection title="Instructions System">
        <AgentFormField id="analyst-instructions" label="Instruction">
          <Textarea
            id="analyst-instructions"
            rows={7}
            className={cn(agentTextareaClassName, 'font-mono')}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
          />
        </AgentFormField>
        <AgentFormField id="analyst-starters" label="Conversation starters">
          <Textarea
            id="analyst-starters"
            rows={3}
            placeholder="One starter per line…"
            className={agentTextareaClassName}
            value={conversationStarters}
            onChange={(e) => setConversationStarters(e.target.value)}
          />
        </AgentFormField>
      </AgentConfigSection>

      <AgentConfigSection title="Capabilities">
        <div className="space-y-3">
          <AgentCapabilityCard
            icon={TrendingUp}
            title="Daily interest scoring"
            description="Re-score leads using ICP fit and recent engagement signals."
            checked={dailyScoring}
            onCheckedChange={setDailyScoring}
          />
          <AgentCapabilityCard
            icon={Activity}
            title="Engagement signal tracking"
            description="Incorporate replies, meetings, and campaign events into scores."
            checked={engagementSignals}
            onCheckedChange={setEngagementSignals}
          />
          <AgentCapabilityCard
            icon={Brain}
            title="Action feed surfacing"
            description="Flag high-intent prospects for follow-up in your pipeline view."
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
        { label: 'Leads in pipeline', value: snapshot.leadsInPipeline },
        { label: 'Enrolled', value: snapshot.enrolledLeads },
        { label: 'Active campaigns', value: snapshot.activeCampaigns },
        { label: 'Pending drafts', value: snapshot.pendingDrafts },
      ]}
    >
      <div className="space-y-4">
        <p className="text-[13px] leading-relaxed text-[var(--text-secondary)]">
          Pipeline Analyst runs in the background. Open your pipeline for full scoring detail and
          next-best-action recommendations.
        </p>
        <Link
          href="/admin/leads"
          className="inline-flex h-10 items-center justify-center rounded-lg bg-[var(--accent)] px-4 text-[13px] font-semibold text-[var(--text-inverse)] shadow-[var(--shadow-sm)] hover:bg-[var(--accent-hover)] focus-visible:shadow-[var(--shadow-glow)]"
        >
          Open pipeline
        </Link>
      </div>
    </AgentAnalyticsPanel>
  )

  return (
    <AgentWorkspaceLayout
      title={copy.title}
      subtitle={copy.subtitle}
      statusLabel="Active"
      statusTone="success"
      config={configPanel}
      analytics={analyticsPanel}
    />
  )
}
