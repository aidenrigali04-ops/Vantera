'use client'

import { LinkedInExtensionConnectPanel } from '@/components/outreach/LinkedInExtensionConnectPanel'
import { LinkedInSetupPipeline } from '@/components/outreach/LinkedInSetupPipeline'
import { KpiStrip } from '@/components/operational/KpiStrip'
import { PageHeader } from '@/components/operational/PageHeader'
import { StatusBadge } from '@/components/operational/table/StatusBadge'
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
import { createOutreachCampaign } from '@/lib/outreach/actions'
import {
  LINKEDIN_DELIVERY_LABELS,
  type CampaignDeliveryMode,
} from '@/lib/outreach/campaign-draft-guidelines'
import type { LinkedInOutreachHubSnapshot } from '@/lib/outreach/linkedin-hub'
import {
  CAMPAIGN_GOAL_LABELS,
  type OutreachCampaignGoal,
} from '@/lib/outreach/types'
import { cn } from '@/lib/utils'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import {
  ArrowRight,
  ClipboardCopy,
  ExternalLink,
  Link2,
  Plus,
  RefreshCw,
  Target,
  Users,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

type Props = {
  initialHub: LinkedInOutreachHubSnapshot
}

const GOALS: OutreachCampaignGoal[] = ['book_meeting', 'fill_funnel', 're_engage']

const LINKEDIN_MODES: CampaignDeliveryMode[] = ['linkedin_sequence', 'single_linkedin']

async function fetchLinkedInHub(): Promise<LinkedInOutreachHubSnapshot> {
  const res = await fetch('/api/outreach/linkedin-hub', { cache: 'no-store' })
  const json = await res.json()
  if (!json.success) throw new Error(json.error ?? 'Could not refresh LinkedIn hub')
  return json.data as LinkedInOutreachHubSnapshot
}

export function LinkedInOutreachPageClient({ initialHub }: Props) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [connectOpen, setConnectOpen] = useState(false)
  const [name, setName] = useState('')
  const [goal, setGoal] = useState<OutreachCampaignGoal>('book_meeting')
  const [deliveryMode, setDeliveryMode] = useState<CampaignDeliveryMode>('single_linkedin')
  const [isPending, startTransition] = useTransition()

  const { data: hub = initialHub, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ['linkedin-outreach-hub'],
    queryFn: fetchLinkedInHub,
    initialData: initialHub,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  })

  function handleCreate() {
    startTransition(async () => {
      const result = await createOutreachCampaign({
        name,
        goal,
        deliveryMode,
        channelFocus: 'linkedin',
      })
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success('LinkedIn campaign created')
      setCreateOpen(false)
      setName('')
      router.push(`/admin/outreach/campaigns/${result.data.id}`)
    })
  }

  async function copyMessage(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Copied to clipboard')
    } catch {
      toast.error('Could not copy')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="LinkedIn outreach"
        description="Connection notes and LinkedIn-only sequences — separate from email. See who is ready to message on LinkedIn, with AI-drafted notes."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-[var(--border-default)]"
              disabled={isFetching}
              onClick={() =>
                void queryClient.invalidateQueries({ queryKey: ['linkedin-outreach-hub'] })
              }
            >
              <RefreshCw className={cn('mr-1.5 h-4 w-4', isFetching && 'animate-spin')} />
              Refresh
            </Button>
            <Button
              size="sm"
              className="bg-[var(--accent)] hover:bg-[var(--accent-hover)]"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              New LinkedIn campaign
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2 text-[12px] text-[var(--text-tertiary)]">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-medium ring-1 ring-inset',
            hub.connectionStatus === 'connected'
              ? 'bg-[var(--success-muted)] text-[var(--success)] ring-transparent'
              : 'bg-[var(--warning-muted)] text-[var(--warning)] ring-transparent',
          )}
        >
          <Link2 className="h-3 w-3" aria-hidden />
          LinkedIn add-on: {hub.connectionStatus === 'connected' ? 'Connected' : 'Not set up'}
        </span>
        <button
          type="button"
          className="font-medium text-[var(--accent)] hover:underline"
          onClick={() => setConnectOpen(true)}
        >
          Set up LinkedIn add-on
        </button>
        <a
          href="/vantera-linkedin-extension.zip"
          download="vantera-linkedin-extension.zip"
          className="font-medium text-[var(--accent)] hover:underline"
        >
          Download add-on
        </a>
        <Link
          href="/admin/help?article=linkedin-outreach"
          className="font-medium text-[var(--accent)] hover:underline"
        >
          Setup guide
        </Link>
        {dataUpdatedAt ? (
          <span className="ml-auto tabular-nums">
            Updated {formatDistanceToNow(dataUpdatedAt, { addSuffix: true })}
          </span>
        ) : null}
      </div>

      <section className="card-surface border-[var(--border-subtle)] p-4">
        <p className="text-[13px] text-[var(--text-secondary)]">
          Email outreach is separate —{' '}
          <Link href="/admin/outreach/email" className="font-medium text-[var(--accent)] hover:underline">
            open email hub
          </Link>{' '}
          for domain setup, sequences, and automated sends.
        </p>
      </section>

      <LinkedInSetupPipeline steps={hub.setupSteps} progress={hub.setupProgress} />

      <KpiStrip
        items={[
          { label: 'Active campaigns', value: hub.kpis.activeCampaigns, icon: Link2 },
          { label: 'Waiting on LinkedIn', value: hub.kpis.manualQueue, icon: ClipboardCopy },
          { label: 'Leads w/ LinkedIn', value: hub.kpis.leadsWithLinkedIn, icon: Users },
          { label: 'Pipeline adds (today)', value: hub.kpis.enrolledThisWeek, icon: Target },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-12">
        <section className="card-surface overflow-hidden xl:col-span-7">
          <div className="border-b border-[var(--border-subtle)] px-5 py-4">
            <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">Ready to send on LinkedIn</h2>
            <p className="mt-0.5 text-[13px] text-[var(--text-secondary)]">
              Copy the note, send it on LinkedIn, then mark it done here or in the Vantera LinkedIn add-on.
            </p>
          </div>
          {hub.manualQueue.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-sm font-medium text-[var(--text-primary)]">Queue is clear</p>
              <p className="mx-auto mt-1 max-w-sm text-[13px] text-[var(--text-secondary)]">
                Launch a LinkedIn campaign to populate connection notes here.
              </p>
              <Button className="mt-4" size="sm" onClick={() => setCreateOpen(true)}>
                New LinkedIn campaign
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {hub.manualQueue.map((item) => (
                <li key={item.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-[var(--text-primary)]">{item.leadName}</p>
                      <p className="text-[12px] text-[var(--text-secondary)]">{item.campaignName}</p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void copyMessage(item.message)}
                      >
                        <ClipboardCopy className="mr-1 h-3.5 w-3.5" />
                        Copy
                      </Button>
                      {item.linkedinUrl ? (
                        <Button variant="outline" size="sm" asChild>
                          <a href={item.linkedinUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="mr-1 h-3.5 w-3.5" />
                            LinkedIn
                          </a>
                        </Button>
                      ) : null}
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={item.href}>
                          Campaign
                          <ArrowRight className="ml-1 h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                  <p className="mt-2 line-clamp-3 whitespace-pre-wrap rounded-lg bg-[var(--bg-subtle)] px-3 py-2 font-mono text-[12px] text-[var(--text-secondary)]">
                    {item.message}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card-surface overflow-hidden xl:col-span-5">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-5 py-4">
            <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">LinkedIn campaigns</h2>
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/outreach/campaigns?channel=linkedin">All LinkedIn campaigns</Link>
            </Button>
          </div>
          {hub.recentCampaigns.length === 0 ? (
            <p className="px-5 py-10 text-center text-[13px] text-[var(--text-secondary)]">
              No LinkedIn campaigns yet.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {hub.recentCampaigns.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/admin/outreach/campaigns/${c.id}`}
                    className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-[var(--bg-overlay)]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-[var(--text-primary)]">
                        {c.name}
                      </p>
                      <p className="text-[11px] text-[var(--text-tertiary)]">
                        {LINKEDIN_DELIVERY_LABELS[
                          c.deliveryMode as keyof typeof LINKEDIN_DELIVERY_LABELS
                        ] ?? c.deliveryMode}
                      </p>
                    </div>
                    <StatusBadge
                      tone={c.status === 'active' ? 'success' : 'neutral'}
                      label={c.status}
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card-surface p-5">
        <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">Also on Vantera</h2>
        <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
          Email outreach lives on a separate tab — domain DNS, one-time email, and email sequences.
        </p>
        <Button className="mt-4" variant="outline" size="sm" asChild>
          <Link href="/admin/outreach/email">Open email outreach</Link>
        </Button>
      </section>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New LinkedIn campaign</DialogTitle>
            <DialogDescription>
              LinkedIn-only — not mixed with email. Choose a one-time note or a timed sequence.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="li-campaign-name">Name</Label>
              <Input
                id="li-campaign-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1.5"
                placeholder="Q2 connection push"
              />
            </div>
            <div>
              <Label>Delivery</Label>
              <div className="mt-2 grid gap-2">
                {LINKEDIN_MODES.map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setDeliveryMode(mode)}
                    className={cn(
                      'rounded-lg border px-3 py-2.5 text-left text-sm transition-colors',
                      deliveryMode === mode
                        ? 'border-violet-300 bg-violet-50/80'
                        : 'border-stone-200 hover:border-stone-300',
                    )}
                  >
                    <span className="font-medium text-stone-900">
                      {LINKEDIN_DELIVERY_LABELS[mode as keyof typeof LINKEDIN_DELIVERY_LABELS]}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Goal</Label>
              <div className="mt-2 grid gap-2">
                {GOALS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setGoal(option)}
                    className={cn(
                      'rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                      goal === option
                        ? 'border-violet-300 bg-violet-50/80'
                        : 'border-stone-200',
                    )}
                  >
                    {CAMPAIGN_GOAL_LABELS[option]}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isPending || !name.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LinkedInExtensionConnectPanel
        open={connectOpen}
        onOpenChange={setConnectOpen}
        onConnected={() =>
          void queryClient.invalidateQueries({ queryKey: ['linkedin-outreach-hub'] })
        }
      />
    </div>
  )
}
