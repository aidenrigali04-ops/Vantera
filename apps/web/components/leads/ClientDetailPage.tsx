'use client'

import Link from 'next/link'
import {
  ArrowLeft,
  Calendar,
  Mail,
  Globe,
  MessageSquare,
  CheckCircle2,
  Clock,
  ExternalLink,
  Building2,
  TrendingUp,
  User,
  Zap,
  CircleDot,
  Phone,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type Lead = {
  id: string
  firstName: string | null
  lastName: string | null
  title: string | null
  company: string
  email: string | null
  phone: string | null
  linkedinUrl: string | null
  avatarUrl: string | null
  source: string
  relationshipStatus: string
  pipelineStage: string
  score: number
  tags: string[]
  notes: string | null
  enrichment: unknown
  createdAt: string
  updatedAt: string
}

type LeadProfile = {
  id: string
  disc: string | null
  awarenessLevel: number | null
  topTriggers: string[] | unknown
  primaryFear: string | null
  egoIdentity: string | null
  openingHook: string | null
  doNot: string | null
  profiledAt: string
} | null

type LeadDraft = {
  id: string
  channel: string
  subject: string | null
  body: string
  draftedBy: string
  status: string
  sentAt: string | null
  createdAt: string
}

type SdrSequence = {
  id: string
  status: string
  currentStep: number
  totalSteps: number
  nextStepAt: string | null
  lastStepAt: string | null
  repliedAt: string | null
  replyType: string | null
  bookedAt: string | null
  createdAt: string
} | null

type SequenceStep = {
  id: string
  stepNumber: number
  channel: string
  subject: string | null
  body: string
  scheduledFor: string
  sentAt: string | null
  status: string
  openedAt: string | null
  repliedAt: string | null
  createdAt: string
}

type Activity = {
  id: string
  activityType: string
  body: string | null
  createdAt: string
}

type Props = {
  lead: Lead
  profile: LeadProfile
  drafts: LeadDraft[]
  sequence: SdrSequence
  steps: SequenceStep[]
  activity: Activity[]
}

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  connected: 'Connected',
  nurturing: 'Nurturing',
  qualified: 'Qualified',
  discovery_booked: 'Call Booked',
  proposal_sent: 'Proposal Sent',
  won: 'Won',
  lost: 'Lost',
}

const DISC_LABELS: Record<string, string> = {
  D: 'Driver',
  I: 'Influencer',
  S: 'Steady',
  C: 'Conscientious',
}

function ChannelTag({ channel }: { channel: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    email: { bg: 'bg-[var(--cd-bg-tag-blue)]', text: 'text-[var(--cd-text-tag-blue)]', label: 'Email' },
    linkedin: { bg: 'bg-[var(--cd-bg-tag-cyan)]', text: 'text-[var(--cd-text-tag-cyan)]', label: 'LinkedIn' },
    sms: { bg: 'bg-[var(--cd-bg-tag-orange)]', text: 'text-[var(--cd-text-tag-orange)]', label: 'SMS' },
    call: { bg: 'bg-[var(--cd-bg-tag-red)]', text: 'text-[var(--cd-text-tag-red)]', label: 'Call' },
  }
  const style = map[channel.toLowerCase()] ?? { bg: 'bg-[var(--accent-muted)]', text: 'text-[var(--accent)]', label: channel }
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', style.bg, style.text)}>
      {style.label}
    </span>
  )
}

