'use client'

import type { ReactNode } from 'react'
import {
  aspireStatusLabel,
  firmographicsFromEnrichment,
  type AspireLeadProfile,
} from '@/lib/aspire/lead-display'
import type { AspireSearchResult } from '@/lib/aspire/types'
import Link from 'next/link'

type Props = {
  result: AspireSearchResult
  compact?: boolean
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-secondary)]">
      {children}
    </p>
  )
}

function ProfileBlock({ profile }: { profile: AspireLeadProfile }) {
  return (
    <div className="space-y-3">
      {profile.disc ? (
        <div>
          <p className="text-[11px] text-[var(--text-tertiary)]">DISC</p>
          <p className="text-[13px] font-semibold text-[var(--text-primary)]">{profile.disc}</p>
        </div>
      ) : null}
      {profile.awarenessLevel != null ? (
        <div>
          <p className="text-[11px] text-[var(--text-tertiary)]">Awareness level</p>
          <p className="text-[13px] text-[var(--text-primary)]">{profile.awarenessLevel} / 5</p>
        </div>
      ) : null}
      {profile.topTriggers.length > 0 ? (
        <div>
          <p className="text-[11px] text-[var(--text-tertiary)]">Top triggers</p>
          <ul className="mt-1 space-y-1">
            {profile.topTriggers.map((trigger) => (
              <li key={trigger} className="text-[12px] text-[var(--text-secondary)]">
                · {trigger}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {profile.primaryFear ? (
        <div>
          <p className="text-[11px] text-[var(--text-tertiary)]">Primary fear</p>
          <p className="text-[12px] leading-relaxed text-[var(--text-secondary)]">{profile.primaryFear}</p>
        </div>
      ) : null}
      {profile.egoIdentity ? (
        <div>
          <p className="text-[11px] text-[var(--text-tertiary)]">Ego identity</p>
          <p className="text-[12px] leading-relaxed text-[var(--text-secondary)]">{profile.egoIdentity}</p>
        </div>
      ) : null}
      {profile.openingHook ? (
        <div>
          <p className="text-[11px] text-[var(--text-tertiary)]">Opening hook</p>
          <p className="text-[12px] italic leading-relaxed text-[var(--text-secondary)]">
            &ldquo;{profile.openingHook}&rdquo;
          </p>
        </div>
      ) : null}
      {profile.doNot ? (
        <div>
          <p className="text-[11px] text-[var(--text-tertiary)]">Do not</p>
          <p className="text-[12px] leading-relaxed text-[var(--text-secondary)]">{profile.doNot}</p>
        </div>
      ) : null}
    </div>
  )
}

export function AspireLeadDataSections({ result, compact }: Props) {
  const firmographics = result.leadEnrichment
    ? firmographicsFromEnrichment(result.leadEnrichment)
    : {}
  const industry = result.industry ?? firmographics.industry
  const employeeCount = result.employeeCount ?? firmographics.employeeCount
  const technologies =
    result.technologies.length > 0 ? result.technologies : (firmographics.technologies ?? [])
  const role = result.title?.trim() || null

  return (
    <div className="space-y-4">
      {result.status ? (
        <div>
          <SectionLabel>Pipeline status</SectionLabel>
          <p className="text-[12px] font-medium capitalize text-[var(--text-primary)]">
            {aspireStatusLabel(result.status)}
          </p>
          {result.enrolledAt ? (
            <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">
              Enrolled {new Date(result.enrolledAt).toLocaleString()}
            </p>
          ) : null}
          {result.leadId ? (
            <Link
              href={`/admin/leads/${result.leadId}`}
              className="mt-2 inline-block text-[12px] font-medium text-[var(--accent)] hover:underline"
            >
              View CRM lead →
            </Link>
          ) : null}
        </div>
      ) : null}

      <div>
        <SectionLabel>Firmographics</SectionLabel>
        <ul className="space-y-1.5 text-[12px] text-[var(--text-secondary)]">
          {role ? (
            <li>
              <span className="text-[var(--text-tertiary)]">Role:</span> {role}
            </li>
          ) : null}
          {industry ? (
            <li>
              <span className="text-[var(--text-tertiary)]">Industry:</span> {industry}
            </li>
          ) : null}
          {employeeCount != null ? (
            <li>
              <span className="text-[var(--text-tertiary)]">Company size:</span> ~{employeeCount}{' '}
              employees
            </li>
          ) : null}
          {technologies.length > 0 ? (
            <li>
              <span className="text-[var(--text-tertiary)]">Tech stack:</span>{' '}
              {technologies.slice(0, compact ? 3 : 6).join(', ')}
            </li>
          ) : null}
          {!role && !industry && employeeCount == null && technologies.length === 0 ? (
            <li className="text-[var(--text-disabled)]">No firmographic data yet</li>
          ) : null}
        </ul>
      </div>

      {result.leadEnrichment && !compact ? (
        <div>
          <SectionLabel>Stored enrichment</SectionLabel>
          <p className="text-[11px] text-[var(--text-tertiary)]">
            Sourced from leads.enrichment after scout/Aspire enrollment
          </p>
        </div>
      ) : null}

      {result.leadProfile ? (
        <div>
          <SectionLabel>AI profile</SectionLabel>
          <ProfileBlock profile={result.leadProfile} />
        </div>
      ) : null}
    </div>
  )
}
