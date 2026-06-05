'use client'

import { KpiStrip } from '@/components/operational/KpiStrip'
import { PageHeader } from '@/components/operational/PageHeader'
import { StatusBadge } from '@/components/operational/table/StatusBadge'
import { AdminPageContent } from '@/components/admin/AdminPageContent'
import { Button } from '@/components/ui/button'
import type {
  EmailDraftItem,
  LinkedInDraftItem,
  MessageDrafterPayload,
} from '@/lib/message-drafter/types'
import { cn } from '@/lib/utils'
import {
  Bot,
  Check,
  Copy,
  ExternalLink,
  Link2,
  Loader2,
  Mail,
  MessageCircle,
  PenLine,
  Trash2,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'

type Props = {
  initialPayload: MessageDrafterPayload
}

type SequenceTab = 'email' | 'linkedin'

const SEQUENCE_TABS: { id: SequenceTab; label: string }[] = [
  { id: 'email', label: 'Email & SMS' },
  { id: 'linkedin', label: 'LinkedIn' },
]

function leadName(lead: { firstName: string | null; lastName: string | null; company: string }) {
  const name = [lead.firstName, lead.lastName].filter(Boolean).join(' ')
  return name || lead.company || 'Prospect'
}

function formatWhen(date: Date): string {
  const now = Date.now()
  const diff = now - date.getTime()
  if (diff < 60_000) return 'Just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function EmptyQueue({ tab }: { tab: SequenceTab }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[var(--border-default)] bg-[var(--bg-subtle)]/60 px-6 py-16 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)]">
        {tab === 'email' ? (
          <Mail className="h-5 w-5 text-[var(--text-tertiary)]" aria-hidden />
        ) : (
          <Link2 className="h-5 w-5 text-[var(--text-tertiary)]" aria-hidden />
        )}
      </span>
      <p className="mt-4 text-sm font-medium text-[var(--text-primary)]">
        {tab === 'email' ? 'No email or SMS drafts waiting' : 'No LinkedIn steps waiting'}
      </p>
      <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-[var(--text-secondary)]">
        {tab === 'email'
          ? 'When prospects enroll, Message Drafter writes personalized email and SMS for your review.'
          : 'LinkedIn messages from your campaigns and outreach agent show up here when it is time to send them.'}
      </p>
    </div>
  )
}