function StageTag({ status }: { status: string }) {
  const won = status === 'won'
  const lost = status === 'lost'
  const booked = status === 'discovery_booked'
  return (
    <span
      className={cn(
        'rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
        won && 'bg-[var(--cd-bg-tag-cyan)] text-[var(--cd-text-tag-cyan)]',
        lost && 'bg-[var(--cd-bg-tag-red)] text-[var(--cd-text-tag-red)]',
        booked && 'bg-[var(--cd-bg-tag-orange)] text-[var(--cd-text-tag-orange)]',
        !won && !lost && !booked && 'bg-[var(--accent-muted)] text-[var(--accent)]',
      )}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

function ScoreBadge({ score }: { score: number }) {
  const high = score >= 75
  const mid = score >= 50
  return (
    <span
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-bold',
        high ? 'bg-[var(--cd-bg-tag-cyan)] text-[var(--cd-text-tag-cyan)]' :
        mid ? 'bg-[var(--cd-bg-tag-orange)] text-[var(--cd-text-tag-orange)]' :
        'bg-[var(--bg-subtle)] text-[var(--cd-text-muted)]',
      )}
    >
      {score}
    </span>
  )
}

function formatDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTime(d: string | null | undefined) {
  if (!d) return ''
  return new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function channelIcon(channel: string) {
  switch (channel.toLowerCase()) {
    case 'linkedin': return Globe
    case 'sms': return MessageSquare
    case 'call': return Phone
    default: return Mail
  }
}

export function ClientDetailPage({ lead, profile, drafts, sequence, steps, activity }: Props) {
  const fullName = `${lead.firstName ?? ''} ${lead.lastName ?? ''}`.trim() || lead.company

  const sentSteps = steps.filter((s) => s.sentAt)
  const pendingSteps = steps.filter((s) => !s.sentAt && s.status !== 'cancelled')
  const pendingDrafts = drafts.filter((d) => d.status === 'pending_review')

  const sequenceStart = sequence?.createdAt ?? lead.createdAt
  const sequenceEnd = sequence?.bookedAt ?? sequence?.repliedAt ?? sequence?.nextStepAt

  const enrolledInSequence = Boolean(sequence)
  const emailSent = sentSteps.some((s) => s.channel === 'email')
  const replyReceived = Boolean(sequence?.repliedAt)
  const meetingBooked = Boolean(sequence?.bookedAt)

  const enrichment = (lead.enrichment ?? {}) as Record<string, unknown>
  const industry = String(
    enrichment.industry ?? enrichment.companyIndustry ?? '',
  ).trim()
  const companySizeRaw =
    enrichment.employeeCount ?? enrichment.employees ?? enrichment.companySize
  const companySize =
    typeof companySizeRaw === 'number'
      ? companySizeRaw
      : typeof companySizeRaw === 'string' && companySizeRaw.trim()
        ? companySizeRaw
        : ''
  const technologies = Array.isArray(enrichment.technologies)
    ? (enrichment.technologies as string[])
    : Array.isArray(enrichment.techStack)
      ? (enrichment.techStack as string[])
      : []
  const icpSignals = Array.isArray(enrichment.icpSignals)
    ? (enrichment.icpSignals as string[])
    : []
  const topTriggers = profile?.topTriggers
    ? Array.isArray(profile.topTriggers)
      ? (profile.topTriggers as string[])
      : []
    : []

  return (
    <div className="client-detail min-h-screen bg-[var(--cd-bg-outer)]">
      {/* Back nav */}
      <div className="px-6 pt-5 pb-2">
        <Link
          href="/admin/leads"
          className="inline-flex items-center gap-1.5 text-[12px] text-[var(--cd-text-muted)] transition-colors hover:text-[var(--cd-text-primary)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Back to pipeline
        </Link>
      </div>

      <div className="mx-auto max-w-[1160px] space-y-5 px-6 pb-12">

        {/* ── Active Sequence Section ── */}
        <section>
          <div className="flex items-center px-1 py-3">
            <p className="flex-1 text-[11px] uppercase tracking-[0.08em] text-[var(--cd-text-primary)]">
              Active Sequence {enrolledInSequence ? '(1)' : '(0)'}
            </p>
          </div>

          <div
            className="overflow-hidden rounded-[8px] bg-[var(--cd-bg-card)]"
            style={{ boxShadow: 'var(--cd-shadow)' }}
          >
            {/* Sequence header — dates + name */}
            <div className="space-y-2 px-4 py-5">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 shrink-0 text-[var(--cd-text-primary)]" aria-hidden />
                <p className="text-[12px] font-semibold text-[var(--cd-text-primary)]">
                  {enrolledInSequence
                    ? `Enrolled ${formatDate(sequenceStart)}${sequenceEnd ? ` · Next step ${formatDate(sequenceEnd)}` : ''}`
                    : 'Not yet enrolled in a sequence'}
                </p>
              </div>

              <h1 className="text-[22px] font-semibold leading-tight text-[var(--cd-text-primary)]">
                {fullName}
              </h1>

              {/* Meta row */}
              <div className="flex flex-wrap items-center gap-2">
                {lead.title ? (
                  <span className="text-[13px] text-[var(--cd-text-muted)]">{lead.title}</span>
                ) : null}
                {lead.title && lead.company ? (
                  <span className="text-[var(--cd-text-muted)]">·</span>
                ) : null}
                <span className="text-[13px] text-[var(--cd-text-muted)]">{lead.company}</span>
                <StageTag status={lead.relationshipStatus} />
                <ScoreBadge score={lead.score} />
              </div>
            </div>

            {/* Sequence body */}
            <div className="flex flex-wrap gap-0 border-t border-[var(--cd-border)]">
              {/* Left: avatar / company card */}
              <div className="flex items-start gap-4 p-4" style={{ width: '220px' }}>
                {lead.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={lead.avatarUrl}
                    alt={fullName}
                    className="h-[160px] w-full rounded-[8px] object-cover"
                  />
                ) : (
                  <div className="flex h-[160px] w-full items-center justify-center rounded-[8px] bg-[var(--bg-subtle)]">
                    <User className="h-12 w-12 text-[var(--cd-text-muted)]" aria-hidden />
                  </div>
                )}
              </div>

              {/* Middle: sequence timeline */}
              <div className="flex flex-1 flex-col justify-start gap-0 px-2 py-4" style={{ minWidth: '240px' }}>
                {steps.length === 0 ? (
                  <p className="px-2 text-[13px] text-[var(--cd-text-muted)]">No sequence steps yet.</p>
                ) : (
                  steps.slice(0, 4).map((step) => {
                    const Icon = channelIcon(step.channel)
                    const sent = Boolean(step.sentAt)
                    return (
                      <div key={step.id} className="flex items-start gap-3 px-2 py-2.5">
                        <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', sent ? 'text-[var(--cd-accent)]' : 'text-[var(--cd-text-muted)]')} aria-hidden />
                        <div className="min-w-0 flex-1">
                          <p className={cn('text-[14px] font-semibold leading-none', sent ? 'text-[var(--cd-text-primary)]' : 'text-[var(--cd-text-muted)]')}>
                            {step.subject ?? `Step ${step.stepNumber} · ${step.channel}`}
                          </p>
                          <p className="mt-1 text-[11px] text-[var(--cd-text-muted)]">
                            {sent ? `Sent ${formatDate(step.sentAt)} at ${formatTime(step.sentAt)}` : `Scheduled ${formatDate(step.scheduledFor)}`}
                          </p>
                          {step.repliedAt ? (
                            <p className="mt-0.5 text-[11px] font-medium text-[var(--cd-bg-tag-cyan)]">Reply received</p>
                          ) : null}
                        </div>
                      </div>
                    )
                  })
                )}
                {/* Lead details */}
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 px-2">
                  {industry ? (
                    <div className="flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-[var(--cd-text-muted)]" aria-hidden />
                      <span className="text-[11px] text-[var(--cd-text-muted)]">{industry}</span>
                    </div>
                  ) : null}
                  {companySize ? (
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="h-3.5 w-3.5 text-[var(--cd-text-muted)]" aria-hidden />
                      <span className="text-[11px] text-[var(--cd-text-muted)]">{companySize} employees</span>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Right: status checklist + DISC */}
              <div className="flex flex-col justify-start gap-1 px-4 py-4" style={{ minWidth: '220px' }}>
                {[
                  { label: 'Enrolled in sequence', done: enrolledInSequence },
                  { label: 'Email sent', done: emailSent },
                  { label: 'Reply received', done: replyReceived },
                  { label: 'Meeting booked', done: meetingBooked },
                ].map(({ label, done }) => (
                  <div key={label} className="flex items-center gap-2 rounded-[6px] px-2 py-1.5">
                    <CheckCircle2
                      className={cn('h-4 w-4 shrink-0', done ? 'text-[var(--cd-accent)]' : 'text-[var(--cd-text-muted)]')}
                      aria-hidden
                    />
                    <span className={cn('text-[13px]', done ? 'text-[var(--cd-text-secondary)]' : 'text-[var(--cd-text-muted)]')}>
                      {label}
                    </span>
                    {done ? null : null}
                    {done ? (
                      <ExternalLink className="ml-auto h-4 w-4 text-[var(--cd-text-muted)] hover:text-[var(--cd-accent)] cursor-pointer" aria-hidden />
                    ) : null}
                  </div>
                ))}

                {profile ? (
                  <div className="mt-3 border-t border-[var(--cd-border)] pt-3">
                    <p className="mb-1 text-[10px] uppercase tracking-wide text-[var(--cd-text-muted)]">DISC Profile</p>
                    {profile.disc ? (
                      <span className="rounded-full bg-[var(--cd-bg-tag-blue)] px-2.5 py-0.5 text-[12px] font-semibold text-[var(--cd-text-tag-blue)]">
                        {profile.disc} — {DISC_LABELS[profile.disc] ?? profile.disc}
                      </span>
                    ) : null}
                    {profile.awarenessLevel != null ? (
                      <p className="mt-1.5 text-[11px] text-[var(--cd-text-muted)]">
                        Awareness {profile.awarenessLevel}/5
                      </p>
                    ) : null}
                    {topTriggers.length > 0 ? (
                      <p className="mt-1.5 text-[11px] text-[var(--cd-text-muted)]">
                        Triggers: {topTriggers.slice(0, 3).join(', ')}
                      </p>
                    ) : null}
                    {profile.openingHook ? (
                      <p className="mt-2 text-[11px] leading-relaxed text-[var(--cd-text-muted)]">
                        &ldquo;{profile.openingHook}&rdquo;
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {/* Contact links */}
                <div className="mt-3 flex gap-2">
                  {lead.email ? (
                    <a
                      href={`mailto:${lead.email}`}
                      className="icon-tile flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-opacity hover:opacity-80"
                      title={lead.email}
                    >
                      <Mail className="h-3.5 w-3.5" aria-hidden />
                    </a>
                  ) : null}
                  {lead.linkedinUrl ? (
                    <a
                      href={lead.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="icon-tile flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-opacity hover:opacity-80"
                    >
                      <Globe className="h-3.5 w-3.5" aria-hidden />
                    </a>
                  ) : null}
                  {lead.phone ? (
                    <a
                      href={`tel:${lead.phone}`}
                      className="icon-tile flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-opacity hover:opacity-80"
                      title={lead.phone}
                    >
                      <Phone className="h-3.5 w-3.5" aria-hidden />
                    </a>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Footer action bar */}
            <div className="flex items-center justify-between bg-[var(--cd-bg-footer)] px-4 py-3">
              <div className="flex items-center gap-3">
                {pendingDrafts.length > 0 ? (
                  <span className="flex items-center gap-1.5 rounded-full bg-[var(--cd-bg-tag-blue)] px-3 py-1 text-[12px] font-medium text-[var(--cd-text-tag-blue)]">
                    <Zap className="h-3.5 w-3.5" aria-hidden />
                    {pendingDrafts.length} draft{pendingDrafts.length !== 1 ? 's' : ''} pending review
                  </span>
                ) : (
                  <span className="text-[12px] text-[var(--cd-text-muted)]">No drafts pending</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {sequence?.nextStepAt ? (
                  <span className="flex items-center gap-1.5 text-[12px] text-[var(--cd-text-muted)]">
                    <Clock className="h-3.5 w-3.5" aria-hidden />
                    Next step {formatDate(sequence.nextStepAt)}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        {/* ── Pending Outreach Actions ── */}
        <section>
          <div className="flex items-center px-1 py-3">
            <p className="flex-1 text-[11px] uppercase tracking-[0.08em] text-[var(--cd-text-primary)]">
              Pending Outreach Actions
            </p>
          </div>

          {pendingDrafts.length === 0 && pendingSteps.length === 0 ? (
            <div
              className="flex items-center gap-3 rounded-[8px] bg-[var(--cd-bg-card)] px-5 py-5"
              style={{ boxShadow: 'var(--cd-shadow)' }}
            >
              <CheckCircle2 className="h-5 w-5 text-[var(--cd-accent)]" aria-hidden />
              <p className="text-[13px] text-[var(--cd-text-muted)]">All caught up — no pending actions for this lead.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {pendingDrafts.slice(0, 3).map((draft) => (
                <ActionCard
                  key={draft.id}
                  channel={draft.channel}
                  title={draft.subject ?? `${draft.channel} draft`}
                  preview={draft.body.slice(0, 120)}
                  date={draft.createdAt}
                  ctaLabel="Review Draft"
                  ctaHref={`/admin/outreach/email`}
                  status="pending_review"
                />
              ))}
              {pendingSteps.slice(0, Math.max(0, 3 - pendingDrafts.length)).map((step) => (
                <ActionCard
                  key={step.id}
                  channel={step.channel}
                  title={step.subject ?? `Step ${step.stepNumber}`}
                  preview={step.body.slice(0, 120)}
                  date={step.scheduledFor}
                  ctaLabel="Send Now"
                  status="scheduled"
                />
              ))}
            </div>
          )}
        </section>

        {/* ── Activity Timeline ── */}
        {activity.length > 0 ? (
          <section>
            <div className="flex items-center px-1 py-3">
              <p className="flex-1 text-[11px] uppercase tracking-[0.08em] text-[var(--cd-text-primary)]">
                Recent Activity
              </p>
            </div>
            <div
              className="overflow-hidden rounded-[8px] bg-[var(--cd-bg-card)]"
              style={{ boxShadow: 'var(--cd-shadow)' }}
            >
              <ul className="divide-y divide-[var(--cd-border)]">
                {activity.slice(0, 8).map((item) => (
                  <li key={item.id} className="flex items-start gap-3 px-4 py-3">
                    <CircleDot className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--cd-accent-dark)]" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-[var(--cd-text-primary)]">
                        {item.activityType.replace(/_/g, ' ')}
                      </p>
                      {item.body ? (
                        <p className="mt-0.5 truncate text-[12px] text-[var(--cd-text-muted)]">{item.body}</p>
                      ) : null}
                    </div>
                    <time className="shrink-0 text-[11px] text-[var(--cd-text-muted)]">
                      {formatDate(item.createdAt)}
                    </time>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}

        {/* ── Scout / Aspire enrichment ── */}
        {(industry || companySize || technologies.length > 0 || icpSignals.length > 0) ? (
          <section>
            <div className="flex items-center px-1 py-3">
              <p className="flex-1 text-[11px] uppercase tracking-[0.08em] text-[var(--cd-text-primary)]">
                Prospect enrichment
              </p>
            </div>
            <div
              className="grid gap-4 rounded-[8px] bg-[var(--cd-bg-card)] p-5 sm:grid-cols-2"
              style={{ boxShadow: 'var(--cd-shadow)' }}
            >
              {industry ? (
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--cd-text-muted)]">Industry</p>
                  <p className="text-[13px] text-[var(--cd-text-secondary)]">{industry}</p>
                </div>
              ) : null}
              {companySize ? (
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--cd-text-muted)]">Company size</p>
                  <p className="text-[13px] text-[var(--cd-text-secondary)]">{companySize} employees</p>
                </div>
              ) : null}
              {technologies.length > 0 ? (
                <div className="sm:col-span-2">
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--cd-text-muted)]">Tech stack</p>
                  <p className="text-[13px] text-[var(--cd-text-secondary)]">{technologies.join(', ')}</p>
                </div>
              ) : null}
              {icpSignals.length > 0 ? (
                <div className="sm:col-span-2">
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--cd-text-muted)]">ICP signals</p>
                  <ul className="space-y-1">
                    {icpSignals.slice(0, 8).map((signal) => (
                      <li key={signal} className="text-[13px] text-[var(--cd-text-secondary)]">· {signal}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {/* ── Notes / Profile ── */}
        {(lead.notes || profile?.primaryFear || profile?.egoIdentity || profile?.doNot) ? (
          <section>
            <div className="flex items-center px-1 py-3">
              <p className="flex-1 text-[11px] uppercase tracking-[0.08em] text-[var(--cd-text-primary)]">
                Profile & Notes
              </p>
            </div>
            <div
              className="grid gap-4 rounded-[8px] bg-[var(--cd-bg-card)] p-5 sm:grid-cols-2"
              style={{ boxShadow: 'var(--cd-shadow)' }}
            >
              {lead.notes ? (
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--cd-text-muted)]">Notes</p>
                  <p className="text-[13px] leading-relaxed text-[var(--cd-text-secondary)]">{lead.notes}</p>
                </div>
              ) : null}
              {profile?.primaryFear ? (
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--cd-text-muted)]">Primary Fear</p>
                  <p className="text-[13px] leading-relaxed text-[var(--cd-text-secondary)]">{profile.primaryFear}</p>
                </div>
              ) : null}
              {profile?.egoIdentity ? (
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--cd-text-muted)]">Identity</p>
                  <p className="text-[13px] leading-relaxed text-[var(--cd-text-secondary)]">{profile.egoIdentity}</p>
                </div>
              ) : null}
              {profile?.doNot ? (
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--cd-text-muted)]">Avoid</p>
                  <p className="text-[13px] leading-relaxed text-[var(--cd-text-secondary)]">{profile.doNot}</p>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  )
}

function ActionCard({
  channel,
  title,
  preview,
  date,
  ctaLabel,
  ctaHref,
  status,
}: {
  channel: string
  title: string
  preview: string
  date: string
  ctaLabel: string
  ctaHref?: string
  status: string
}) {
  const isPending = status === 'pending_review'

  return (
    <div
      className="flex flex-col overflow-hidden rounded-[8px] bg-[var(--cd-bg-card)]"
      style={{ boxShadow: 'var(--cd-shadow)' }}
    >
      <div className="flex items-center gap-2 px-4 py-3">
        <p className="flex-1 text-[12px] font-medium text-[var(--cd-text-primary)] truncate">{title}</p>
        <ChannelTag channel={channel} />
      </div>

      <div className="px-4 py-2">
        <p className="line-clamp-3 text-[12px] leading-relaxed text-[var(--cd-text-muted)]">
          {preview}{preview.length >= 120 ? '…' : ''}
        </p>
      </div>

      <div className="px-4 pt-1 pb-2">
        <p className="text-[11px] font-semibold text-[var(--cd-text-primary)]">
          {new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </p>
      </div>

      <div className="flex items-start p-4 pt-2">
        {ctaHref ? (
          <Link
            href={ctaHref}
            className="inline-flex items-center justify-center rounded-[6px] border border-[var(--cd-accent)] px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--cd-accent)] transition-colors hover:bg-[var(--cd-accent)] hover:text-[var(--cd-accent-text)]"
          >
            {ctaLabel}
          </Link>
        ) : (
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-[6px] border border-[var(--cd-accent)] px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--cd-accent)] transition-colors hover:bg-[var(--cd-accent)] hover:text-[var(--cd-accent-text)]"
          >
            {ctaLabel}
          </button>
        )}
      </div>
    </div>
  )
}
