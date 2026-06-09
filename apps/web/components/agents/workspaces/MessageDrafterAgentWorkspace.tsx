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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { AGENT_DEFAULT_INSTRUCTIONS, AGENT_PAGE_COPY } from '@/lib/agents/default-instructions'
import type { MessageDrafterPayload } from '@/lib/message-drafter/types'
import type { SdrProfile } from '@/lib/sdr/profile'
import { isAutomaticOutreachMode } from '@/lib/sdr/outreach-automation-mode'
import type { OutreachAutomationMode } from '@/lib/sdr/outreach-automation-mode'
import { cn } from '@/lib/utils'
import { Check, Link2, Mail, MessageCircle, PenLine, Shield } from 'lucide-react'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

type Props = {
  initialPayload: MessageDrafterPayload
  outreachAutomationMode: OutreachAutomationMode
  profile: SdrProfile
}

const VOICE_OPTIONS = [
  { value: 'professional', label: 'Professional' },
  { value: 'friendly', label: 'Friendly & Conversational' },
  { value: 'direct', label: 'Direct & Concise' },
  { value: 'consultative', label: 'Consultative' },
  { value: 'bold', label: 'Bold & Confident' },
]

export function MessageDrafterAgentWorkspace({
  initialPayload,
  outreachAutomationMode,
  profile,
}: Props) {
  const copy = AGENT_PAGE_COPY.message_drafter
  const automatic = isAutomaticOutreachMode(outreachAutomationMode)
  const { stats } = initialPayload
  const [isPending, startTransition] = useTransition()

  const [agentName, setAgentName] = useState(copy.defaultName)
  const [agentDescription, setAgentDescription] = useState(copy.defaultDescription)
  const [fromName, setFromName] = useState(profile.fromName ?? '')
  const [fromEmail, setFromEmail] = useState(profile.fromEmail ?? '')
  const [agentTitle, setAgentTitle] = useState(profile.agentTitle ?? '')
  const [valueProposition, setValueProposition] = useState(profile.valueProposition ?? '')
  const [icpDescription, setIcpDescription] = useState(profile.icpDescription ?? '')
  const [icpSummary, setIcpSummary] = useState(profile.icpSummary ?? '')
  const [voicePreference, setVoicePreference] = useState(profile.voicePreference ?? 'professional')
  const [signature, setSignature] = useState(profile.signature ?? '')
  const [bookingLink, setBookingLink] = useState(profile.bookingLink ?? '')
  const [instructions, setInstructions] = useState(AGENT_DEFAULT_INSTRUCTIONS.message_drafter)
  const [conversationStarters, setConversationStarters] = useState(
    'Draft a personalized cold email for the next lead in queue\nGenerate a 5-step sequence for a high-scoring lead\nReview and improve the last batch of drafted messages',
  )
  const [requireReview, setRequireReview] = useState(!automatic)
  const [linkedinManual, setLinkedinManual] = useState(true)

  const statusLabel = stats.emailPending + stats.linkedInPending > 0 ? 'Review needed' : 'Trained'
  const statusTone = stats.emailPending + stats.linkedInPending > 0 ? 'warning' : 'success'
  const statusDetail = `${stats.emailPending + stats.linkedInPending} drafts in queue · ${stats.sentThisWeek} sent this week`

  function save() {
    startTransition(async () => {
      const toastId = toast.loading('Saving…')
      try {
        const res = await fetch('/api/sdr/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            fromName: fromName.trim() || null,
            fromEmail: fromEmail.trim() || null,
            agentTitle: agentTitle.trim() || null,
            signature: signature.trim() || null,
            bookingLink: bookingLink.trim() || null,
            voicePreference: voicePreference || null,
            valueProposition: valueProposition.trim() || null,
            icpDescription: icpDescription.trim() || null,
            icpSummary: icpSummary.trim() || null,
          }),
        })
        const json = await res.json()
        if (!json.success) {
          toast.error(json.error ?? 'Could not save profile', { id: toastId })
          return
        }
        toast.success('Profile saved — outreach copy will use the updated context', { id: toastId })
      } catch {
        toast.error('Save failed — check your connection', { id: toastId })
      }
    })
  }

  const configPanel = (
    <>
      <AgentConfigSection title="Agent Identity">
        <AgentFormField id="drafter-name" label="Agent name">
          <Input
            id="drafter-name"
            className={agentInputClassName}
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
          />
        </AgentFormField>
        <AgentFormField id="drafter-from-name" label="Sender name">
          <Input
            id="drafter-from-name"
            className={agentInputClassName}
            placeholder="Jane Smith"
            value={fromName}
            onChange={(e) => setFromName(e.target.value)}
          />
        </AgentFormField>
        <AgentFormField id="drafter-from-email" label="Sender email">
          <Input
            id="drafter-from-email"
            type="email"
            className={agentInputClassName}
            placeholder="jane@yourcompany.com"
            value={fromEmail}
            onChange={(e) => setFromEmail(e.target.value)}
          />
        </AgentFormField>
        <AgentFormField id="drafter-agent-title" label="Sender title">
          <Input
            id="drafter-agent-title"
            className={agentInputClassName}
            placeholder="Sales Development Rep"
            value={agentTitle}
            onChange={(e) => setAgentTitle(e.target.value)}
          />
        </AgentFormField>
      </AgentConfigSection>

      <AgentConfigSection title="Voice & Value">
        <p className="mb-4 text-[12px] leading-relaxed text-[var(--text-secondary)]">
          These fields power every piece of outreach copy. The more specific you are, the more
          personalized and conversion-focused each sequence will be.
        </p>
        <AgentFormField id="drafter-value-prop" label="Value proposition">
          <Textarea
            id="drafter-value-prop"
            rows={3}
            className={agentTextareaClassName}
            placeholder="We help HVAC companies book 3–5 new installs per week using automated follow-up sequences…"
            value={valueProposition}
            onChange={(e) => setValueProposition(e.target.value)}
          />
        </AgentFormField>
        <AgentFormField id="drafter-icp-desc" label="Primary pain point">
          <Textarea
            id="drafter-icp-desc"
            rows={2}
            className={agentTextareaClassName}
            placeholder="Owners losing leads due to slow follow-up, no CRM, competing with big franchises…"
            value={icpDescription}
            onChange={(e) => setIcpDescription(e.target.value)}
          />
        </AgentFormField>
        <AgentFormField id="drafter-icp-summary" label="ICP summary">
          <Input
            id="drafter-icp-summary"
            className={agentInputClassName}
            placeholder="Home service business owners, 2–20 employees, $500k–$5M revenue"
            value={icpSummary}
            onChange={(e) => setIcpSummary(e.target.value)}
          />
        </AgentFormField>
        <AgentFormField id="drafter-voice" label="Voice tone">
          <Select value={voicePreference} onValueChange={setVoicePreference}>
            <SelectTrigger className={cn(agentInputClassName, 'w-full')}>
              <SelectValue placeholder="Select tone…" />
            </SelectTrigger>
            <SelectContent>
              {VOICE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </AgentFormField>
      </AgentConfigSection>

      <AgentConfigSection title="Signature & Booking">
        <AgentFormField id="drafter-signature" label="Email signature">
          <Textarea
            id="drafter-signature"
            rows={4}
            className={agentTextareaClassName}
            placeholder={'Jane Smith\nSales Development Rep\njane@yourcompany.com\n(555) 123-4567'}
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
          />
        </AgentFormField>
        <AgentFormField id="drafter-booking" label="Booking link">
          <div className="relative">
            <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" aria-hidden />
            <Input
              id="drafter-booking"
              type="url"
              className={cn(agentInputClassName, 'pl-9')}
              placeholder="https://cal.com/jane/30min"
              value={bookingLink}
              onChange={(e) => setBookingLink(e.target.value)}
            />
          </div>
        </AgentFormField>
        <button
          type="button"
          disabled={isPending}
          onClick={save}
          className="mt-2 inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--accent)] px-4 text-[13px] font-semibold text-[var(--text-inverse)] shadow-[var(--shadow-sm)] transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          Save profile
        </button>
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
      title={agentName}
      subtitle="Message Drafter · review queue"
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
      statusDetail={statusDetail}
      statusTone={statusTone}
      config={configPanel}
      analytics={analyticsPanel}
      footer={
        <AgentConfigSection
          title="Review queue"
          description="Approve, edit, or discard drafts before they go out."
        >
          <MessageDrafterCommandCenterClient initialPayload={initialPayload} embedded />
        </AgentConfigSection>
      }
    />
  )
}
