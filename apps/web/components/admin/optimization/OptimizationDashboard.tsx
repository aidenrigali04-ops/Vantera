'use client'

import { AdminPageContent } from '@/components/admin/AdminPageContent'
import {
  AUDIT_DATE,
  AUDIT_DOC_PATH,
  OPTIMIZATION_FINDINGS,
  type FindingCategory,
  type FindingSeverity,
  type FindingStatus,
  type OptimizationFinding,
} from '@/lib/admin/optimization-findings'
import { fadeUp, staggerContainer } from '@/lib/motion'
import { motion } from 'framer-motion'
import { ShieldAlert, Sparkles, FlaskConical, Lock } from 'lucide-react'
import { useMemo, useState } from 'react'

const CATEGORY_META: Record<FindingCategory, { label: string; icon: typeof ShieldAlert }> = {
  security: { label: 'Security', icon: ShieldAlert },
  ux: { label: 'UX / Onboarding', icon: Sparkles },
  ab: { label: 'A/B experiments', icon: FlaskConical },
}

const SEVERITY_STYLE: Record<FindingSeverity, { label: string; cls: string }> = {
  high: { label: 'High', cls: 'border-[var(--danger)]/40 bg-[var(--danger-muted)] text-[var(--danger)]' },
  medium: { label: 'Medium', cls: 'border-[var(--warning)]/40 bg-[var(--warning-muted)] text-[var(--warning)]' },
  low: { label: 'Low', cls: 'border-[var(--border-strong)] bg-[var(--bg-overlay)] text-[var(--text-tertiary)]' },
  info: { label: 'Info', cls: 'border-[var(--accent-border)] bg-[var(--accent-muted)] text-[var(--accent)]' },
  opportunity: { label: 'Experiment', cls: 'border-[var(--accent-border)] bg-[var(--accent-muted)] text-[var(--accent)]' },
}

const STATUS_STYLE: Record<FindingStatus, { label: string; cls: string }> = {
  open: { label: 'Open', cls: 'text-[var(--text-tertiary)]' },
  in_progress: { label: 'In progress', cls: 'text-[var(--warning)]' },
  done: { label: 'Done', cls: 'text-[var(--success)]' },
}

const SEVERITY_RANK: Record<FindingSeverity, number> = {
  high: 0,
  medium: 1,
  low: 2,
  opportunity: 3,
  info: 4,
}

type Filter = 'all' | FindingCategory

function ScoreCard({
  label,
  count,
  highest,
  icon: Icon,
}: {
  label: string
  count: number
  highest: FindingSeverity | null
  icon: typeof ShieldAlert
}) {
  return (
    <motion.article variants={fadeUp} className="vision-kpi-card rounded-2xl p-5">
      <div className="flex items-start justify-between">
        <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--text-disabled)]">
          {label}
        </p>
        <Icon className="h-4 w-4 text-[var(--text-tertiary)]" strokeWidth={1.75} aria-hidden />
      </div>
      <p className="mt-2 text-3xl font-bold tracking-[-0.02em] text-[var(--text-primary)]">{count}</p>
      {highest ? (
        <span
          className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${SEVERITY_STYLE[highest].cls}`}
        >
          Top: {SEVERITY_STYLE[highest].label}
        </span>
      ) : null}
    </motion.article>
  )
}

function FindingCard({ finding }: { finding: OptimizationFinding }) {
  const sev = SEVERITY_STYLE[finding.severity]
  const status = STATUS_STYLE[finding.status]
  return (
    <motion.article variants={fadeUp} className="vision-panel-card rounded-2xl p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-[var(--bg-overlay)] px-2 py-0.5 font-mono text-[11px] font-semibold text-[var(--text-secondary)]">
          {finding.id}
        </span>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${sev.cls}`}>
          {sev.label}
        </span>
        <span className={`ml-auto text-[11px] font-medium ${status.cls}`}>{status.label}</span>
      </div>

      <h3 className="mt-3 text-[15px] font-semibold leading-snug text-[var(--text-primary)]">
        {finding.title}
      </h3>
      <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-tertiary)]">{finding.summary}</p>

      <div className="mt-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-disabled)]">
          Fix
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-secondary)]">
          {finding.recommendation}
        </p>
      </div>

      <p className="mt-3 font-mono text-[11px] text-[var(--text-disabled)]">{finding.location}</p>
    </motion.article>
  )
}

export function OptimizationDashboard() {
  const [filter, setFilter] = useState<Filter>('all')

  const byCategory = useMemo(() => {
    const groups: Record<FindingCategory, OptimizationFinding[]> = { security: [], ux: [], ab: [] }
    for (const f of OPTIMIZATION_FINDINGS) groups[f.category].push(f)
    for (const key of Object.keys(groups) as FindingCategory[]) {
      groups[key].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])
    }
    return groups
  }, [])

  const openCount = OPTIMIZATION_FINDINGS.filter((f) => f.status !== 'done').length

  const visible = useMemo(
    () =>
      (filter === 'all'
        ? OPTIMIZATION_FINDINGS
        : OPTIMIZATION_FINDINGS.filter((f) => f.category === filter)
      )
        .slice()
        .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]),
    [filter],
  )

  const highestOf = (cat: FindingCategory): FindingSeverity | null => {
    const list = byCategory[cat].filter((f) => f.status !== 'done')
    return list.length ? list.reduce((min, f) => (SEVERITY_RANK[f.severity] < SEVERITY_RANK[min] ? f.severity : min), list[0]!.severity) : null
  }

  return (
    <AdminPageContent>
      <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-5">
        {/* header */}
        <motion.header variants={fadeUp} className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-[var(--accent)]" aria-hidden />
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-disabled)]">
                Owner only
              </span>
            </div>
            <h1 className="mt-1 text-[22px] font-bold tracking-[-0.02em] text-[var(--text-primary)]">
              Optimization dashboard
            </h1>
            <p className="mt-1 text-[13px] text-[var(--text-tertiary)]">
              Audit of {AUDIT_DATE}. Reference any item by ID (e.g. “implement SEC-001”). Full
              write-up: <span className="font-mono text-[12px]">{AUDIT_DOC_PATH}</span>
            </p>
          </div>
          <span className="rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-1 text-[12px] font-semibold text-[var(--text-secondary)]">
            {openCount} open
          </span>
        </motion.header>

        {/* scoreboard */}
        <motion.div variants={fadeUp} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {(Object.keys(CATEGORY_META) as FindingCategory[]).map((cat) => (
            <ScoreCard
              key={cat}
              label={CATEGORY_META[cat].label}
              count={byCategory[cat].filter((f) => f.status !== 'done').length}
              highest={highestOf(cat)}
              icon={CATEGORY_META[cat].icon}
            />
          ))}
        </motion.div>

        {/* filter */}
        <motion.div variants={fadeUp} className="flex flex-wrap gap-2">
          {(['all', 'security', 'ux', 'ab'] as Filter[]).map((key) => {
            const active = filter === key
            const label = key === 'all' ? 'All' : CATEGORY_META[key].label
            return (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors ${
                  active
                    ? 'border-[var(--accent-border)] bg-[var(--accent-muted)] text-[var(--accent)]'
                    : 'border-[var(--border-default)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {label}
              </button>
            )
          })}
        </motion.div>

        {/* findings */}
        <motion.div variants={fadeUp} className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {visible.map((finding) => (
            <FindingCard key={finding.id} finding={finding} />
          ))}
        </motion.div>
      </motion.div>
    </AdminPageContent>
  )
}
