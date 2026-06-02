'use client'

import { sendPortalMessage } from '@/lib/portal/actions'
import type { PortalMessage } from '@/lib/portal/types'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { formatRelativeTime } from '@/lib/contacts/format'
import { Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'

type PortalMessagesPanelProps = {
  messages: PortalMessage[]
  preview?: boolean
}

export function PortalMessagesPanel({ messages, preview = false }: PortalMessagesPanelProps) {
  const router = useRouter()
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)

  async function handleSend() {
    const trimmed = body.trim()
    if (!trimmed) {
      toast.error('Write a message before sending')
      return
    }

    setSending(true)
    try {
      const result = await sendPortalMessage({ body: trimmed })
      if (!result.success) {
        toast.error(result.error ?? 'Could not send message')
        return
      }
      setBody('')
      toast.success('Message sent')
      router.refresh()
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-4">
      {messages.length === 0 ? (
        <p className="text-[13px] text-[var(--text-secondary)]">
          No messages yet. Send a note to your team — they&apos;ll reply here.
        </p>
      ) : (
        <ul className="max-h-80 space-y-3 overflow-y-auto pr-1">
          {messages.map((message) => {
            const isClient = message.direction === 'inbound'
            return (
              <li
                key={message.id}
                className={`flex ${isClient ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 ${
                    isClient
                      ? 'bg-[var(--accent-muted)] text-[var(--text-primary)]'
                      : 'border border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[var(--text-primary)]'
                  }`}
                >
                  <p className="text-[13px] leading-relaxed">{message.body}</p>
                  <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">
                    {isClient ? 'You' : 'Team'} ·{' '}
                    {formatRelativeTime(message.sentAt ?? message.createdAt)}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <div className="space-y-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
        {preview ? (
          <p className="text-[13px] text-[var(--text-secondary)]">
            Messaging is disabled in preview mode. Clients send messages from their signed-in portal.
          </p>
        ) : (
          <>
            <label htmlFor="portal-message" className="sr-only">
              Message your team
            </label>
            <Textarea
              id="portal-message"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Ask a question or share an update…"
              rows={3}
              disabled={sending}
              className="min-h-[88px] resize-none border-[var(--border-default)] bg-[var(--bg-base)] text-[13px]"
            />
            <div className="flex justify-end">
              <Button size="sm" disabled={sending || !body.trim()} onClick={() => void handleSend()}>
                {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Send message
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
