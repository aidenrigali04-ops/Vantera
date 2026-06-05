'use client'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LinkedInExtensionInstallSteps } from '@/components/outreach/LinkedInExtensionInstallSteps'
import type { ExtensionConnectionStatus } from '@/lib/extension/linkedin/types'
import { cn } from '@/lib/utils'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, Link2, Plug, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'

async function fetchExtensionStatus(): Promise<ExtensionConnectionStatus> {
  const res = await fetch('/api/extension/linkedin/status', { cache: 'no-store' })
  const json = await res.json()
  if (!json.success) throw new Error(json.error ?? 'Could not check add-on status')
  return json.data as ExtensionConnectionStatus
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConnected?: () => void
}

export function LinkedInExtensionConnectPanel({ open, onOpenChange, onConnected }: Props) {
  const queryClient = useQueryClient()
  const [issuedToken, setIssuedToken] = useState<string | null>(null)
  const [isIssuing, setIsIssuing] = useState(false)
  const [isRevoking, setIsRevoking] = useState(false)

  const signInAddress =
    typeof window !== 'undefined' ? window.location.origin : 'your Vantera sign-in link'

  const { data: status, isFetching, refetch } = useQuery({
    queryKey: ['linkedin-extension-status'],
    queryFn: fetchExtensionStatus,
    enabled: open,
  })

  async function issueToken() {
    setIsIssuing(true)
    try {
      const res = await fetch('/api/extension/linkedin/token', { method: 'POST' })
      const json = await res.json()
      if (!json.success) {
        toast.error(json.error ?? 'Could not create connection code')
        return
      }
      setIssuedToken(json.data.token as string)
      toast.success('Connection code ready — paste it into the LinkedIn add-on')
      void queryClient.invalidateQueries({ queryKey: ['linkedin-extension-status'] })
      void queryClient.invalidateQueries({ queryKey: ['linkedin-outreach-hub'] })
    } catch {
      toast.error('Could not create connection code')
    } finally {
      setIsIssuing(false)
    }
  }

  async function revokeToken() {
    setIsRevoking(true)
    try {
      const res = await fetch('/api/extension/linkedin/token/revoke', { method: 'POST' })
      const json = await res.json()
      if (!json.success) {
        toast.error(json.error ?? 'Could not disconnect add-on')
        return
      }
      setIssuedToken(null)
      toast.success('LinkedIn add-on disconnected')
      void queryClient.invalidateQueries({ queryKey: ['linkedin-extension-status'] })
      void queryClient.invalidateQueries({ queryKey: ['linkedin-outreach-hub'] })
      onConnected?.()
    } catch {
      toast.error('Could not disconnect add-on')
    } finally {
      setIsRevoking(false)
    }
  }

  async function copyToken() {
    if (!issuedToken) return
    try {
      await navigator.clipboard.writeText(issuedToken)
      toast.success('Connection code copied')
    } catch {
      toast.error('Could not copy — try selecting the text manually')
    }
  }

  async function copySignInAddress() {
    try {
      await navigator.clipboard.writeText(signInAddress)
      toast.success('Vantera web address copied')
    } catch {
      toast.error('Could not copy')
    }
  }

  const connected = status?.connected ?? false

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-[var(--border-default)] bg-[var(--bg-elevated)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plug className="h-4 w-4 text-[var(--accent)]" aria-hidden />
            Set up the Vantera LinkedIn add-on
          </DialogTitle>
          <DialogDescription>
            Links your LinkedIn account to Vantera so you can send connection notes from the same
            queue as your outreach agent. Email still sends automatically from Vantera; LinkedIn
            messages are sent by you on LinkedIn, with pacing and tracking here.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-[13px]">
          <div
            className={cn(
              'flex items-center justify-between rounded-lg border px-3 py-2',
              connected
                ? 'border-[var(--success-muted)] bg-[var(--success-muted)]/30'
                : 'border-[var(--border-subtle)] bg-[var(--bg-subtle)]',
            )}
          >
            <span className="flex items-center gap-2 font-medium text-[var(--text-primary)]">
              <Link2 className="h-3.5 w-3.5" aria-hidden />
              {connected ? 'Add-on is connected' : 'Add-on not connected yet'}
            </span>
            <Button type="button" variant="ghost" size="sm" disabled={isFetching} onClick={() => void refetch()}>
              <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
            </Button>
          </div>

          {status?.hasToken && status.tokenPrefix ? (
            <p className="text-[var(--text-secondary)]">
              Connection code on file (starts with{' '}
              <span className="font-mono text-[var(--text-primary)]">{status.tokenPrefix}…</span>)
              {status.lastSeenAt ? (
                <>
                  {' '}
                  · last active {new Date(status.lastSeenAt).toLocaleString()}
                </>
              ) : null}
            </p>
          ) : null}

          <LinkedInExtensionInstallSteps />

          <ol className="list-decimal space-y-3 pl-5 text-[var(--text-secondary)]">
            <li>
              <span className="font-medium text-[var(--text-primary)]">Get a connection code</span> with
              the button below, then paste it into the add-on when it asks for your code.
            </li>
            <li>
              <span className="font-medium text-[var(--text-primary)]">Enter your Vantera web address</span>{' '}
              in the add-on — the same link you use to sign in to this dashboard:
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-2 py-1 font-mono text-[12px] text-[var(--text-primary)]">
                  {signInAddress}
                </span>
                <Button type="button" variant="outline" size="sm" onClick={() => void copySignInAddress()}>
                  <Copy className="mr-1 h-3 w-3" />
                  Copy address
                </Button>
              </div>
            </li>
            <li>
              <span className="font-medium text-[var(--text-primary)]">Choose how outreach runs.</span>{' '}
              With <span className="font-medium text-[var(--text-primary)]">Automatic</span> turned on
              (in Outreach → Agents), the add-on can open the next person in your queue for you. With{' '}
              <span className="font-medium text-[var(--text-primary)]">Review before send</span>, you
              approve messages in Message Drafter or the list below, then send on LinkedIn and mark
              them done in the add-on or here.
            </li>
          </ol>

          {issuedToken ? (
            <div className="space-y-2">
              <Label htmlFor="extension-token">Your connection code (copy now — we only show it once)</Label>
              <div className="flex gap-2">
                <Input id="extension-token" readOnly value={issuedToken} className="font-mono text-[12px]" />
                <Button type="button" variant="outline" size="icon" onClick={() => void copyToken()}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : null}

          <p className="text-[12px] text-[var(--text-tertiary)]">
            Full walkthrough in the{' '}
            <Link
              href="/admin/help?article=linkedin-outreach"
              className="font-medium text-[var(--accent)] hover:underline"
              onClick={() => onOpenChange(false)}
            >
              Help Center → Set up LinkedIn outreach
            </Link>
            .
          </p>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {status?.hasToken ? (
            <Button type="button" variant="outline" disabled={isRevoking} onClick={() => void revokeToken()}>
              Disconnect add-on
            </Button>
          ) : null}
          <Button
            type="button"
            className="bg-[var(--accent)] hover:bg-[var(--accent-hover)]"
            disabled={isIssuing}
            onClick={() => void issueToken()}
          >
            {issuedToken ? (
              <>
                <Check className="mr-1.5 h-4 w-4" />
                Code created
              </>
            ) : (
              'Get connection code'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
