'use client'

import { addTag } from '@/app/(admin)/admin/contacts/actions'
import { formatRelativeTime, formatUsdFromCents } from '@/lib/contacts/format'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import type { contacts, intelligenceSignals } from '@vantera/db'
import { Brain, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

type Contact = typeof contacts.$inferSelect
type Signal = typeof intelligenceSignals.$inferSelect

type Props = {
  contact: Contact
  signals: Signal[]
}

function healthLabel(score: number): { label: string; sub: string; color: string } {
  if (score > 70) return { label: 'At Risk', sub: 'At Risk', color: '#EF4444' }
  if (score >= 40) return { label: 'Watch', sub: 'Watch', color: '#F59E0B' }
  return { label: 'Low Risk', sub: 'Low Risk', color: '#10B981' }
}

export function AIInsightPanel({ contact, signals }: Props) {
  const [tagInput, setTagInput] = useState('')
  const health = healthLabel(contact.churnRiskScore)
  const avgJob = contact.ltvCents > 0 ? Math.round(contact.ltvCents / 100 / Math.max(1, 3)) : 0

  const handleAddTag = async () => {
    if (!tagInput.trim()) return
    const result = await addTag(contact.id, tagInput.trim())
    if (!result.success) {
      toast.error(result.error)
      return
    }
    setTagInput('')
    toast.success('Tag added')
  }

  return (
    <aside className="sticky top-6 space-y-4">
      <section className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
        <h3 className="text-xs font-medium uppercase tracking-wide text-stone-500">
          Relationship Health
        </h3>
        <div className="mt-4 flex flex-col items-center">
          <svg width="80" height="80" viewBox="0 0 80 80" className="mb-3">
            <circle cx="40" cy="40" r="34" fill="none" stroke="#E7E5E4" strokeWidth="8" />
            <circle
              cx="40"
              cy="40"
              r="34"
              fill="none"
              stroke={health.color}
              strokeWidth="8"
              strokeDasharray={`${(contact.churnRiskScore / 100) * 213.6} 213.6`}
              strokeLinecap="round"
              transform="rotate(-90 40 40)"
            />
            <text x="40" y="44" textAnchor="middle" className="fill-stone-900 text-sm font-semibold">
              {contact.churnRiskScore}
            </text>
          </svg>
          <p className="font-medium text-stone-900">{health.label}</p>
        </div>
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
        <p className="text-2xl font-bold text-stone-900">{formatUsdFromCents(contact.ltvCents)}</p>
        <p className="text-sm text-stone-500">Lifetime Value</p>
        {avgJob > 0 ? (
          <p className="mt-1 text-xs text-stone-400">Avg. job: {formatUsdFromCents(avgJob * 100)}</p>
        ) : null}
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="space-y-4">
          <ScoreBar label="Churn Risk" score={contact.churnRiskScore} danger />
          <ScoreBar label="Upsell Score" score={contact.upsellScore} />
        </div>
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-stone-500">Tags</h3>
        <div className="flex flex-wrap gap-2">
          {(contact.tags ?? []).map((tag) => (
            <Badge
              key={tag}
              className={cn(
                tag.toLowerCase() === 'vip' && 'bg-amber-100 text-amber-800',
                tag.toLowerCase().includes('risk') && 'bg-red-100 text-red-800',
                tag.toLowerCase().includes('maintenance') && 'bg-teal-100 text-teal-800',
              )}
            >
              {tag}
            </Badge>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <Input
            placeholder="Add tag"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            className="h-8 text-sm"
          />
          <Button size="sm" variant="outline" onClick={handleAddTag}>
            Add
          </Button>
        </div>
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-stone-500">
          Quick Intel
        </h3>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-stone-500">Last portal login</dt>
            <dd>{contact.portalLastLoginAt ? formatRelativeTime(contact.portalLastLoginAt) : 'Never'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-stone-500">Active since</dt>
            <dd>{new Date(contact.createdAt).toLocaleDateString()}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
        <h3 className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-stone-500">
          <Sparkles className="h-3.5 w-3.5" /> AI Recommendations
        </h3>
        <div className="space-y-2">
          <Button variant="outline" size="sm" className="w-full justify-start">
            <Brain className="mr-2 h-4 w-4" /> Ask Sales Agent
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start">
            <Brain className="mr-2 h-4 w-4" /> Ask Intelligence Agent
          </Button>
        </div>
        {signals.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {signals.map((signal) => (
              <li key={signal.id} className="rounded-lg bg-stone-50 p-3 text-sm">
                <p className="font-medium text-stone-900">{signal.headline}</p>
                {signal.recommendation ? (
                  <p className="mt-1 text-stone-600">{signal.recommendation}</p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </aside>
  )
}

function ScoreBar({
  label,
  score,
  danger,
}: {
  label: string
  score: number
  danger?: boolean
}) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="text-stone-600">{label}</span>
        <span className="font-medium">{score}</span>
      </div>
      <Progress
        value={score}
        className={cn('h-2', danger && score > 70 && '[&>div]:bg-red-500')}
      />
    </div>
  )
}
