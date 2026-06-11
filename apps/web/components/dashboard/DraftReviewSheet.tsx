'use client'

import { DetailSidePanel } from '@/components/operational/DetailSidePanel'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'

type DraftDetail = {
  id: string
  channel: string
  subject: string | null
  body: string
  lead: {
    id: string
    firstName: string | null
    lastName: string | null
    company: string | null
    email: string | null
  }
}

type Props = {
  draftId: string | null
  onClose: () => void
  onActionComplete?: () => void
}

function leadName(lead: DraftDetail['lead']) {
  const name = [lead.firstName, lead.lastName].filter(Boolean).join(' ')
  return name || lead.company || 'Lead'
}

export function DraftReviewSheet({ draftId, onClose, onActionComplete }: Props) {
  const [draft, setDraft] = useState<DraftDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!draftId) {
      setDraft(null)
      return
    }

    setLoading(true)
    fetch('/api/drafts')
      .then((res) => res.json())
      .then((payload) => {
        if (!payload.success) throw new Error(payload.error ?? 'Failed to load drafts')
        const match = (payload.data as DraftDetail[]).find((row) => row.id === draftId)
        setDraft(match ?? null)
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : 'Could not load draft')
        onClose()
      })
      .finally(() => setLoading(false))
  }, [draftId, onClose])

  function handleApprove() {
    if (!draftId) return
    startTransition(async () => {
      const response = await fetch(`/api/drafts/${draftId}/approve`, { method: 'POST' })
      const result = await response.json()
      if (!result.success) {
        toast.error(result.error ?? 'Could not send draft')
        return
      }
      toast.success('Draft approved and sent')
      onActionComplete?.()
      onClose()
    })
  }

  function handleDiscard() {
    if (!draftId) return
    startTransition(async () => {
      const response = await fetch(`/api/drafts/${draftId}/discard`, { method: 'POST' })
      const result = await response.json()
      if (!result.success) {
        toast.error(result.error ?? 'Could not discard draft')
        return
      }
      toast.success('Draft discarded')
      onActionComplete?.()
      onClose()
    })
  }

  return (
    <DetailSidePanel
      open={Boolean(draftId)}
      onClose={onClose}
      title="Review draft"
      subtitle={draft ? `${leadName(draft.lead)} · ${draft.channel}` : undefined}
      footer={
        draft ? (
          <div className="flex justify-end gap-2">
            <Button variant="outline" disabled={isPending} onClick={handleDiscard}>
              Discard
            </Button>
            <Button disabled={isPending} onClick={handleApprove}>
              {isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Approve & send
            </Button>
          </div>
        ) : null
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-12 text-sm text-[var(--text-tertiary)]">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading draft…
        </div>
      ) : draft ? (
        <div className="space-y-4">
          {draft.channel === 'email' && draft.subject ? (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]">Subject</p>
              <p className="mt-1 text-sm text-[var(--text-primary)]">{draft.subject}</p>
            </div>
          ) : null}
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]">Message</p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--text-secondary)]">{draft.body}</p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-[var(--text-tertiary)]">Draft not found or already processed.</p>
      )}
    </DetailSidePanel>
  )
}