export function MessageDrafterCommandCenterClient({ initialPayload }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [copied, setCopied] = useState(false)

  const activeTab: SequenceTab =
    searchParams.get('tab') === 'linkedin' ? 'linkedin' : 'email'

  const selectedEmailId = searchParams.get('draft')
  const selectedLinkedInId = searchParams.get('step')
  const linkedInSource = searchParams.get('source') as 'campaign' | 'sdr_sequence' | null

  const { emailDrafts, linkedInDrafts, stats } = initialPayload

  const selectedEmail = useMemo(
    () => emailDrafts.find((draft) => draft.id === selectedEmailId) ?? emailDrafts[0] ?? null,
    [emailDrafts, selectedEmailId],
  )

  const selectedLinkedIn = useMemo(() => {
    if (selectedLinkedInId) {
      const match = linkedInDrafts.find((item) => item.id === selectedLinkedInId)
      if (match) return match
    }
    return linkedInDrafts[0] ?? null
  }, [linkedInDrafts, selectedLinkedInId])

  const kpiItems = [
    { label: 'Email & SMS pending', value: stats.emailPending, icon: Mail },
    { label: 'LinkedIn waiting', value: stats.linkedInPending, icon: Link2 },
    { label: 'Sent this week', value: stats.sentThisWeek, icon: Check },
  ]

  const setTab = useCallback(
    (tab: SequenceTab) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('tab', tab)
      if (tab === 'email') {
        params.delete('step')
        params.delete('source')
        if (emailDrafts[0]) params.set('draft', emailDrafts[0].id)
        else params.delete('draft')
      } else {
        params.delete('draft')
        if (linkedInDrafts[0]) {
          params.set('step', linkedInDrafts[0].id)
          params.set('source', linkedInDrafts[0].source)
        } else {
          params.delete('step')
          params.delete('source')
        }
      }
      router.replace(`/admin/outreach/agents/drafter?${params.toString()}`)
    },
    [emailDrafts, linkedInDrafts, router, searchParams],
  )

  const selectEmail = useCallback(
    (draft: EmailDraftItem) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('tab', 'email')
      params.set('draft', draft.id)
      params.delete('step')
      params.delete('source')
      router.replace(`/admin/outreach/agents/drafter?${params.toString()}`)
    },
    [router, searchParams],
  )

  const selectLinkedIn = useCallback(
    (item: LinkedInDraftItem) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('tab', 'linkedin')
      params.set('step', item.id)
      params.set('source', item.source)
      params.delete('draft')
      router.replace(`/admin/outreach/agents/drafter?${params.toString()}`)
    },
    [router, searchParams],
  )

  function handleApproveEmail() {
    if (!selectedEmail) return
    startTransition(async () => {
      const response = await fetch(`/api/drafts/${selectedEmail.id}/approve`, { method: 'POST' })
      const result = await response.json()
      if (!result.success) {
        toast.error(result.error ?? 'Could not send draft')
        return
      }
      toast.success('Draft approved and sent')
      router.refresh()
    })
  }

  function handleDiscardEmail() {
    if (!selectedEmail) return
    startTransition(async () => {
      const response = await fetch(`/api/drafts/${selectedEmail.id}/discard`, { method: 'POST' })
      const result = await response.json()
      if (!result.success) {
        toast.error(result.error ?? 'Could not discard draft')
        return
      }
      toast.success('Draft discarded')
      router.refresh()
    })
  }

  function handleCopyLinkedIn(body: string) {
    void navigator.clipboard.writeText(body).then(
      () => {
        setCopied(true)
        toast.success('Message copied')
        window.setTimeout(() => setCopied(false), 2000)
      },
      () => toast.error('Could not copy — check browser clipboard permissions'),
    )
  }

  function handleMarkLinkedInSent() {
    if (!selectedLinkedIn) return
    const source = linkedInSource ?? selectedLinkedIn.source
    startTransition(async () => {
      const response = await fetch(
        `/api/message-drafter/linkedin/${selectedLinkedIn.id}/complete`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source }),
        },
      )
      const result = await response.json()
      if (!result.success) {
        toast.error(result.error ?? 'Could not mark step sent')
        return
      }
      toast.success('LinkedIn step marked as sent')
      router.refresh()
    })
  }

  return (
    <AdminPageContent>
      <section className="card-surface overflow-hidden border-[var(--accent-border)] bg-gradient-to-br from-[var(--accent-muted)] via-[var(--bg-surface)] to-[var(--bg-subtle)] p-6 sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-2">
            <p className="inline-flex items-center gap-1.5 rounded-md border border-[var(--accent-border)] bg-[var(--accent-muted)] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-primary)]">
              <PenLine className="h-3.5 w-3.5" aria-hidden />
              Message Drafter
            </p>
            <h1 className="text-2xl font-semibold tracking-[-0.02em] text-[var(--text-primary)] sm:text-3xl">
              Review outbound sequences
            </h1>
            <p className="text-[15px] leading-relaxed text-[var(--text-secondary)]">
              Email and SMS: review here and approve to send automatically. LinkedIn: copy each
              message, send it on LinkedIn yourself, then mark it done here or in the Vantera add-on.
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/outreach/agents">
              <Bot className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              Agent roster
            </Link>
          </Button>
        </div>
      </section>

      <KpiStrip items={kpiItems} className="lg:grid-cols-3" />

      <PageHeader
        title="Draft queues"
        description="Email and SMS approval in one place; LinkedIn messages you send yourself on LinkedIn."
      />

      <nav
        className="flex gap-1 overflow-x-auto border-b border-[var(--border-default)] pb-px"
        aria-label="Draft sequence type"
      >
        {SEQUENCE_TABS.map((tab) => {
          const count = tab.id === 'email' ? stats.emailPending : stats.linkedInPending
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTab(tab.id)}
              className={cn(
                'flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-muted)]',
                active
                  ? 'border-[var(--accent)] text-[var(--text-primary)]'
                  : 'border-transparent text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]',
              )}
            >
              {tab.label}
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[11px] font-medium',
                  active
                    ? 'bg-[var(--accent-muted)] text-[var(--text-primary)]'
                    : 'bg-[var(--bg-overlay)] text-[var(--text-secondary)]',
                )}
              >
                {count}
              </span>
            </button>
          )
        })}
      </nav>

      {activeTab === 'email' ? (
        emailDrafts.length === 0 ? (
          <EmptyQueue tab="email" />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(280px,360px)_1fr]">
            <section className="card-surface overflow-hidden">
              <div className="border-b border-[var(--border-subtle)] px-4 py-3">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Email & SMS queue</h3>
                <p className="mt-0.5 text-[12px] text-[var(--text-secondary)]">
                  Approve to send immediately
                </p>
              </div>
              <ul className="max-h-[520px] divide-y divide-[var(--border-subtle)] overflow-y-auto">
                {emailDrafts.map((draft) => {
                  const selected = selectedEmail?.id === draft.id
                  return (
                    <li key={draft.id}>
                      <button
                        type="button"
                        onClick={() => selectEmail(draft)}
                        className={cn(
                          'flex w-full gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-[var(--bg-overlay)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent-muted)]',
                          selected && 'bg-[var(--accent-muted)]/40',
                        )}
                      >
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)]">
                          {draft.channel === 'sms' ? (
                            <MessageCircle className="h-4 w-4 text-[var(--accent)]" aria-hidden />
                          ) : (
                            <Mail className="h-4 w-4 text-[var(--text-secondary)]" aria-hidden />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                              {leadName(draft.lead)}
                            </p>
                            <StatusBadge
                              label={draft.channel}
                              tone={draft.channel === 'sms' ? 'info' : 'neutral'}
                            />
                          </div>
                          <p className="mt-0.5 truncate text-[12px] text-[var(--text-secondary)]">
                            {draft.channel === 'email' && draft.subject
                              ? draft.subject
                              : draft.body.slice(0, 80)}
                          </p>
                          <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">
                            {formatWhen(draft.createdAt)}
                          </p>
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>

            {selectedEmail ? (
              <EmailDraftDetail
                draft={selectedEmail}
                isPending={isPending}
                onApprove={handleApproveEmail}
                onDiscard={handleDiscardEmail}
              />
            ) : null}
          </div>
        )
      ) : linkedInDrafts.length === 0 ? (
        <EmptyQueue tab="linkedin" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(280px,360px)_1fr]">
          <section className="card-surface overflow-hidden">
            <div className="border-b border-[var(--border-subtle)] px-4 py-3">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">LinkedIn queue</h3>
              <p className="mt-0.5 text-[12px] text-[var(--text-secondary)]">
                Copy the note, send on LinkedIn, then mark done
              </p>
            </div>
            <ul className="max-h-[520px] divide-y divide-[var(--border-subtle)] overflow-y-auto">
              {linkedInDrafts.map((item) => {
                const selected = selectedLinkedIn?.id === item.id
                return (
                  <li key={`${item.source}-${item.id}`}>
                    <button
                      type="button"
                      onClick={() => selectLinkedIn(item)}
                      className={cn(
                        'flex w-full gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-[var(--bg-overlay)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent-muted)]',
                        selected && 'bg-[var(--accent-muted)]/40',
                      )}
                    >
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)]">
                        <Link2 className="h-4 w-4 text-[var(--accent)]" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                            {leadName(item.lead)}
                          </p>
                          <StatusBadge
                            label={item.source === 'campaign' ? 'Campaign' : 'SDR sequence'}
                            tone="info"
                          />
                        </div>
                        <p className="mt-0.5 truncate text-[12px] text-[var(--text-secondary)]">
                          {item.campaignName ?? 'LinkedIn step'} · Step {item.stepIndex + 1}
                        </p>
                        <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">
                          {formatWhen(item.scheduledFor)}
                        </p>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>

          {selectedLinkedIn ? (
            <LinkedInDraftDetail
              item={selectedLinkedIn}
              isPending={isPending}
              copied={copied}
              onCopy={handleCopyLinkedIn}
              onMarkSent={handleMarkLinkedInSent}
            />
          ) : null}
        </div>
      )}
    </AdminPageContent>
  )
}

function EmailDraftDetail({
  draft,
  isPending,
  onApprove,
  onDiscard,
}: {
  draft: EmailDraftItem
  isPending: boolean
  onApprove: () => void
  onDiscard: () => void
}) {
  return (
    <article className="card-surface flex flex-col">
      <header className="border-b border-[var(--border-subtle)] px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
              Email & SMS sequence
            </p>
            <h3 className="mt-1 text-lg font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
              {leadName(draft.lead)}
            </h3>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {draft.lead.company}
              {draft.channel === 'email' && draft.lead.email ? ` · ${draft.lead.email}` : null}
              {draft.channel === 'sms' && draft.lead.phone ? ` · ${draft.lead.phone}` : null}
            </p>
          </div>
          <StatusBadge label={draft.channel} tone={draft.channel === 'sms' ? 'info' : 'neutral'} />
        </div>
      </header>

      <div className="flex-1 space-y-5 px-5 py-5">
        {draft.channel === 'email' && draft.subject ? (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
              Subject
            </p>
            <p className="mt-2 text-[15px] font-medium text-[var(--text-primary)]">{draft.subject}</p>
          </div>
        ) : null}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
            Message
          </p>
          <div className="mt-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/80 px-4 py-4">
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-[var(--text-primary)]">
              {draft.body}
            </p>
          </div>
        </div>
        <p className="text-[12px] text-[var(--text-tertiary)]">
          Drafted by {draft.draftedBy} · {formatWhen(draft.createdAt)}
        </p>
      </div>

      <footer className="flex flex-wrap justify-end gap-2 border-t border-[var(--border-subtle)] px-5 py-4">
        <Button variant="outline" disabled={isPending} onClick={onDiscard}>
          <Trash2 className="mr-1.5 h-4 w-4" aria-hidden />
          Discard
        </Button>
        <Button disabled={isPending} onClick={onApprove}>
          {isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : null}
          Approve & send
        </Button>
      </footer>
    </article>
  )
}

function LinkedInDraftDetail({
  item,
  isPending,
  copied,
  onCopy,
  onMarkSent,
}: {
  item: LinkedInDraftItem
  isPending: boolean
  copied: boolean
  onCopy: (body: string) => void
  onMarkSent: () => void
}) {
  return (
    <article className="card-surface flex flex-col">
      <header className="border-b border-[var(--border-subtle)] px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
              LinkedIn sequence
            </p>
            <h3 className="mt-1 text-lg font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
              {leadName(item.lead)}
            </h3>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {item.lead.company} · Step {item.stepIndex + 1}
              {item.campaignName ? ` · ${item.campaignName}` : null}
            </p>
          </div>
          <StatusBadge
            label={item.source === 'campaign' ? 'Campaign' : 'SDR sequence'}
            tone="info"
          />
        </div>
      </header>

      <div className="flex-1 space-y-5 px-5 py-5">
        <div className="rounded-lg border border-[var(--warning)]/30 bg-[var(--warning-muted)] px-4 py-3 text-[13px] text-[var(--text-primary)]">
          <p className="font-medium">You send this on LinkedIn</p>
          <p className="mt-1 text-[var(--text-secondary)]">
            Copy the message below, paste it into LinkedIn, send the connection note, then mark it
            done here so Vantera knows to move to the next step.
          </p>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
            Connection message
          </p>
          <div className="mt-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/80 px-4 py-4">
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-[var(--text-primary)]">
              {item.body}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => onCopy(item.body)}>
            {copied ? (
              <Check className="mr-1.5 h-4 w-4 text-[var(--success)]" aria-hidden />
            ) : (
              <Copy className="mr-1.5 h-4 w-4" aria-hidden />
            )}
            {copied ? 'Copied' : 'Copy message'}
          </Button>
          {item.lead.linkedinUrl ? (
            <Button variant="outline" size="sm" asChild>
              <a href={item.lead.linkedinUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-1.5 h-4 w-4" aria-hidden />
                Open LinkedIn profile
              </a>
            </Button>
          ) : (
            <p className="self-center text-[12px] text-[var(--text-tertiary)]">
              No LinkedIn URL on this lead
            </p>
          )}
        </div>
      </div>

      <footer className="flex flex-wrap justify-end gap-2 border-t border-[var(--border-subtle)] px-5 py-4">
        <Button disabled={isPending} onClick={onMarkSent}>
          {isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : null}
          Mark as sent
        </Button>
      </footer>
    </article>
  )
}
