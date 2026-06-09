'use client'

import Link from 'next/link'
import { ArrowLeft, CheckCircle2, AlertCircle, Mail, Globe, Phone, Building2, Users, Calendar, TrendingUp, Cpu, Tag, User, MapPin, DollarSign, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

type AspireResult = {
  id: string
  icpScore: number
  icpSignals: unknown
  status: string
  enrolledAt: string | null
  createdAt: string
  rawData: unknown
}

type Lead = {
  id: string
  firstName: string | null
  lastName: string | null
  title: string | null
  company: string
  email: string | null
  phone: string | null
  linkedinUrl: string | null
  score: number
  relationshipStatus: string
  source: string
  enrichment: unknown
  createdAt: string
} | null

type Profile = {
  disc: string | null
  awarenessLevel: number | null
  topTriggers: unknown
  primaryFear: string | null
  egoIdentity: string | null
  openingHook: string | null
  doNot: string | null
} | null

type Props = {
  result: AspireResult
  lead: Lead
  profile: Profile
  searchId: string
}

const DISC_LABELS: Record<string, { label: string; desc: string }> = {
  D: { label: 'Dominant', desc: 'Direct, decisive, results-focused' },
  I: { label: 'Influential', desc: 'Optimistic, enthusiastic, collaborative' },
  S: { label: 'Steady', desc: 'Patient, reliable, team-oriented' },
  C: { label: 'Conscientious', desc: 'Analytical, detail-focused, accurate' },
}

function formatDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function icpScoreColor(score: number) {
  if (score >= 75) return { ring: 'ring-[var(--cd-text-tag-cyan)]', text: 'text-[var(--cd-text-tag-cyan)]', bg: 'bg-[var(--cd-bg-tag-cyan)]' }
  if (score >= 50) return { ring: 'ring-[var(--cd-text-tag-orange)]', text: 'text-[var(--cd-text-tag-orange)]', bg: 'bg-[var(--cd-bg-tag-orange)]' }
  return { ring: 'ring-[#2d4a62]', text: 'text-[var(--cd-text-muted)]', bg: 'bg-[#102a43]' }
}

function EnrichSection({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="rounded-[8px] bg-[var(--cd-bg-card)]" style={{ boxShadow: 'var(--cd-shadow)' }}>
      <div className="flex items-center gap-2.5 border-b border-[var(--cd-border)] px-4 py-3">
        <Icon className="h-4 w-4 text-[var(--cd-accent)]" aria-hidden />
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--cd-text-primary)]">{title}</p>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

function KVRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div className="flex items-start gap-3 py-1.5">
      <span className="w-36 shrink-0 text-[11px] text-[var(--cd-text-muted)]">{label}</span>
      <span className="flex-1 text-[13px] text-[var(--cd-text-secondary)] break-words">{String(value)}</span>
    </div>
  )
}

function TagList({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((t) => (
        <span key={t} className="rounded-[4px] bg-[#102a43] px-2 py-0.5 text-[11px] font-medium text-[var(--cd-accent)]">
          {t}
        </span>
      ))}
    </div>
  )
}

