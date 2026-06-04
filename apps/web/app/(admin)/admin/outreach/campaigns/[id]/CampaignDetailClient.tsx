'use client'

import { CampaignAspireFinder } from '@/components/aspire/CampaignAspireFinder'
import { CampaignSequenceBuilder } from '@/components/outreach/CampaignSequenceBuilder'
import { CampaignSingleEmailComposer } from '@/components/outreach/CampaignSingleEmailComposer'
import { CampaignSingleLinkedInComposer } from '@/components/outreach/CampaignSingleLinkedInComposer'
import { KpiStrip } from '@/components/operational/KpiStrip'
import { PageHeader } from '@/components/operational/PageHeader'
import { StatusBadge } from '@/components/operational/table/StatusBadge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  draftCampaignMessage,
  enrollLeadsInCampaign,
  launchOutreachCampaign,
  markCampaignEnrollmentMeeting,
  markCampaignEnrollmentReplied,
  markCampaignStepSent,
  pauseOutreachCampaign,
  saveCampaignDeliveryMode,
  saveCampaignWorkflow,
} from '@/lib/outreach/actions'
import {
  EMAIL_DELIVERY_LABELS,
  LINKEDIN_DELIVERY_LABELS,
  type CampaignDeliveryMode,
} from '@/lib/outreach/campaign-draft-guidelines'
import {
  CAMPAIGN_GOAL_LABELS,
  getCampaignChannelFocus,
  getCampaignDeliveryMode,
  type CampaignWithStats,
  type EnrollmentWithLead,
  type LeadRow,
  type OutreachStepRow,
} from '@/lib/outreach/types'
import { CHANNEL_LABELS, channelsFromWorkflow, validateWorkflowForLaunch } from '@/lib/outreach/workflow-templates'
import { cn } from '@/lib/utils'
import {
  ArrowLeft,
  CalendarCheck,
  Copy,
  ExternalLink,
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
import { useEffect, useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'

type Props = {
  campaign: CampaignWithStats
  enrollments: EnrollmentWithLead[]
  leads: LeadRow[]
  campaignSteps: OutreachStepRow[]
  channelFocus: 'email' | 'linkedin'
}

type WizardStep = 'audience' | 'message' | 'launch' | 'results'

function leadName(lead: Pick<LeadRow, 'firstName' | 'lastName' | 'company'>) {
  const name = [lead.firstName, lead.lastName].filter(Boolean).join(' ')
  return name || lead.company || 'Unknown lead'
}

function channelSummary(channels: string[]) {
  if (channels.length === 0) return 'Multi-channel'
  return channels.map((channel) => CHANNEL_LABELS[channel as keyof typeof CHANNEL_LABELS] ?? channel).join(' · ')
}

export function CampaignDetailClient({
  campaign,
  enrollments,
  leads,
  campaignSteps,
  channelFocus,
}: Props) {
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
  const [workflowSteps, setWorkflowSteps] = useState(campaign.workflow.steps)
  const [deliveryMode, setDeliveryMode] = useState(getCampaignDeliveryMode(campaign.workflow))
  const [draftStepIndex, setDraftStepIndex] = useState(0)
  const [draftRationale, setDraftRationale] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const isLinkedInHub = channelFocus === 'linkedin'
  const isSingleEmail = deliveryMode === 'single_email'
  const isSingleLinkedIn = deliveryMode === 'single_linkedin'
  const isLinkedInSequence = deliveryMode === 'linkedin_sequence'
  const deliveryLabels = isLinkedInHub ? LINKEDIN_DELIVERY_LABELS : EMAIL_DELIVERY_LABELS
  const deliveryModeOptions = (
    isLinkedInHub
      ? (['linkedin_sequence', 'single_linkedin'] as const)
      : (['sequence', 'single_email'] as const)
  )

  useEffect(() => {
    setWorkflowSteps(campaign.workflow.steps)
    setDeliveryMode(getCampaignDeliveryMode(campaign.workflow))
  }, [campaign.workflow, campaign.id, channelFocus])

  const enrollableLeads = useMemo(() => {
    if (isLinkedInHub) {
      return leads.filter((lead) => lead.linkedinUrl?.trim())
    }
    return leads.filter((lead) => lead.email || lead.phone || lead.linkedinUrl)
  }, [leads, isLinkedInHub])
  const sampleLead = enrollableLeads[0] ?? enrollments[0]?.lead

  const manualSteps = useMemo(
    () =>
      campaignSteps.filter((row) => {
        const metadata = row.metadata as { manualSend?: boolean; message?: string } | null
        return row.status === 'pending' && metadata?.manualSend
      }),
    [campaignSteps],
  )

  const launchPreviewError = validateWorkflowForLaunch({
    steps: workflowSteps,
    deliveryMode,
    channelFocus,
  })

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

  function handleSaveSequence() {
    if (launchPreviewError) {
      toast.error(launchPreviewError)
      return
    }

    startTransition(async () => {
      const result = await saveCampaignWorkflow({
        campaignId: campaign.id,
        steps:
          isSingleEmail || isSingleLinkedIn ? workflowSteps.slice(0, 1) : workflowSteps,
      })
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success('Sequence saved')
      setStep('launch')
      router.refresh()
    })
  }

  function handleDeliveryModeChange(mode: CampaignDeliveryMode) {
    startTransition(async () => {
      const result = await saveCampaignDeliveryMode(campaign.id, mode)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      setDeliveryMode(mode)
      router.refresh()
    })
  }

  function handleDraft() {
    if (!sampleLead) {
      toast.error('Add a lead before drafting')
      return
    }

    startTransition(async () => {
      const result = await draftCampaignMessage(campaign.id, sampleLead.id, draftStepIndex)
      if (!result.success) {
        toast.error(result.error)
        return
      }

      const stepChannel = workflowSteps[draftStepIndex]?.channel
      setWorkflowSteps((current) =>
        current.map((row, index) =>
          index === draftStepIndex
            ? {
                ...row,
                subject: stepChannel === 'email' ? result.data.subject : row.subject,
                body: result.data.body,
              }
            : row,
        ),
      )
      setDraftRationale(result.data.rationale)
      toast.success('Draft applied to selected step')
    })
  }

  function handleLaunch() {
    startTransition(async () => {
      const result = await launchOutreachCampaign(campaign.id)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      const parts = [`${result.data.sent} sent`]
      if (result.data.manualReady > 0) {
        parts.push(`${result.data.manualReady} LinkedIn ready`)
      }
      toast.success(`Launched — ${parts.join(', ')}`)
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

  function handleMarkStepSent(stepId: string) {
    startTransition(async () => {
      const result = await markCampaignStepSent(stepId)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success('Marked as sent')
      router.refresh()
    })
  }

  async function copyMessage(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Copied to clipboard')
    } catch {
      toast.error('Could not copy to clipboard')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-stone-500">
        <Link
          href={
            isLinkedInHub
              ? '/admin/outreach/campaigns?channel=linkedin'
              : '/admin/outreach/campaigns?channel=email'
          }
          className="inline-flex items-center gap-1 hover:text-stone-800"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {isLinkedInHub ? 'LinkedIn campaigns' : 'Email campaigns'}
        </Link>
      </div>

      <PageHeader
        title={campaign.name}
        description={`${CAMPAIGN_GOAL_LABELS[campaign.goal]} · ${channelSummary(channelsFromWorkflow(campaign.workflow))}`}
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
                {index + 1}.{' '}
                {wizardStep === 'message'
                  ? isSingleEmail
                    ? 'email'
                    : isSingleLinkedIn
                      ? 'note'
                      : isLinkedInHub
                        ? 'linkedin'
                        : 'sequence'
                  : wizardStep}
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
            {isLinkedInHub
              ? 'Leads must have a LinkedIn profile URL. Add URLs in Pipeline or pick prospects below.'
              : 'Choose from your pipeline, or find new ICP-matched prospects with Aspire below.'}
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
              {enrollableLeads.length === 0 ? (
                <p className="text-sm text-stone-500">
                  No leads with contact info yet.{' '}
                  <Link href="/admin/pipeline" className="text-violet-700 hover:underline">
                    Add leads in Pipeline
                  </Link>
                </p>
              ) : (
                enrollableLeads.map((lead) => (
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
                        {[lead.title, lead.company, lead.email, lead.phone, lead.linkedinUrl]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Button onClick={handleEnroll} disabled={isPending || selectedLeadIds.length === 0}>
              {isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Continue to{' '}
              {isSingleEmail ? 'email' : isSingleLinkedIn ? 'note' : isLinkedInHub ? 'linkedin' : 'sequence'}
            </Button>
          </div>
        </section>
      ) : null}

      {isDraft && step === 'message' ? (
        <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-stone-900">
                {isSingleLinkedIn
                  ? 'Write your connection note'
                  : isSingleEmail
                    ? 'Write your email'
                    : isLinkedInHub
                      ? 'Build your LinkedIn sequence'
                      : 'Build your sequence'}
              </h3>
              <p className="mt-1 text-sm text-stone-500">
                {isSingleLinkedIn
                  ? 'One note for every enrolled lead — manual send on LinkedIn after launch. AI draft follows Message Drafter rules (≤300 chars, merge tags).'
                  : isSingleEmail
                    ? 'One email goes to every enrolled lead on launch. Write your own copy or use AI draft (Message Drafter rules, merge tags for personalization).'
                    : isLinkedInHub
                      ? 'LinkedIn-only timed steps — each queues for manual send. AI draft per step.'
                      : 'Email and SMS send automatically. LinkedIn steps queue for manual send in Results. AI draft uses your ICP and value prop per step.'}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {deliveryModeOptions.map((mode) => (
              <button
                key={mode}
                type="button"
                disabled={isPending}
                onClick={() => {
                  if (mode === deliveryMode) return
                  handleDeliveryModeChange(mode)
                }}
                className={cn(
                  'rounded-lg border px-3 py-2 text-[13px] font-medium transition-colors',
                  deliveryMode === mode
                    ? 'border-violet-300 bg-violet-50 text-violet-900'
                    : 'border-stone-200 text-stone-600 hover:border-stone-300',
                )}
              >
                {deliveryLabels[mode as keyof typeof deliveryLabels]}
              </button>
            ))}
          </div>

          {isSingleLinkedIn ? (
            <div className="mt-4">
              <CampaignSingleLinkedInComposer
                campaignId={campaign.id}
                step={
                  workflowSteps[0] ?? {
                    stepIndex: 0,
                    delayDays: 0,
                    channel: 'linkedin',
                    intent: '',
                    body: '',
                  }
                }
                onChange={(patch) => {
                  const base = workflowSteps[0] ?? {
                    stepIndex: 0,
                    delayDays: 0,
                    channel: 'linkedin' as const,
                    intent: '',
                    body: '',
                  }
                  setWorkflowSteps([{ ...base, ...patch }])
                }}
                sampleLead={sampleLead}
                disabled={isPending}
              />
            </div>
          ) : isSingleEmail ? (
            <div className="mt-4">
              <CampaignSingleEmailComposer
                campaignId={campaign.id}
                step={
                  workflowSteps[0] ?? {
                    stepIndex: 0,
                    delayDays: 0,
                    channel: 'email',
                    intent: '',
                    subject: '',
                    body: '',
                  }
                }
                onChange={(patch) => {
                  const base = workflowSteps[0] ?? {
                    stepIndex: 0,
                    delayDays: 0,
                    channel: 'email' as const,
                    intent: '',
                    subject: '',
                    body: '',
                  }
                  setWorkflowSteps([{ ...base, ...patch }])
                }}
                sampleLead={sampleLead}
                disabled={isPending}
              />
            </div>
          ) : (
            <>
              <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                <select
                  className="rounded-md border border-stone-200 bg-white px-2 py-1.5 text-xs"
                  value={draftStepIndex}
                  onChange={(event) => setDraftStepIndex(Number(event.target.value))}
                >
                  {workflowSteps.map((row, index) => (
                    <option key={index} value={index}>
                      Step {index + 1} ({CHANNEL_LABELS[row.channel]})
                    </option>
                  ))}
                </select>
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

              <div className="mt-4">
                <CampaignSequenceBuilder
                  steps={workflowSteps}
                  onChange={setWorkflowSteps}
                  disabled={isPending}
                  linkedinOnly={isLinkedInSequence}
                />
              </div>
            </>
          )}

          <div className="mt-4 flex justify-between gap-2">
            <Button variant="outline" onClick={() => setStep('audience')}>
              Back
            </Button>
            <Button onClick={handleSaveSequence} disabled={isPending || Boolean(launchPreviewError)}>
              Continue to launch
            </Button>
          </div>
        </section>
      ) : null}

      {isDraft && step === 'launch' ? (
        <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-stone-900">Ready to launch</h3>
          <p className="mt-1 text-sm text-stone-500">
            {campaign.metrics.enrolled} lead{campaign.metrics.enrolled === 1 ? '' : 's'} enrolled ·{' '}
            {isSingleEmail
              ? 'one-time email blast'
              : isSingleLinkedIn
                ? 'one-time LinkedIn note'
                : `${workflowSteps.filter((row) => row.body.trim()).length} steps in sequence`}
          </p>

          <div className="mt-4 space-y-3">
            {workflowSteps
              .filter((row) => row.body.trim())
              .map((row, index) => (
                <div key={index} className="rounded-lg border border-stone-100 bg-stone-50/80 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
                    Day {row.delayDays} · {CHANNEL_LABELS[row.channel]}
                  </p>
                  {row.channel === 'email' && row.subject ? (
                    <p className="mt-2 text-sm font-medium text-stone-900">{row.subject}</p>
                  ) : null}
                  <p className="mt-2 whitespace-pre-wrap text-sm text-stone-600">{row.body}</p>
                </div>
              ))}
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

      {manualSteps.length > 0 ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50/50 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-amber-950">LinkedIn steps ready</h3>
          <p className="mt-1 text-sm text-amber-900/80">
            Copy each message, send on LinkedIn, then mark as sent.
          </p>
          <div className="mt-4 space-y-3">
            {manualSteps.map((row) => {
              const metadata = row.metadata as {
                message?: string
                linkedinUrl?: string
              }
              const enrollment = enrollments.find((item) => item.leadId === row.leadId)
              return (
                <div key={row.id} className="rounded-lg border border-amber-200/80 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-stone-900">
                        {enrollment ? leadName(enrollment.lead) : 'Lead'}
                      </p>
                      {metadata.linkedinUrl ? (
                        <a
                          href={metadata.linkedinUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-flex items-center gap-1 text-xs text-violet-700 hover:underline"
                        >
                          Open LinkedIn
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : null}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyMessage(metadata.message ?? row.body)}
                      >
                        <Copy className="mr-1 h-3.5 w-3.5" />
                        Copy
                      </Button>
                      <Button size="sm" disabled={isPending} onClick={() => handleMarkStepSent(row.id)}>
                        Mark sent
                      </Button>
                    </div>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm text-stone-600">
                    {metadata.message ?? row.body}
                  </p>
                </div>
              )
            })}
          </div>
        </section>
      ) : null}

      {(isActive || step === 'results') && enrollments.length > 0 ? (
        <section className="rounded-xl border border-stone-200 bg-white shadow-sm">
          <div className="border-b border-stone-100 px-5 py-4">
            <h3 className="text-sm font-semibold text-stone-900">Results by lead</h3>
            <p className="mt-0.5 text-sm text-stone-500">
              Email replies are detected automatically when Resend inbound is configured.
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
