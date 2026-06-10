'use client'

import { qualityUiForTier } from '@/lib/aspire/lead-quality-ui'
import { LEAD_STAGE_LABELS, type EnrichedLeadRow } from '@/lib/leads/table-rows'
import { cn } from '@/lib/utils'
import { ExternalLink, Mail, MapPin, Phone } from 'lucide-react'

const linkClass =
  'group inline-flex min-w-0 max-w-[220px] items-center gap-2 rounded-md text-[13px] text-[var(--text-primary)] transition-colors duration-[120ms] hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-muted)]'

function initials(row: EnrichedLeadRow): string {
  const first = row.firstName?.[0] ?? ''
  const last = row.lastName?.[0] ?? ''
  const value = `${first}${last}`.toUpperCase()
  if (value) return value
  return row.company.slice(0, 2).toUpperCase() || '?'
}

function formatPhoneDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  if (digits.length === 11 && digits[0] === '1') {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  return phone.trim()
}

function linkedInHandle(url: string): string {
  const match = url.match(/linkedin\.com\/in\/([^/?#]+)/i)
  if (!match?.[1]) return 'LinkedIn profile'
  return match[1].replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

export function leadScoreColor(score: number): string {
  if (score >= 80) return 'var(--success)'
  if (score >= 60) return 'var(--accent)'
  if (score >= 40) return 'var(--warning)'
  return 'var(--text-tertiary)'
}

export function leadScoreLabel(score: number): string {
  if (score >= 80) return 'Excellent fit'
  if (score >= 60) return 'Strong fit'
  if (score >= 40) return 'Possible fit'
  return 'Low fit'
}

function ChannelDot({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      title={label}
      className={cn(
        'h-1.5 w-1.5 rounded-full',
        active ? 'bg-[var(--success)]' : 'bg-[var(--border-strong)]',
      )}
      aria-hidden
    />
  )
}

/** Avatar + name + role + location + contact-channel dots + DISC chip. */
export function LeadIdentityCell({ row }: { row: EnrichedLeadRow }) {
  const subtitle =
    row.title && row.company
      ? `${row.title} at ${row.company}`
      : (row.title ?? row.company)

  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        className="icon-tile flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-[var(--text-secondary)] ring-1 ring-inset ring-[var(--border-subtle)]"
        aria-hidden
      >
        {initials(row)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium leading-snug text-[var(--text-primary)]">
          {row.name}
        </p>
        <p className="truncate text-[12px] leading-snug text-[var(--text-secondary)]">{subtitle}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {row.location ? (
            <p className="flex items-center gap-1 truncate text-[11px] text-[var(--text-tertiary)]">
              <MapPin className="h-3 w-3 shrink-0" aria-hidden />
              {row.location}
            </p>
          ) : null}
          <div className="flex items-center gap-1" aria-label="Contact channels">
            <ChannelDot active={Boolean(row.email)} label="Email" />
            <ChannelDot active={Boolean(row.phone)} label="Phone" />
            <ChannelDot active={Boolean(row.linkedinUrl)} label="LinkedIn" />
          </div>
          {row.disc ? (
            <span className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)]">
              {row.disc}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}

/** Lead score + enrichment quality tier, with progress bars. */
export function LeadQualityCell({ row }: { row: EnrichedLeadRow }) {
  const score = Math.min(100, Math.max(0, row.score))
  const tierUi = row.qualityTier ? qualityUiForTier(row.qualityTier) : null

  return (
    <div className="w-full max-w-[140px]">
      <div className="flex items-center justify-between gap-1">
        <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
          Score
        </span>
        {tierUi ? (
          <span
            className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
            style={{
              backgroundColor: tierUi.mutedBg,
              color: tierUi.barColor,
              boxShadow: `inset 0 0 0 1px ${tierUi.ring}`,
            }}
          >
            {tierUi.label}
          </span>
        ) : null}
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="text-[15px] font-semibold tabular-nums text-[var(--text-primary)]">
          {score}
        </span>
        <span className="text-[10px] text-[var(--text-tertiary)]">{leadScoreLabel(score)}</span>
      </div>
      <div
        className="mt-1.5 h-1 overflow-hidden rounded-full bg-[var(--border-subtle)]"
        role="progressbar"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Lead score ${score}`}
      >
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{ width: `${score}%`, backgroundColor: leadScoreColor(score) }}
        />
      </div>

      {row.enrichmentScore != null ? (
        <>
          <div className="mt-2.5 flex items-center justify-between gap-1">
            <span className="text-[11px] text-[var(--text-tertiary)]">Enrichment</span>
            <span className="text-[11px] font-medium tabular-nums text-[var(--text-secondary)]">
              {row.enrichmentScore}%
            </span>
          </div>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-[var(--border-subtle)]">
            <div
              className="h-full rounded-full transition-[width] duration-300"
              style={{
                width: `${row.completenessPct ?? row.enrichmentScore}%`,
                backgroundColor: tierUi?.barColor ?? 'var(--accent)',
              }}
            />
          </div>
        </>
      ) : null}
    </div>
  )
}

export function LeadIndustryCell({ row }: { row: EnrichedLeadRow }) {
  const value = row.industry?.trim()
  if (!value) {
    return <span className="text-[13px] text-[var(--text-disabled)]">—</span>
  }

  return (
    <div className="min-w-0">
      <span
        className="inline-flex max-w-[148px] truncate rounded-md bg-[var(--bg-subtle)] px-2.5 py-1 text-[12px] font-medium text-[var(--text-secondary)] ring-1 ring-inset ring-[var(--border-default)]"
        title={value}
      >
        {value}
      </span>
      {row.employeeCount != null ? (
        <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">~{row.employeeCount} employees</p>
      ) : null}
    </div>
  )
}

function ContactLink({
  href,
  icon: Icon,
  label,
  external,
}: {
  href: string
  icon: typeof Mail
  label: string
  external?: boolean
}) {
  return (
    <a
      href={href}
      className={linkClass}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      onClick={(event) => event.stopPropagation()}
    >
      <Icon
        className="h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)] transition-colors duration-[120ms] group-hover:text-[var(--accent)]"
        aria-hidden
      />
      <span className="truncate">{label}</span>
      {external ? (
        <ExternalLink
          className="h-3 w-3 shrink-0 text-[var(--text-tertiary)] opacity-0 transition-opacity duration-[120ms] group-hover:opacity-100"
          aria-hidden
        />
      ) : null}
    </a>
  )
}

export function LeadContactCell({ row }: { row: EnrichedLeadRow }) {
  const hasEmail = Boolean(row.email)
  const hasPhone = Boolean(row.phone)
  const hasLinkedIn = Boolean(row.linkedinUrl)

  if (!hasEmail && !hasPhone && !hasLinkedIn) {
    return <span className="text-[13px] text-[var(--text-disabled)]">No contact data</span>
  }

  return (
    <div className="flex min-w-[180px] flex-col gap-1">
      {hasEmail ? <ContactLink href={`mailto:${row.email}`} icon={Mail} label={row.email!} /> : null}
      {hasPhone ? (
        <ContactLink href={`tel:${row.phone}`} icon={Phone} label={formatPhoneDisplay(row.phone!)} />
      ) : null}
      {hasLinkedIn ? (
        <ContactLink
          href={row.linkedinUrl!}
          icon={ExternalLink}
          label={linkedInHandle(row.linkedinUrl!)}
          external
        />
      ) : null}
    </div>
  )
}

export function LeadStageBadge({ stage }: { stage: string }) {
  const won = stage === 'won'
  const lost = stage === 'lost'
  return (
    <span
      className={cn(
        'inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold',
        won && 'bg-[var(--success-muted)] text-[var(--success)]',
        lost && 'bg-[var(--danger-muted)] text-[var(--danger)]',
        !won && !lost && 'bg-[var(--accent-muted)] text-[var(--accent)]',
      )}
    >
      {LEAD_STAGE_LABELS[stage] ?? stage}
    </span>
  )
}