function extractRawSections(rawData: unknown) {
  if (!rawData || typeof rawData !== 'object') return {}

  const raw = rawData as Record<string, unknown>

  const identity = {
    'First Name': raw.firstName ?? raw.first_name,
    'Last Name': raw.lastName ?? raw.last_name,
    Headline: raw.headline ?? raw.jobTitle ?? raw.job_title,
    Location: raw.location ?? raw.city ?? raw.country,
    Seniority: raw.seniority ?? raw.seniorityLevel,
  }

  const company = {
    Company: raw.company ?? raw.companyName ?? raw.company_name,
    Domain: raw.domain ?? raw.companyDomain ?? raw.company_domain,
    Industry: raw.industry ?? raw.companyIndustry,
    'Employee Count': raw.employees ?? raw.employeeCount ?? raw.employee_count ?? raw.companySize,
    'Founded Year': raw.foundedYear ?? raw.founded_year,
    'Annual Revenue': raw.annualRevenue ?? raw.revenue ?? raw.annual_revenue,
    HQ: raw.headquarters ?? raw.hq,
    Description: raw.companyDescription ?? raw.description,
  }

  const contact = {
    Email: raw.email ?? raw.workEmail ?? raw.work_email,
    Phone: raw.phone ?? raw.phoneNumber,
    LinkedIn: raw.linkedinUrl ?? raw.linkedin_url ?? raw.linkedIn,
    Twitter: raw.twitterUrl ?? raw.twitter_url ?? raw.twitter,
    Website: raw.website ?? raw.websiteUrl,
  }

  const tech = Array.isArray(raw.technologies)
    ? (raw.technologies as string[])
    : Array.isArray(raw.techStack)
      ? (raw.techStack as string[])
      : Array.isArray(raw.tech_stack)
        ? (raw.tech_stack as string[])
        : []

  const knownKeys = new Set([
    'firstName', 'first_name', 'lastName', 'last_name', 'headline', 'jobTitle', 'job_title',
    'location', 'city', 'country', 'seniority', 'seniorityLevel',
    'company', 'companyName', 'company_name', 'domain', 'companyDomain', 'company_domain',
    'industry', 'companyIndustry', 'employees', 'employeeCount', 'employee_count', 'companySize',
    'foundedYear', 'founded_year', 'annualRevenue', 'revenue', 'annual_revenue', 'headquarters', 'hq',
    'companyDescription', 'description',
    'email', 'workEmail', 'work_email', 'phone', 'phoneNumber',
    'linkedinUrl', 'linkedin_url', 'linkedIn', 'twitterUrl', 'twitter_url', 'twitter', 'website', 'websiteUrl',
    'technologies', 'techStack', 'tech_stack',
  ])

  const other: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(raw)) {
    if (!knownKeys.has(k) && v !== null && v !== undefined && v !== '') {
      other[k] = v
    }
  }

  return { identity, company, contact, tech, other }
}

function renderValue(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (Array.isArray(v)) return v.map(String).join(', ')
  if (typeof v === 'object') return JSON.stringify(v, null, 2)
  return String(v)
}

