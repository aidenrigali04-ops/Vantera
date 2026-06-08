'use client'

import { AgentAnalyticsPanel } from '@/components/agents/AgentAnalyticsPanel'
import { AgentCapabilityCard } from '@/components/agents/AgentCapabilityCard'
import { AgentConfigSection } from '@/components/agents/AgentConfigSection'
import { AgentWorkspaceLayout } from '@/components/agents/AgentWorkspaceLayout'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { AGENT_DEFAULT_INSTRUCTIONS, AGENT_PAGE_COPY } from '@/lib/agents/default-instructions'
import type { SdrAgentSnapshot } from '@/lib/agents/types'
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
  const [dailyScoring, setDailyScoring] = useState(true)
  const [engagementSignals, setEngagementSignals] = useState(true)

  const configPanel = (
    <>
      <AgentConfigSection title="Agent identity">
        <div>
          <Label htmlFor="analyst-name">Name</Label>
          <Input
            id="analyst-name"
            className="mt-1.5 border-[var(--border-default)] bg-[var(--bg-subtle)]/50"
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="analyst-description">Description</Label>
          <Input
            id="analyst-description"
            className="mt-1.5 border-[var(--border-default)] bg-[var(--bg-subtle)]/50"
            value={agentDescription}
            onChange={(e) => setAgentDescription(e.target.value)}
          />
        </div>
      </AgentConfigSection>

      <AgentConfigSection title="Instructions">
        <div>
          <Label htmlFor="analyst-instructions">Instruction</Label>
          <Textarea
            id="analyst-instructions"
            rows={6}
            className="mt-1.5 resize-y border-[var(--border-default)] bg-[var(--bg-subtle)]/50 font-mono text-[13px]"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
          />
        </div>
      </AgentConfigSection>

      <AgentConfigSection title="Capabilities">
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
          className="inline-flex items-center justify-center rounded-lg bg-[var(--accent)] px-4 py-2 text-[13px] font-semibold text-[var(--text-inverse)] hover:bg-[var(--accent-hover)]"
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
