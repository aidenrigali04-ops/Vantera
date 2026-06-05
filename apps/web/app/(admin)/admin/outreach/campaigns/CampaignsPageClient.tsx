'use client'

import { createOutreachCampaign } from '@/lib/outreach/actions'
import {
  EMAIL_DELIVERY_LABELS,
  LINKEDIN_DELIVERY_LABELS,
  type CampaignDeliveryMode,
} from '@/lib/outreach/campaign-draft-guidelines'
import {
  CAMPAIGN_GOAL_LABELS,
  type CampaignWithStats,
  type OutreachCampaignGoal,
} from '@/lib/outreach/types'
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
import { cn } from '@/lib/utils'
import { CalendarCheck, Megaphone, Plus, Target, Users } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

type Props = {
  campaigns: CampaignWithStats[]
  defaultChannel?: 'email' | 'linkedin'
}

const GOALS: OutreachCampaignGoal[] = ['book_meeting', 'fill_funnel', 're_engage']

function campaignStatusTone(status: CampaignWithStats['status']) {
  switch (status) {
    case 'active':
      return 'success' as const
    case 'draft':
      return 'neutral' as const
    case 'paused':
      return 'warning' as const
    case 'completed':
      return 'info' as const
    default:
      return 'neutral' as const
  }
}

export function CampaignsPageClient({ campaigns, defaultChannel = 'email' }: Props) {
  const router = useRouter()
  const isLinkedIn = defaultChannel === 'linkedin'
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [goal, setGoal] = useState<OutreachCampaignGoal>('book_meeting')
  const [deliveryMode, setDeliveryMode] = useState<CampaignDeliveryMode>(
    isLinkedIn ? 'single_linkedin' : 'sequence',
  )
  const [isPending, startTransition] = useTransition()

  const deliveryLabels = isLinkedIn ? LINKEDIN_DELIVERY_LABELS : EMAIL_DELIVERY_LABELS
  const deliveryOptions = (
    isLinkedIn
      ? (['linkedin_sequence', 'single_linkedin'] as const)
      : (['sequence', 'single_email'] as const)
  )

  function handleCreate() {
    startTransition(async () => {
      const result = await createOutreachCampaign({
        name,
        goal,
        deliveryMode,
        channelFocus: isLinkedIn ? 'linkedin' : 'email',
      })
      if (!result.success) {
        toast.error(result.error)
        return
      }

      toast.success('Campaign created')
      setOpen(false)
      setName('')
      router.push(`/admin/outreach/campaigns/${result.data.id}`)
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={isLinkedIn ? 'LinkedIn campaigns' : 'Email campaigns'}
        description={
          isLinkedIn
            ? 'Connection notes and LinkedIn-only sequences — send on LinkedIn from the LinkedIn hub.'
            : 'Goal-based email outreach — domain, audience, message, and results in one flow.'
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={isLinkedIn ? '/admin/outreach/linkedin' : '/admin/outreach/email'}>
                Back to {isLinkedIn ? 'LinkedIn' : 'email'} hub
              </Link>
            </Button>
            <Button onClick={() => setOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              New {isLinkedIn ? 'LinkedIn' : 'email'} campaign
            </Button>
          </div>
        }
      />

      {campaigns.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-200 bg-stone-50/50 px-6 py-12 text-center">
          <Megaphone className="mx-auto h-8 w-8 text-stone-300" />
          <h3 className="mt-3 text-sm font-medium text-stone-900">No campaigns yet</h3>
          <p className="mt-1 text-sm text-stone-500">
            Start with a goal, pick leads from your pipeline, draft a message, and launch.
          </p>
          <Button className="mt-4" onClick={() => setOpen(true)}>
            Create your first campaign
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-stone-100 text-sm">
            <thead className="bg-stone-50/80">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-stone-500">Campaign</th>
                <th className="px-4 py-3 text-left font-medium text-stone-500">Goal</th>
                <th className="px-4 py-3 text-left font-medium text-stone-500">Status</th>
                <th className="px-4 py-3 text-right font-medium text-stone-500">Enrolled</th>
                <th className="px-4 py-3 text-right font-medium text-stone-500">Sent</th>
                <th className="px-4 py-3 text-right font-medium text-stone-500">Replied</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {campaigns.map((campaign) => (
                <tr key={campaign.id} className="hover:bg-stone-50/60">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/outreach/campaigns/${campaign.id}`}
                      className="font-medium text-stone-900 hover:text-violet-700"
                    >
                      {campaign.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-stone-600">{CAMPAIGN_GOAL_LABELS[campaign.goal]}</td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      label={campaign.status}
                      tone={campaignStatusTone(campaign.status)}
                    />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-stone-700">
                    {campaign.metrics.enrolled}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-stone-700">
                    {campaign.metrics.sent}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-stone-700">
                    {campaign.metrics.replied}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New campaign</DialogTitle>
            <DialogDescription>
              Pick a goal — we&apos;ll tailor the message intent and success metrics.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="campaign-name">Campaign name</Label>
              <Input
                id="campaign-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Q2 outbound — agencies"
              />
            </div>

            <div className="space-y-2">
              <Label>Delivery</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {deliveryOptions.map((mode) => (
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
                      {deliveryLabels[mode as keyof typeof deliveryLabels]}
                    </span>
                    <span className="mt-0.5 block text-[12px] text-stone-500">
                      {mode === 'single_email'
                        ? 'One email to all leads — write your own copy + AI draft'
                        : mode === 'single_linkedin'
                          ? 'One connection note — you send on LinkedIn'
                          : isLinkedIn
                            ? 'LinkedIn-only timed steps — manual queue'
                            : 'Timed email, LinkedIn, and SMS steps'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Goal</Label>
              <div className="grid gap-2">
                {GOALS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setGoal(option)}
                    className={cn(
                      'flex items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors',
                      goal === option
                        ? 'border-violet-300 bg-violet-50/80'
                        : 'border-stone-200 hover:border-stone-300',
                    )}
                  >
                    {option === 'book_meeting' ? (
                      <CalendarCheck className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
                    ) : option === 'fill_funnel' ? (
                      <Users className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
                    ) : (
                      <Target className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
                    )}
                    <span>
                      <span className="block text-sm font-medium text-stone-900">
                        {CAMPAIGN_GOAL_LABELS[option]}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isPending}>
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