export function ScoutLeadEnrichmentPage({ result, lead, profile, searchId }: Props) {
  const name = lead
    ? `${lead.firstName ?? ''} ${lead.lastName ?? ''}`.trim() || lead.company
    : 'Unknown Prospect'

  const scoreStyle = icpScoreColor(result.icpScore)
  const signals = (Array.isArray(result.icpSignals) ? result.icpSignals : []) as string[]
  const { identity, company, contact, tech, other } = extractRawSections(result.rawData)
  const leadEnrichment = (lead?.enrichment && typeof lead.enrichment === 'object' ? lead.enrichment : {}) as Record<string, unknown>
  const { tech: leadTech, other: leadOther } = extractRawSections(leadEnrichment)
  const allTech = Array.from(new Set([...(tech ?? []), ...(leadTech ?? [])]))

  const triggers = Array.isArray(profile?.topTriggers) ? (profile.topTriggers as string[]) : []

  return (
    <div className="client-detail min-h-screen bg-[var(--cd-bg-outer)]">
      <div className="px-6 pt-5 pb-2">
        <Link
          href={`/admin/outreach/agents/scout/runs/${encodeURIComponent(searchId)}`}
          className="inline-flex items-center gap-1.5 text-[12px] text-[var(--cd-text-muted)] transition-colors hover:text-[var(--cd-text-primary)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Back to run
        </Link>
      </div>

      <div className="mx-auto max-w-[1100px] space-y-5 px-6 pb-12">

        {/* ── Header card ── */}
        <div
          className="overflow-hidden rounded-[8px] bg-[var(--cd-bg-card)]"
          style={{ boxShadow: 'var(--cd-shadow)' }}
        >
          <div className="flex items-start justify-between gap-6 p-5">
            <div className="flex items-start gap-4">
              {/* Avatar */}
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#102a43]">
                <User className="h-6 w-6 text-[var(--cd-accent)]" aria-hidden />
              </div>
              <div>
                <h1 className="text-[20px] font-semibold text-[var(--cd-text-primary)]">{name}</h1>
                {lead?.title ? (
                  <p className="mt-0.5 text-[13px] text-[var(--cd-text-muted)]">
                    {lead.title}{lead.company ? ` · ${lead.company}` : ''}
                  </p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-2">
                  {lead?.email ? (
                    <a href={`mailto:${lead.email}`} className="flex items-center gap-1 text-[12px] text-[var(--cd-accent-dark)] hover:text-[var(--cd-accent)]">
                      <Mail className="h-3.5 w-3.5" aria-hidden />{lead.email}
                    </a>
                  ) : null}
                  {lead?.linkedinUrl ? (
                    <a href={lead.linkedinUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[12px] text-[var(--cd-accent-dark)] hover:text-[var(--cd-accent)]">
                      <Globe className="h-3.5 w-3.5" aria-hidden />LinkedIn
                    </a>
                  ) : null}
                  {lead?.phone ? (
                    <a href={`tel:${lead.phone}`} className="flex items-center gap-1 text-[12px] text-[var(--cd-accent-dark)] hover:text-[var(--cd-accent)]">
                      <Phone className="h-3.5 w-3.5" aria-hidden />{lead.phone}
                    </a>
                  ) : null}
                </div>
              </div>
            </div>

            {/* ICP Score */}
            <div className="flex shrink-0 flex-col items-center gap-1">
              <div className={cn('flex h-16 w-16 items-center justify-center rounded-full ring-2', scoreStyle.ring)}>
                <span className={cn('text-[22px] font-bold tabular-nums', scoreStyle.text)}>
                  {result.icpScore}
                </span>
              </div>
              <p className="text-[10px] uppercase tracking-wide text-[var(--cd-text-muted)]">ICP Score</p>
            </div>
          </div>

          {/* ICP Signals strip */}
          {signals.length > 0 ? (
            <div className="flex flex-wrap gap-2 border-t border-[var(--cd-border)] bg-[var(--cd-bg-footer)] px-5 py-3">
              <Zap className="h-3.5 w-3.5 shrink-0 text-[var(--cd-accent)]" aria-hidden />
              {signals.map((sig) => (
                <span key={sig} className="rounded-[4px] bg-[#102a43] px-2 py-0.5 text-[11px] font-medium text-[var(--cd-accent)]">
                  {sig}
                </span>
              ))}
            </div>
          ) : null}

          {/* Status footer */}
          <div className="flex items-center justify-between border-t border-[var(--cd-border)] px-5 py-2.5">
            <div className="flex items-center gap-2">
              {result.enrolledAt ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-[var(--cd-text-tag-cyan)]" aria-hidden />
                  <span className="text-[12px] text-[var(--cd-text-muted)]">Enrolled {formatDate(result.enrolledAt)}</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 text-[var(--cd-text-muted)]" aria-hidden />
                  <span className="text-[12px] text-[var(--cd-text-muted)]">Not yet enrolled · Status: {result.status}</span>
                </>
              )}
            </div>
            <span className="text-[11px] text-[var(--cd-text-muted)]">Found {formatDate(result.createdAt)}</span>
          </div>
        </div>

        {/* ── Two-column layout ── */}
        <div className="grid gap-4 lg:grid-cols-2">

          {/* Identity */}
          <EnrichSection title="Identity" icon={User}>
            <div className="divide-y divide-[var(--cd-border)]">
              {Object.entries(identity ?? {}).map(([k, v]) => (
                <KVRow key={k} label={k} value={renderValue(v)} />
              ))}
            </div>
          </EnrichSection>

          {/* Company */}
          <EnrichSection title="Company" icon={Building2}>
            <div className="divide-y divide-[var(--cd-border)]">
              {Object.entries(company ?? {}).map(([k, v]) => (
                <KVRow key={k} label={k} value={renderValue(v)} />
              ))}
            </div>
          </EnrichSection>

          {/* Contact */}
          <EnrichSection title="Contact Details" icon={Mail}>
            <div className="divide-y divide-[var(--cd-border)]">
              {Object.entries(contact ?? {}).map(([k, v]) => (
                <KVRow key={k} label={k} value={renderValue(v)} />
              ))}
            </div>
          </EnrichSection>

          {/* Tech stack */}
          {allTech.length > 0 ? (
            <EnrichSection title="Tech Stack" icon={Cpu}>
              <TagList tags={allTech} />
            </EnrichSection>
          ) : null}

          {/* AI Profile */}
          {profile ? (
            <EnrichSection title="AI Personality Profile" icon={TrendingUp}>
              <div className="space-y-3">
                {profile.disc ? (
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#102a43] text-[16px] font-bold text-[var(--cd-accent)]">
                      {profile.disc}
                    </span>
                    <div>
                      <p className="text-[13px] font-semibold text-[var(--cd-text-primary)]">
                        {DISC_LABELS[profile.disc]?.label ?? profile.disc}
                      </p>
                      <p className="text-[11px] text-[var(--cd-text-muted)]">
                        {DISC_LABELS[profile.disc]?.desc}
                      </p>
                    </div>
                  </div>
                ) : null}
                {profile.awarenessLevel !== null ? (
                  <KVRow label="Awareness Level" value={`${profile.awarenessLevel} / 5`} />
                ) : null}
                {profile.primaryFear ? (
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-[var(--cd-text-muted)]">Primary Fear</p>
                    <p className="mt-0.5 text-[13px] text-[var(--cd-text-secondary)]">{profile.primaryFear}</p>
                  </div>
                ) : null}
                {profile.egoIdentity ? (
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-[var(--cd-text-muted)]">Ego Identity</p>
                    <p className="mt-0.5 text-[13px] text-[var(--cd-text-secondary)]">{profile.egoIdentity}</p>
                  </div>
                ) : null}
                {triggers.length > 0 ? (
                  <div>
                    <p className="mb-1 text-[10px] uppercase tracking-wide text-[var(--cd-text-muted)]">Top Triggers</p>
                    <TagList tags={triggers} />
                  </div>
                ) : null}
                {profile.openingHook ? (
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-[var(--cd-text-muted)]">Opening Hook</p>
                    <p className="mt-0.5 text-[13px] italic leading-relaxed text-[var(--cd-text-secondary)]">
                      &ldquo;{profile.openingHook}&rdquo;
                    </p>
                  </div>
                ) : null}
                {profile.doNot ? (
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-[var(--cd-text-muted)]">Avoid</p>
                    <p className="mt-0.5 text-[13px] text-[var(--cd-text-secondary)]">{profile.doNot}</p>
                  </div>
                ) : null}
              </div>
            </EnrichSection>
          ) : null}

          {/* Other enrichment fields */}
          {Object.keys(other ?? {}).length > 0 || Object.keys(leadOther ?? {}).length > 0 ? (
            <EnrichSection title="Additional Enrichment Data" icon={Tag}>
              <div className="divide-y divide-[var(--cd-border)]">
                {Object.entries({ ...(other ?? {}), ...(leadOther ?? {}) }).map(([k, v]) => (
                  <div key={k} className="py-1.5">
                    <p className="text-[10px] text-[var(--cd-text-muted)]">{k}</p>
                    <p className="mt-0.5 text-[12px] text-[var(--cd-text-secondary)] break-all">
                      {renderValue(v)}
                    </p>
                  </div>
                ))}
              </div>
            </EnrichSection>
          ) : null}

        </div>

        {/* Full raw JSON — collapsed summary */}
        <details className="rounded-[8px] bg-[var(--cd-bg-card)]" style={{ boxShadow: 'var(--cd-shadow)' }}>
          <summary className="flex cursor-pointer items-center gap-2.5 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--cd-text-muted)] hover:text-[var(--cd-text-primary)]">
            <Tag className="h-4 w-4" aria-hidden />
            Raw Enrichment JSON
          </summary>
          <div className="border-t border-[var(--cd-border)] p-4">
            <pre className="overflow-auto rounded-[4px] bg-[#090c13] p-3 text-[11px] leading-relaxed text-[var(--cd-accent)]">
              {JSON.stringify(result.rawData, null, 2)}
            </pre>
          </div>
        </details>

      </div>
    </div>
  )
}
