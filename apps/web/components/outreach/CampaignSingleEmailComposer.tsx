'use client'

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { draftCampaignMessage } from '@/lib/outreach/actions'
import {
  CAMPAIGN_EMAIL_DRAFT_GUIDELINES,
  CAMPAIGN_MERGE_TOKENS,
} from '@/lib/outreach/campaign-draft-guidelines'
import type { LeadRow, OutreachCampaignWorkflowStep } from '@/lib/outreach/types'
import { personalizeTemplate } from '@/lib/outreach/types'
import { cn } from '@/lib/utils'
import { ChevronDown, Loader2, Sparkles } from 'lucide-react'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

type Props = {
  campaignId: string
  step: OutreachCampaignWorkflowStep
  onChange: (patch: Partial<OutreachCampaignWorkflowStep>) => void
  sampleLead: LeadRow | undefined
  disabled?: boolean
}

function leadName(lead: Pick<LeadRow, 'firstName' | 'lastName' | 'company'>) {
  const name = [lead.firstName, lead.lastName].filter(Boolean).join(' ')
  return name || lead.company || 'Sample lead'
}

export function CampaignSingleEmailComposer({
  campaignId,
  step,
  onChange,
  sampleLead,
  disabled = false,
}: Props) {
  const [writerNotes, setWriterNotes] = useState('')
  const [rationale, setRationale] = useState<string | null>(null)
  const [guidelinesOpen, setGuidelinesOpen] = useState(true)
  const [isPending, startTransition] = useTransition()

  const previewSubject = sampleLead
    ? personalizeTemplate(step.subject ?? '', sampleLead)
    : step.subject
  const previewBody = sampleLead ? personalizeTemplate(step.body, sampleLead) : step.body

  function insertToken(token: string) {
    onChange({ body: `${step.body}${step.body ? ' ' : ''}${token}` })
  }

  function handleAiDraft() {
    if (!sampleLead) {
      toast.error('Enroll or add a lead in your pipeline to generate a sample draft')
      return
    }

    startTransition(async () => {
      const result = await draftCampaignMessage(campaignId, sampleLead.id, 0, {
        writerNotes: writerNotes.trim() || undefined,
      })
      if (!result.success) {
        toast.error(result.error)
        return
      }

      onChange({
        subject: result.data.subject,
        body: result.data.body,
      })
      setRationale(result.data.rationale)
      toast.success(
        step.body.trim()
          ? 'AI refined your draft using Message Drafter guidelines'
          : 'AI draft applied',
      )
    })
  }

  return (
    <div className="space-y-5">
      <Collapsible open={guidelinesOpen} onOpenChange={setGuidelinesOpen}>
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/60 px-4 py-3 text-left">
          <span className="text-[13px] font-medium text-[var(--text-primary)]">
            AI draft guidelines (Message Drafter)
          </span>
          <ChevronDown
            className={cn(
              'h-4 w-4 text-[var(--text-tertiary)] transition-transform',
              guidelinesOpen && 'rotate-180',
            )}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          <ul className="space-y-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3 text-[12px] leading-relaxed text-[var(--text-secondary)]">
            {CAMPAIGN_EMAIL_DRAFT_GUIDELINES.map((line) => (
              <li key={line} className="flex gap-2">
                <span className="text-[var(--accent)]" aria-hidden>
                  ·
                </span>
                {line}
              </li>
            ))}
          </ul>
        </CollapsibleContent>
      </Collapsible>

      <div className="space-y-2">
        <Label htmlFor="campaign-intent">Message intent (optional)</Label>
        <Textarea
          id="campaign-intent"
          value={step.intent}
          onChange={(e) => onChange({ intent: e.target.value })}
          rows={2}
          disabled={disabled}
          placeholder="e.g. Invite to a 15-minute discovery call about reducing churn…"
          className="resize-y text-[13px]"
        />
        <p className="text-[12px] text-[var(--text-tertiary)]">
          Guides AI draft. Campaign goal intent is used if this is empty.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="writer-notes">Extra direction for AI (optional)</Label>
        <Input
          id="writer-notes"
          value={writerNotes}
          onChange={(e) => setWriterNotes(e.target.value)}
          disabled={disabled}
          placeholder="e.g. Mention our Q2 case study, keep tone casual"
          className="text-[13px]"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAiDraft}
          disabled={disabled || isPending}
          className="border-[var(--border-default)]"
        >
          {isPending ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
          )}
          {step.body.trim() ? 'AI refine draft' : 'AI draft'}
        </Button>
        <span className="text-[12px] text-[var(--text-tertiary)]">
          Uses ICP, value prop, and sample lead context — output uses merge tags.
        </span>
      </div>

      {rationale ? (
        <p className="rounded-lg bg-[var(--accent-muted)] px-3 py-2 text-[12px] text-[var(--text-primary)]">
          {rationale}
        </p>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="email-subject">Subject line</Label>
        <Input
          id="email-subject"
          value={step.subject ?? ''}
          onChange={(e) => onChange({ subject: e.target.value })}
          disabled={disabled}
          placeholder="Peer-level subject — use {{company}} when helpful"
          className="font-mono text-[13px]"
        />
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor="email-body">Email body</Label>
          <div className="flex flex-wrap gap-1">
            {CAMPAIGN_MERGE_TOKENS.map(({ token, label }) => (
              <button
                key={token}
                type="button"
                disabled={disabled}
                onClick={() => insertToken(token)}
                className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-0.5 font-mono text-[10px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-overlay)] focus-visible:shadow-[var(--shadow-glow)]"
                title={label}
              >
                {token}
              </button>
            ))}
          </div>
        </div>
        <Textarea
          id="email-body"
          value={step.body}
          onChange={(e) => onChange({ body: e.target.value })}
          disabled={disabled}
          rows={12}
          placeholder="Write your email, or use AI draft. Personalize with {{first_name}}, {{company}}, etc."
          className="resize-y font-mono text-[13px] leading-relaxed"
        />
      </div>

      {sampleLead ? (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/50 p-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
            Preview for {leadName(sampleLead)}
          </p>
          <p className="mt-2 text-[13px] font-medium text-[var(--text-primary)]">
            {previewSubject || '(No subject)'}
          </p>
          <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--text-secondary)]">
            {previewBody.trim() || 'Body preview appears as you write.'}
          </p>
        </div>
      ) : (
        <p className="text-[12px] text-[var(--text-tertiary)]">
          Add a lead to see a personalized preview and enable AI draft.
        </p>
      )}
    </div>
  )
}
