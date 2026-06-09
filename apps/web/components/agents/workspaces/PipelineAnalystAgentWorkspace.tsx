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
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

type Props = {
  snapshot: SdrAgentSnapshot
  defaultMinIcpScore?: number
}

export function PipelineAnalystAgentWorkspace({ snapshot, defaultMinIcpScore: initialScore = 70 }: Props) {
  const copy = AGENT_PAGE_COPY.pipeline_analyst
  const [isPending, startTransition] = useTransition()

  const [agentName, setAgentName] = useState(copy.defaultName)
  const [agentDescription, setAgentDescription] = useState(copy.defaultDescription)
  const [instructions, setInstructions] = useState(AGENT_DEFAULT_INSTRUCTIONS.pipeline_analyst)
  const [conversationStarters, setConversationStarters] = useState(
    'Show me the top 10 highest-intent leads right now\nWhich sequences have the best reply rates this month?\nFlag leads that haven\'t moved in 7 days',
  )
  const [dailyScoring, setDailyScoring] = useState(true)
  const [engagementSignals, setEngagementSignals] = useState(true)
  const [minIcpScore, setMinIcpScore] = useState(initialScore)

  function saveScoreThreshold() {
    startTransition(async () => {
      const toastId = toast.loading('Saving…')
      try {
        const res = await fetch('/api/sdr/config', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ defaultMinIcpScore: minIcpScore }),
        })
        const json = await res.json()
        if (!json.success) {
          toast.error(json.error ?? 'Could not save threshold', { id: toastId })
          return
        }
        toast.success('Score threshold saved', { id: toastId })
      } catch {
        toast.error('Save failed — check your connection', { id: toastId })
      }
    })
  }

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

      <AgentConfigSection title="Scoring settings">
        <p className="mb-4 text-[12px] leading-relaxed text-[var(--text-secondary)]">
          Leads below the minimum ICP score are hidden from action-feed surfacing and automatic follow-up priority.
        </p>
        <AgentFormField id="analyst-min-score" label="Minimum ICP score (0–100)">
          <div className="flex items-center gap-3">
            <Input
              id="analyst-min-score"
              type="number"
              min={0}
              max={100}
              className={cn(agentInputClassName, 'w-24')}
              value={minIcpScore}
              onChange={(e) =>
                setMinIcpScore(Math.min(100, Math.max(0, Number.parseInt(e.target.value, 10) || 0)))
              }
            />
            <span className="text-[12px] text-[var(--text-tertiary)]">
              leads scoring below this are deprioritized
            </span>
          </div>
        </AgentFormField>
        <button
          type="button"
          disabled={isPending}
          onClick={saveScoreThreshold}
          className="mt-2 inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--accent)] px-4 text-[13px] font-semibold text-[var(--text-inverse)] shadow-[var(--shadow-sm)] transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          Save threshold
        </button>
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
      title={agentName}
      subtitle="Pipeline Analyst · health snapshot"
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
      statusLabel="Trained"
      statusDetail={`${snapshot.leadsInPipeline} leads in pipeline · ${snapshot.activeCampaigns} active campaigns`}
      statusTone="success"
      config={configPanel}
      analytics={analyticsPanel}
    />
  )
}
