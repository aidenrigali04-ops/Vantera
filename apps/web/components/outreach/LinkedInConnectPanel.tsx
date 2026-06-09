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
import { cn } from '@/lib/utils'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, ExternalLink, Link2, Loader2, RefreshCw, Unlink } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

type ConnectionStatus = {
  connected: boolean
  status: string
  unipileAccountId?: string
  connectedAt?: string | null
  lastError?: string | null
}

async function fetchStatus(): Promise<ConnectionStatus> {
  const res = await fetch('/api/integrations/unipile/status', { cache: 'no-store' })
  const json = await res.json()
  if (!json.success) throw new Error(json.error ?? 'Could not check LinkedIn status')
  return json.data as ConnectionStatus
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConnected?: () => void
}

export function LinkedInConnectPanel({ open, onOpenChange, onConnected }: Props) {
  const queryClient = useQueryClient()
  const [isConnecting, setIsConnecting] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)

  const { data: status, isFetching, refetch } = useQuery({
    queryKey: ['unipile-linkedin-status'],
    queryFn: fetchStatus,
    enabled: open,
    refetchInterval: isConnecting ? 3_000 : false,
  })

  const connected = status?.connected ?? false

  async function openConnectFlow() {
    setIsConnecting(true)
    try {
      const res = await fetch('/api/integrations/unipile/connect', { method: 'POST' })
      const json = await res.json()
      if (!json.success) {
        toast.error(json.error ?? 'Could not start LinkedIn connection')
        setIsConnecting(false)
        return
      }
      // Open Unipile hosted auth in a new tab
      window.open(json.data.url, '_blank', 'noopener,noreferrer')
      toast.info('Complete the connection in the new tab, then return here.')
      // polling via refetchInterval will pick up the connection
    } catch {
      toast.error('Could not start LinkedIn connection')
      setIsConnecting(false)
    }
  }

  async function disconnect() {
    setIsDisconnecting(true)
    try {
      const res = await fetch('/api/integrations/unipile/disconnect', { method: 'POST' })
      const json = await res.json()
      if (!json.success) {
        toast.error(json.error ?? 'Could not disconnect LinkedIn')
        return
      }
      toast.success('LinkedIn disconnected')
      void queryClient.invalidateQueries({ queryKey: ['unipile-linkedin-status'] })
      void queryClient.invalidateQueries({ queryKey: ['linkedin-outreach-hub'] })
    } catch {
      toast.error('Could not disconnect LinkedIn')
    } finally {
      setIsDisconnecting(false)
    }
  }

  // Stop polling once connected and fire callback
  if (connected && isConnecting) {
    setIsConnecting(false)
    void queryClient.invalidateQueries({ queryKey: ['linkedin-outreach-hub'] })
    onConnected?.()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-[var(--border-default)] bg-[var(--bg-elevated)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-[var(--accent)]" aria-hidden />
            Connect LinkedIn
          </DialogTitle>
          <DialogDescription>
            Link your LinkedIn account to Vantera. Connection requests and DMs will be sent
            automatically — no extension, no copy-paste.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-[13px]">
          {/* Status strip */}
          <div
            className={cn(
              'flex items-center justify-between rounded-lg border px-3 py-2.5',
              connected
                ? 'border-emerald-500/30 bg-emerald-500/10'
                : 'border-[var(--border-subtle)] bg-[var(--bg-subtle)]',
            )}
          >
            <span className="flex items-center gap-2 font-medium text-[var(--text-primary)]">
              {connected ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden />
              ) : (
                <Link2 className="h-4 w-4 text-[var(--text-disabled)]" aria-hidden />
              )}
              {connected ? 'LinkedIn connected' : 'Not connected'}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isFetching}
              onClick={() => void refetch()}
              aria-label="Refresh status"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
            </Button>
          </div>

          {connected && status?.connectedAt ? (
            <p className="text-[var(--text-tertiary)]">
              Connected{' '}
              {new Date(status.connectedAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
          ) : null}

          {status?.lastError ? (
            <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-[12px] text-red-400">
              Last error: {status.lastError}
            </p>
          ) : null}

          {!connected && (
            <ol className="list-decimal space-y-2.5 pl-5 text-[var(--text-secondary)]">
              <li>
                Click <span className="font-medium text-[var(--text-primary)]">Connect LinkedIn</span>{' '}
                below — a new tab opens with a secure login page.
              </li>
              <li>
                Log in with your LinkedIn credentials on that page. Vantera never sees your
                password.
              </li>
              <li>
                Return to this tab. The status above will update to{' '}
                <span className="font-medium text-emerald-400">Connected</span> automatically.
              </li>
            </ol>
          )}

          {connected && (
            <p className="text-[var(--text-secondary)]">
              LinkedIn is sending automatically. Connection requests and follow-up messages are
              delivered via Vantera — you can monitor them in the LinkedIn hub.
            </p>
          )}

          {isConnecting && (
            <p className="flex items-center gap-1.5 text-[12px] text-[var(--text-tertiary)]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Waiting for you to complete the connection in the new tab…
            </p>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {connected ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isDisconnecting}
              onClick={() => void disconnect()}
              className="gap-1.5 text-red-400 hover:text-red-300"
            >
              <Unlink className="h-3.5 w-3.5" />
              {isDisconnecting ? 'Disconnecting…' : 'Disconnect'}
            </Button>
          ) : null}
          <Button
            type="button"
            className="gap-1.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)]"
            disabled={isConnecting || connected}
            onClick={() => void openConnectFlow()}
          >
            {isConnecting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Connecting…
              </>
            ) : connected ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Connected
              </>
            ) : (
              <>
                <ExternalLink className="h-4 w-4" />
                Connect LinkedIn
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
