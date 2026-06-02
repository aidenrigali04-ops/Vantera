'use client'

import { icpScoreColor, icpScoreLabel } from '@/components/aspire/IcpScoreRing'
import { Button } from '@/components/ui/button'
import {
  aspireAvatarTone,
  aspireInitials,
  aspireLocationLabel,
  aspireProspectName,
  aspireProspectSubtitle,
  formatPhoneDisplay,
  linkedInHandle,
} from '@/lib/aspire/display'
import type { AspireSearchResult } from '@/lib/aspire/types'
import { cn } from '@/lib/utils'
import { Check, ExternalLink, Loader2, Mail, MapPin, Phone } from 'lucide-react'

const linkClass =
  'group inline-flex min-w-0 max-w-[220px] items-center gap-2 rounded-md text-[13px] text-[var(--text-primary)] transition-colors duration-[120ms] hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-muted)]'

type ProspectCellProps = {
  row: AspireSearchResult
}

export function AspireProspectCell({ row }: ProspectCellProps) {
  const name = aspireProspectName(row)
  const location = aspireLocationLabel(row)

  return (
    <div className="flex min-w-[220px] items-center gap-3">
      <span
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ring-1 ring-inset',
          aspireAvatarTone(name),
        )}
        aria-hidden
      >
        {aspireInitials(row)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium leading-snug text-[var(--text-primary)]">
          {name}
        </p>
        <p className="truncate text-[12px] leading-snug text-[var(--text-secondary)]">
          {aspireProspectSubtitle(row)}
        </p>
        {location ? (
          <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-[var(--text-tertiary)]">
            <MapPin className="h-3 w-3 shrink-0" aria-hidden />
            {location}
          </p>
        ) : null}
      </div>
    </div>
  )
}

type IcpCellProps = {
  score: number
}

export function AspireIcpCell({ score }: IcpCellProps) {
  const clamped = Math.min(100, Math.max(0, score))
  const color = icpScoreColor(clamped)

  return (
    <div className="min-w-[112px]">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[15px] font-semibold tabular-nums leading-none text-[var(--text-primary)]">
          {clamped}
        </span>
        <span className="text-[11px] font-medium text-[var(--text-secondary)]">{icpScoreLabel(clamped)}</span>
      </div>
      <div
        className="mt-2 h-1 w-full overflow-hidden rounded-full bg-[var(--border-subtle)]"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`ICP score ${clamped}`}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${clamped}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

type IndustryCellProps = {
  industry: string | null
}

export function AspireIndustryCell({ industry }: IndustryCellProps) {
  const value = industry?.trim()
  if (!value) {
    return <span className="text-[13px] text-[var(--text-disabled)]">—</span>
  }

  return (
    <span
      className="inline-flex max-w-[148px] truncate rounded-md bg-[var(--bg-subtle)] px-2.5 py-1 text-[12px] font-medium text-[var(--text-secondary)] ring-1 ring-inset ring-[var(--border-default)]"
      title={value}
    >
      {value}
    </span>
  )
}

type ContactCellProps = {
  row: AspireSearchResult
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

export function AspireContactCell({ row }: ContactCellProps) {
  const hasEmail = Boolean(row.email)
  const hasPhone = Boolean(row.phone)
  const hasLinkedIn = Boolean(row.linkedinUrl)

  if (!hasEmail && !hasPhone && !hasLinkedIn) {
    return (
      <span className="text-[13px] text-[var(--text-disabled)]">No contact data</span>
    )
  }

  return (
    <div className="flex min-w-[196px] flex-col gap-1">
      {hasEmail ? (
        <ContactLink href={`mailto:${row.email}`} icon={Mail} label={row.email!} />
      ) : null}
      {hasPhone ? (
        <ContactLink
          href={`tel:${row.phone}`}
          icon={Phone}
          label={formatPhoneDisplay(row.phone!)}
        />
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

type EnrollCellProps = {
  state: 'idle' | 'pending' | 'added' | 'exists'
  disabled: boolean
  onEnroll: () => void
  actionLabel?: string
}

export function AspireEnrollCell({
  state,
  disabled,
  onEnroll,
  actionLabel = 'Add to pipeline',
}: EnrollCellProps) {
  if (state === 'added') {
    return (
      <span className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[var(--success-muted)] px-3 text-[12px] font-medium text-[var(--success)] ring-1 ring-inset ring-[var(--success)]/20">
        <Check className="h-3.5 w-3.5" aria-hidden />
        Added
      </span>
    )
  }

  if (state === 'exists') {
    return (
      <span className="inline-flex h-8 items-center rounded-lg bg-[var(--bg-subtle)] px-3 text-[12px] font-medium text-[var(--text-secondary)] ring-1 ring-inset ring-[var(--border-default)]">
        In CRM
      </span>
    )
  }

  return (
    <Button
      size="sm"
      variant="outline"
      className="h-8 border-[var(--border-default)] bg-[var(--bg-surface)] text-[12px] font-medium transition-colors duration-[120ms] hover:bg-[var(--bg-overlay)]"
      onClick={(event) => {
        event.stopPropagation()
        if (state === 'idle') onEnroll()
      }}
      disabled={disabled || state === 'pending'}
    >
      {state === 'pending' ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-label="Adding to pipeline" />
      ) : (
        actionLabel
      )}
    </Button>
  )
}
