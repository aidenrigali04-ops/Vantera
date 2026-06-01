'use client'

import { CampaignAspireFinder } from '@/components/aspire/CampaignAspireFinder'
import { KpiStrip } from '@/components/operational/KpiStrip'
import { PageHeader } from '@/components/operational/PageHeader'
import { StatusBadge } from '@/components/operational/table/StatusBadge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  draftCampaignMessage,
  enrollLeadsInCampaign,
  launchOutreachCampaign,
  markCampaignEnrollmentMeeting,
  markCampaignEnrollmentReplied,
  pauseOutreachCampaign,
  saveCampaignMessage,
} from '@/lib/outreach/actions'
import {
  CAMPAIGN_GOAL_LABELS,
  type CampaignWithStats,
  type EnrollmentWithLead,
  type LeadRow,
} from '@/lib/outreach/types'
import { cn } from '@/lib/utils'
import {
  ArrowLeft,
  CalendarCheck,
  Loader2,
  Mail,
  MessageSquare,
  Pause,
  Rocket,
  Sparkles,
  Users,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'

type Props = {
  campaign: CampaignWithStats
  enrollments: EnrollmentWithLead[]
  leads: LeadRow[]
}

type WizardStep = 'audience' | 'message' | 'launch' | 'results'

function leadName(lead: Pick<LeadRow, 'firstName' | 'lastName' | 'company'>) {
  const name = [lead.firstName, lead.lastName].filter(Boolean).join(' ')
  return name || lead.company || 'Unknown lead'
}

export function CampaignDetailClient({ campaign, enrollments, leads }: Props) {
  const router = useRouter()
  const isDraft = campaign.status === 'draft'
  const isActive = campaign.status === 'active' || campaign.status === 'paused'

  const initialStep: WizardStep = isDraft
    ? enrollments.length === 0
      ? 'audience'
      : 'message'
    : 'results'

  const [step, setStep] = useState<WizardStep>(initialStep)
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([])
  const [subject, setSubject] = useState(campaign.workflow.steps[0]?.subject ?? '')
  const [body, setBody] = useState(campaign.workflow.steps[0]?.body ?? '')
  const [draftRationale, setDraftRationale] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const leadsWithEmail = useMemo(() => leads.filter((lead) => lead.email), [leads])
  const sampleLead = leadsWithEmail[0] ?? enrollments[0]?.lead

  const kpiItems = [
    { label: 'Enrolled', value: campaign.metrics.enrolled, icon: Users },
    { label: 'Sent', value: campaign.metrics.sent, icon: Mail },
    { label: 'Replied', value: campaign.metrics.replied, icon: MessageSquare },
    { label: 'Meetings', value: campaign.metrics.meetings, icon: CalendarCheck },
  ]

  function toggleLead(leadId: string) {
    setSelectedLeadIds((current) =>
      current.includes(leadId) ? current.filter((id) => id !== leadId) : [...current, leadId],
    )
  }

  function handleEnroll() {
    startTransition(async () => {
      const result = await enrollLeadsInCampaign(campaign.id, selectedLeadIds)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success(`Enrolled ${result.data.enrolled} lead${result.data.enrolled === 1 ? '' : 's'}`)
      setSelectedLeadIds([])
      setStep('message')
      router.refresh()
    })
  }

  function handleSaveMessage() {
    startTransition(async () => {
      const result = await saveCampaignMessage({
        campaignId: campaign.id,
        subject,
        body,
      })
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success('Message saved')
      setStep('launch')
      router.refresh()
    })
  }

  function handleDraft() {
    if (!sampleLead) {
      toast.error('Add a lead with an email before drafting')
      return
    }

    startTransition(async () => {
      const result = await draftCampaignMessage(campaign.id, sampleLead.id)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      setSubject(result.data.subject)
      setBody(result.data.body)
      setDraftRationale(result.data.rationale)
      toast.success('Draft ready — edit before sending')
    })
  }

  function handleLaunch() {
    startTransition(async () => {
      const result = await launchOutreachCampaign(campaign.id)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success(`Launched — ${result.data.sent} email${result.data.sent === 1 ? '' : 's'} sent`)
      setStep('results')
      router.refresh()
    })
  }

  function handlePause() {
    startTransition(async () => {
      const result = await pauseOutreachCampaign(campaign.id)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success('Campaign paused')
      router.refresh()
    })
  }

  function handleMarkReplied(enrollmentId: string) {
    startTransition(async () => {
      const result = await markCampaignEnrollmentReplied(enrollmentId)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success('Marked as replied')
      router.refresh()
    })
  }

  function handleMarkMeeting(enrollmentId: string) {
    startTransition(async () => {
      const result = await markCampaignEnrollmentMeeting(enrollmentId)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success('Meeting booked')
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-stone-500">
        <Link
          href="/admin/outreach/campaigns"
          className="inline-flex items-center gap-1 hover:text-stone-800"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Campaigns
        </Link>
      </div>

      <PageHeader
        title={campaign.name}
        description={`${CAMPAIGN_GOAL_LABELS[campaign.goal]} · Email`}
        actions={
          isActive ? (
            campaign.status === 'active' ? (
              <Button variant="outline" onClick={handlePause} disabled={isPending}>
                <Pause className="mr-1.5 h-4 w-4" />
                Pause
              </Button>
            ) : null
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge label={campaign.status} tone={campaign.status === 'active' ? 'success' : 'neutral'} />
        {isDraft ? (
          <>
            {(['audience', 'message', 'launch'] as const).map((wizardStep, index) => (
              <span
                key={wizardStep}
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-[11px] font-medium',
                  step === wizardStep
                    ? 'bg-violet-100 text-violet-800'
                    : 'bg-stone-100 text-stone-500',
                )}
              >
                {index + 1}. {wizardStep}
              </span>
            ))}
          </>
        ) : null}
      </div>

      {isActive || step === 'results' ? <KpiStrip items={kpiItems} className="lg:grid-cols-4" /> : null}

      {isDraft && step === 'audience' ? (
        <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-stone-900">Select leads</h3>
          <p className="mt-1 text-sm text-stone-500">
            Choose from your pipeline, or find new ICP-matched prospects with Aspire below.
          </p>

          <CampaignAspireFinder
            campaignId={campaign.id}
            onEnrolled={() => {
              setStep('message')
              router.refresh()
            }}
          />

          <div className="my-5 border-t border-stone-100 pt-5">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-stone-500">
              Or pick from pipeline
            </p>
            <div className="max-h-80 space-y-2 overflow-y-auto">
            {leadsWithEmail.length === 0 ? (
              <p className="text-sm text-stone-500">
                No leads with email yet.{' '}
                <Link href="/admin/pipeline" className="text-violet-700 hover:underline">
                  Add leads in Pipeline
                </Link>
              </p>
            ) : (
              leadsWithEmail.map((lead) => (
                <label
                  key={lead.id}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-stone-100 px-3 py-2.5 hover:bg-stone-50"
                >
                  <Checkbox
                    checked={selectedLeadIds.includes(lead.id)}
                    onCheckedChange={() => toggleLead(lead.id)}
                  />
                  <span>
                    <span className="block text-sm font-medium text-stone-900">{leadName(lead)}</span>
                    <span className="block text-xs text-stone-500">
                      {[lead.title, lead.company, lead.email].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </label>
              ))
            )}
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Button
              onClick={handleEnroll}
              disabled={isPending || selectedLeadIds.length === 0}
            >
              {isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Continue to message
            </Button>
          </div>
        </section>
      ) : null}

      {isDraft && step === 'message' ? (
        <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-stone-900">Write your email</h3>
              <p className="mt-1 text-sm text-stone-500">
                Use {'{{first_name}}'} and {'{{company}}'} — we personalize at send time.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleDraft} disabled={isPending}>
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              AI draft
            </Button>
          </div>

          {draftRationale ? (
            <p className="mt-3 rounded-lg bg-violet-50 px-3 py-2 text-xs text-violet-800">
              {draftRationale}
            </p>
          ) : null}

          <div className="mt-4 space-y-3">
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Quick idea for {{company}}"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="body">Message</Label>
              <Textarea
                id="body"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                rows={10}
                placeholder="Hi {{first_name}}, ..."
              />
            </div>
          </div>

          <div className="mt-4 flex justify-between gap-2">
            <Button variant="outline" onClick={() => setStep('audience')}>
              Back
            </Button>
            <Button onClick={handleSaveMessage} disabled={isPending || !subject.trim() || !body.trim()}>
              Continue to launch
            </Button>
          </div>
        </section>
      ) : null}

      {isDraft && step === 'launch' ? (
        <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-stone-900">Ready to launch</h3>
          <p className="mt-1 text-sm text-stone-500">
            {campaign.metrics.enrolled} lead{campaign.metrics.enrolled === 1 ? '' : 's'} enrolled.
            Immediate sends go out now; scheduled steps run via cron.
          </p>

          <div className="mt-4 rounded-lg border border-stone-100 bg-stone-50/80 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-stone-500">Preview</p>
            <p className="mt-2 text-sm font-medium text-stone-900">{subject}</p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-stone-600">{body}</p>
          </div>

          <div className="mt-4 flex justify-between gap-2">
            <Button variant="outline" onClick={() => setStep('message')}>
              Back
            </Button>
            <Button onClick={handleLaunch} disabled={isPending}>
              <Rocket className="mr-1.5 h-4 w-4" />
              Launch campaign
            </Button>
          </div>
        </section>
      ) : null}

      {(isActive || step === 'results') && enrollments.length > 0 ? (
        <section className="rounded-xl border border-stone-200 bg-white shadow-sm">
          <div className="border-b border-stone-100 px-5 py-4">
            <h3 className="text-sm font-semibold text-stone-900">Results by lead</h3>
            <p className="mt-0.5 text-sm text-stone-500">
              Email replies are detected automatically when Resend inbound is configured.
              Use &quot;Book meeting&quot; when a reply converts to a scheduled call.
            </p>
          </div>
          <table className="min-w-full divide-y divide-stone-100 text-sm">
            <thead className="bg-stone-50/80">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-stone-500">Lead</th>
                <th className="px-4 py-3 text-left font-medium text-stone-500">Status</th>
                <th className="px-4 py-3 text-right font-medium text-stone-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {enrollments.map((enrollment) => (
                <tr key={enrollment.id}>
                  <td className="px-4 py-3">
                    <span className="font-medium text-stone-900">{leadName(enrollment.lead)}</span>
                    <span className="block text-xs text-stone-500">{enrollment.lead.email}</span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      label={enrollment.status}
                      tone={
                        enrollment.status === 'replied' || enrollment.status === 'completed'
                          ? 'success'
                          : 'neutral'
                      }
                    />
                    {enrollment.repliedAt ? (
                      <span className="mt-1 block text-xs text-stone-500">
                        Replied {new Date(enrollment.repliedAt).toLocaleString()}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {enrollment.status === 'active' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isPending}
                          onClick={() => handleMarkReplied(enrollment.id)}
                        >
                          Mark replied
                        </Button>
                      ) : null}
                      {enrollment.status === 'active' || enrollment.status === 'replied' ? (
                        <Button
                          size="sm"
                          disabled={isPending}
                          onClick={() => handleMarkMeeting(enrollment.id)}
                        >
                          Book meeting
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  )
}
