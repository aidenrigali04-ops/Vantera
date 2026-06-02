'use client'

import {
  inviteContactToPortal,
  resendPortalInvite,
  revokeContactPortalAccess,
} from '@/lib/portal/invite'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/operational/table/StatusBadge'
import { formatRelativeTime } from '@/lib/contacts/format'
import type { PortalAccessState } from '@/lib/portal/types'
import type { contacts } from '@vantera/db'
import { Copy, ExternalLink, Mail, ShieldOff } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'

type Contact = typeof contacts.$inferSelect

type Props = {
  contact: Contact
  portal: PortalAccessState
}

export function PortalAccessPanel({ contact, portal }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState<'invite' | 'resend' | 'revoke' | null>(null)

  const loginUrl = `${portal.portalUrl}/auth/portal-login`

  async function runAction(
    action: 'invite' | 'resend' | 'revoke',
    fn: () => Promise<{ success: boolean; error?: string }>,
  ) {
    setBusy(action)
    try {
      const result = await fn()
      if (!result.success) {
        toast.error(result.error ?? 'Something went wrong')
        return
      }
      if (action === 'invite') toast.success('Portal invite sent')
      if (action === 'resend') toast.success('Invite resent')
      if (action === 'revoke') toast.success('Portal access revoked')
      router.refresh()
    } finally {
      setBusy(null)
    }
  }

  async function copyLoginUrl() {
    await navigator.clipboard.writeText(loginUrl)
    toast.success('Portal login URL copied')
  }

  return (
    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-sm)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
            Client portal
          </p>
          <h3 className="mt-1 text-sm font-semibold text-[var(--text-primary)]">Portal access</h3>
          <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-secondary)]">
            Invite this client to a branded workspace with projects, billing, and messaging.
          </p>
        </div>
        <StatusBadge
          label={contact.portalAccess ? 'Enabled' : 'Not enabled'}
          tone={contact.portalAccess ? 'success' : 'neutral'}
        />
      </div>

      <dl className="mt-4 space-y-3 text-[13px]">
        <div>
          <dt className="text-[var(--text-secondary)]">Portal URL</dt>
          <dd className="mt-0.5 break-all font-medium text-[var(--text-primary)]">{loginUrl}</dd>
        </div>
        {contact.portalInvitedAt ? (
          <div>
            <dt className="text-[var(--text-secondary)]">Last invited</dt>
            <dd className="mt-0.5 text-[var(--text-primary)]">
              {formatRelativeTime(contact.portalInvitedAt)}
            </dd>
          </div>
        ) : null}
        {contact.portalLastLoginAt ? (
          <div>
            <dt className="text-[var(--text-secondary)]">Last login</dt>
            <dd className="mt-0.5 text-[var(--text-primary)]">
              {formatRelativeTime(contact.portalLastLoginAt)}
            </dd>
          </div>
        ) : null}
      </dl>

      {!contact.email ? (
        <p className="mt-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-[13px] text-[var(--text-secondary)]">
          Add an email address to send a portal invite.
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          {!contact.portalAccess ? (
            <Button
              size="sm"
              disabled={busy != null}
              onClick={() => void runAction('invite', () => inviteContactToPortal(contact.id))}
            >
              <Mail className="mr-2 h-4 w-4" />
              {busy === 'invite' ? 'Sending…' : 'Send portal invite'}
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                variant="secondary"
                disabled={busy != null}
                onClick={() => void runAction('resend', () => resendPortalInvite(contact.id))}
              >
                <Mail className="mr-2 h-4 w-4" />
                {busy === 'resend' ? 'Sending…' : 'Resend invite'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => void copyLoginUrl()}>
                <Copy className="mr-2 h-4 w-4" />
                Copy login URL
              </Button>
              <Button size="sm" variant="outline" asChild>
                <a href={loginUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open portal
                </a>
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-[var(--danger)] hover:text-[var(--danger)]"
                disabled={busy != null}
                onClick={() => void runAction('revoke', () => revokeContactPortalAccess(contact.id))}
              >
                <ShieldOff className="mr-2 h-4 w-4" />
                {busy === 'revoke' ? 'Revoking…' : 'Revoke access'}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
