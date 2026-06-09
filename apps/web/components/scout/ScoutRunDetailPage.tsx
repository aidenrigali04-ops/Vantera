'use client'

import Link from 'next/link'
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, Mail, Globe, User, Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type Search = {
  id: string
  name: string
  runFrequency: string
  lastRunAt: string | null
  totalFound: number
  isActive: boolean
  createdAt: string
}

type ResultRow = {
  result: {
    id: string
    icpScore: number
    icpSignals: unknown
    status: string
    enrolledAt: string | null
    createdAt: string
    apifyId: string | null
  }
  firstName: string | null
  lastName: string | null
  title: string | null
  company: string
  email: string | null
  linkedinUrl: string | null
  score: number | null
  relationshipStatus: string | null
}

type Props = {
  search: Search
  results: ResultRow[]
}

const STATUS_COLORS: Record<string, string> = {
  found: 'bg-[#102a43] text-[var(--cd-accent)]',
  enrolled: 'bg-[var(--cd-bg-tag-cyan)] text-[var(--cd-text-tag-cyan)]',
  skipped: 'bg-[#1f2933] text-[var(--cd-text-muted)]',
  rejected: 'bg-[var(--cd-bg-tag-red)] text-[var(--cd-text-tag-red)]',
}

function formatDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function icpColor(score: number) {
  if (score >= 75) return 'text-[var(--cd-text-tag-cyan)]'
  if (score >= 50) return 'text-[var(--cd-text-tag-orange)]'
  return 'text-[var(--cd-text-muted)]'
}

export function ScoutRunDetailPage({ search, results }: Props) {
  const enrolled = results.filter((r) => r.result.enrolledAt).length
  const avgScore =
    results.length > 0
      ? Math.round(results.reduce((s, r) => s + r.result.icpScore, 0) / results.length)
      : 0

  return (
    <div className="client-detail min-h-screen bg-[var(--cd-bg-outer)]">
      <div className="px-6 pt-5 pb-2">
        <Link
          href="/admin/outreach/agents/scout"
          className="inline-flex items-center gap-1.5 text-[12px] text-[var(--cd-text-muted)] transition-colors hover:text-[var(--cd-text-primary)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Back to ProspectScout
        </Link>
      </div>

      <div className="mx-auto max-w-[1100px] space-y-5 px-6 pb-12">

        {/* Header */}
        <div>
          <div className="flex items-start justify-between gap-4 py-3 px-1">
            <div>
              <h1 className="text-[20px] font-semibold text-[var(--cd-text-primary)]">{search.name}</h1>
              <p className="mt-0.5 text-[12px] text-[var(--cd-text-muted)]">
                {search.runFrequency} run · Last ran {formatDate(search.lastRunAt)}
              </p>
            </div>
            <span
              className={cn(
                'mt-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
                search.isActive
                  ? 'bg-[var(--cd-bg-tag-cyan)] text-[var(--cd-text-tag-cyan)]'
                  : 'bg-[#102a43] text-[var(--cd-text-muted)]',
              )}
            >
              {search.isActive ? 'Active' : 'Paused'}
            </span>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Prospects Found', value: results.length },
              { label: 'Enrolled in Sequence', value: enrolled },
              { label: 'Avg ICP Score', value: avgScore },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="rounded-[8px] bg-[var(--cd-bg-card)] px-4 py-3"
                style={{ boxShadow: 'var(--cd-shadow)' }}
              >
                <p className="text-[11px] uppercase tracking-wide text-[var(--cd-text-muted)]">{label}</p>
                <p className="mt-1 text-[22px] font-semibold text-[var(--cd-text-primary)]">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Results list */}
        <section>
          <div className="px-1 py-3">
            <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--cd-text-primary)]">
              Prospects ({results.length})
            </p>
          </div>

          {results.length === 0 ? (
            <div
              className="flex items-center gap-3 rounded-[8px] bg-[var(--cd-bg-card)] px-5 py-5"
              style={{ boxShadow: 'var(--cd-shadow)' }}
            >
              <Clock className="h-4 w-4 text-[var(--cd-text-muted)]" aria-hidden />
              <p className="text-[13px] text-[var(--cd-text-muted)]">No results found for this run yet.</p>
            </div>
          ) : (
            <div
              className="overflow-hidden rounded-[8px] bg-[var(--cd-bg-card)]"
              style={{ boxShadow: 'var(--cd-shadow)' }}
            >
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--cd-border)]">
                    {['Prospect', 'Company', 'ICP Score', 'Status', 'Found', ''].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--cd-text-muted)]"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--cd-border)]">
                  {results.map(({ result, firstName, lastName, title, company, email, linkedinUrl, score, relationshipStatus }) => {
                    const name = `${firstName ?? ''} ${lastName ?? ''}`.trim() || '—'
                    const signals = (Array.isArray(result.icpSignals) ? result.icpSignals : []) as string[]
                    return (
                      <tr
                        key={result.id}
                        className="group transition-colors hover:bg-[#0d1a26]"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="icon-tile flex h-7 w-7 shrink-0 items-center justify-center rounded-full">
                              <User className="h-3.5 w-3.5 text-[var(--text-secondary)]" strokeWidth={1.75} aria-hidden />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[13px] font-medium text-[var(--cd-text-primary)]">{name}</p>
                              {title ? (
                                <p className="text-[11px] text-[var(--cd-text-muted)]">{title}</p>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 shrink-0 text-[var(--cd-text-muted)]" aria-hidden />
                            <span className="text-[13px] text-[var(--cd-text-secondary)]">{company}</span>
                          </div>
                          <div className="mt-1 flex gap-1.5">
                            {email ? (
                              <span title={email}>
                                <Mail className="h-3 w-3 text-[var(--cd-accent-dark)]" aria-hidden />
                              </span>
                            ) : null}
                            {linkedinUrl ? (
                              <span>
                                <Globe className="h-3 w-3 text-[var(--cd-accent-dark)]" aria-hidden />
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className={cn('text-[18px] font-bold tabular-nums', icpColor(result.icpScore))}>
                              {result.icpScore}
                            </span>
                            <div className="flex flex-col gap-0.5">
                              {signals.slice(0, 2).map((sig) => (
                                <span
                                  key={sig}
                                  className="rounded bg-[#102a43] px-1.5 py-0.5 text-[10px] text-[var(--cd-accent)]"
                                >
                                  {sig}
                                </span>
                              ))}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              'rounded-full px-2 py-0.5 text-[11px] font-medium',
                              STATUS_COLORS[result.status] ?? STATUS_COLORS.found,
                            )}
                          >
                            {result.enrolledAt ? 'Enrolled' : result.status}
                          </span>
                          {result.enrolledAt ? (
                            <p className="mt-1 text-[10px] text-[var(--cd-text-muted)]">
                              {formatDate(result.enrolledAt)}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-[12px] text-[var(--cd-text-muted)]">
                          {formatDate(result.createdAt)}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <Link
                            href={`/admin/outreach/agents/scout/runs/${encodeURIComponent(search.id)}/results/${encodeURIComponent(result.id)}`}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[var(--cd-text-muted)] transition-colors hover:bg-[var(--cd-accent)] hover:text-[var(--cd-accent-text)]"
                            aria-label={`View enrichment for ${name}`}
                          >
                            <ArrowRight className="h-4 w-4" aria-hidden />
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
