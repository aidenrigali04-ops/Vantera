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
  CAMPAIGN_LINKEDIN_DRAFT_GUIDELINES,
  CAMPAIGN_MERGE_TOKENS,
  LINKEDIN_NOTE_CHAR_LIMIT,
} from '@/lib/outreach/campaign-draft-guidelines'
import type { LeadRow, OutreachCampaignWorkflowStep } from '@/lib/outreach/types'
import { personalizeTemplate } from '@/lib/outreach/types'
import { cn } from '@/lib/utils'
import { ChevronDown, ExternalLink, Loader2, Sparkles } from 'lucide-react'
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

export function CampaignSingleLinkedInComposer({
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

  const charCount = step.body.length
  const overLimit = charCount > LINKEDIN_NOTE_CHAR_LIMIT
  const previewBody = sampleLead ? personalizeTemplate(step.body, sampleLead) : step.body

  function insertToken(token: string) {
    const next = `${step.body}${step.body ? ' ' : ''}${token}`
    if (next.length > LINKEDIN_NOTE_CHAR_LIMIT) {
      toast.error(`Would exceed ${LINKEDIN_NOTE_CHAR_LIMIT} characters`)
      return
    }
    onChange({ body: next })
  }

  function handleAiDraft() {
    if (!sampleLead) {
      toast.error('Add a lead with a LinkedIn URL to generate a sample draft')
      return
    }
    if (!sampleLead.linkedinUrl?.trim()) {
      toast.error('Sample lead needs a LinkedIn profile URL')
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
      if (result.data.body.length > LINKEDIN_NOTE_CHAR_LIMIT) {
        toast.warning('Draft exceeded 300 chars — trim before launch')
      }
      onChange({ body: result.data.body })
      setRationale(result.data.rationale)
      toast.success(
        step.body.trim() ? 'AI refined your note using Message Drafter rules' : 'AI draft applied',
      )
    })
  }

  return (
    <div className="space-y-5">
      <Collapsible open={guidelinesOpen} onOpenChange={setGuidelinesOpen}>
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/60 px-4 py-3 text-left">
          <span className="text-[13px] font-medium text-[var(--text-primary)]">
            AI draft guidelines (LinkedIn / Message Drafter)
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
            {CAMPAIGN_LINKEDIN_DRAFT_GUIDELINES.map((line) => (
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

      <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/40 px-4 py-3 text-[12px] text-[var(--text-secondary)]">
        LinkedIn messages are <strong className="text-[var(--text-primary)]">sent by you on LinkedIn</strong> — after
        launch, copy each note from Results, send on LinkedIn, then mark it done. Email still sends
        automatically from Vantera.
      </div>

      <div className="space-y-2">
        <Label htmlFor="li-intent">Note intent (optional)</Label>
        <Textarea
          id="li-intent"
          value={step.intent}
          onChange={(e) => onChange({ intent: e.target.value })}
          rows={2}
          disabled={disabled}
          className="resize-y text-[13px]"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="li-writer-notes">Extra direction for AI (optional)</Label>
        <Input
          id="li-writer-notes"
          value={writerNotes}
          onChange={(e) => setWriterNotes(e.target.value)}
          disabled={disabled}
          placeholder="e.g. Mention we serve HVAC operators in Texas"
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
          {step.body.trim() ? 'AI refine note' : 'AI draft note'}
        </Button>
      </div>

      {rationale ? (
        <p className="rounded-lg bg-[var(--accent-muted)] px-3 py-2 text-[12px] text-[var(--text-primary)]">
          {rationale}
        </p>
      ) : null}

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor="li-body">Connection note</Label>
          <span
            className={cn(
              'text-[11px] font-medium tabular-nums',
              overLimit ? 'text-[var(--danger)]' : 'text-[var(--text-tertiary)]',
            )}
          >
            {charCount}/{LINKEDIN_NOTE_CHAR_LIMIT}
          </span>
        </div>
        <div className="flex flex-wrap gap-1">
          {CAMPAIGN_MERGE_TOKENS.map(({ token, label }) => (
            <button
              key={token}
              type="button"
              disabled={disabled}
              onClick={() => insertToken(token)}
              className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-0.5 font-mono text-[10px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-overlay)]"
              title={label}
            >
              {token}
            </button>
          ))}
        </div>
        <Textarea
          id="li-body"
          value={step.body}
          onChange={(e) => onChange({ body: e.target.value })}
          disabled={disabled}
          rows={6}
          maxLength={LINKEDIN_NOTE_CHAR_LIMIT + 50}
          placeholder="Hi {{first_name}} — saw {{company}}'s work in …"
          className="resize-y font-mono text-[13px] leading-relaxed"
        />
        {overLimit ? (
          <p className="text-[12px] font-medium text-[var(--danger)]">
            Shorten to {LINKEDIN_NOTE_CHAR_LIMIT} characters before launch.
          </p>
        ) : null}
      </div>

      {sampleLead ? (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
              Preview for {leadName(sampleLead)}
            </p>
            {sampleLead.linkedinUrl ? (
              <a
                href={sampleLead.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--accent)] hover:underline"
              >
                Profile
                <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
            ) : null}
          </div>
          <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--text-secondary)]">
            {previewBody.trim() || 'Note preview appears as you write.'}
          </p>
          <p className="mt-2 text-[11px] text-[var(--text-tertiary)]">
            Preview length: {previewBody.length} characters
          </p>
        </div>
      ) : (
        <p className="text-[12px] text-[var(--text-tertiary)]">
          Enroll a lead with a LinkedIn URL to preview and run AI draft.
        </p>
      )}
    </div>
  )
}
