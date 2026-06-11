'use client'

import type { PreviewLead } from '@/lib/onboarding/onboarding-wizard-types'
import { motion } from 'framer-motion'
import { MapPin, Radar, Sparkles } from 'lucide-react'
import { useCallback } from 'react'
import { useRegisterOnboardingStep } from '../onboarding-nav'
import { fadeUp, stepContainer } from '../_primitives'

type Props = {
  leads: PreviewLead[]
}

function LeadRow({ lead, rank }: { lead: PreviewLead; rank: number }) {
  const location = [lead.city, lead.state].filter(Boolean).join(', ')
  const name = [lead.firstName, lead.lastName].filter(Boolean).join(' ')

  return (
    <div className="flex items-start gap-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2.5">
      <span className="icon-tile flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-[var(--text-secondary)]">
        {rank}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-[var(--text-primary)]">{name}</p>
        <p className="truncate text-[12px] text-[var(--text-secondary)]">
          {lead.title}
          {lead.organizationName ? ` · ${lead.organizationName}` : ''}
        </p>
        {location ? (
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-[var(--text-tertiary)]">
            <MapPin className="h-3 w-3" aria-hidden />
            {location}
          </p>
        ) : null}
      </div>
      <div className="shrink-0 text-right">
        <p className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-muted)] px-2 py-0.5 text-[11px] font-semibold text-[var(--highlight-text)]">
          <Sparkles className="h-3 w-3" aria-hidden />
          {lead.icpScore}% match
        </p>
      </div>
    </div>
  )
}

export function Step3LeadPreview({ leads }: Props) {
  const submit = useCallback(async () => true, [])

  // Zero leads is never a dead end: discovery keeps running server-side after
  // setup, so the user always continues to plan selection.
  useRegisterOnboardingStep({
    canAdvance: true,
    isSubmitting: false,
    submit,
    primaryLabel: 'Choose my plan',
  })

  return (
    <motion.div variants={stepContainer} initial="hidden" animate="show" className="space-y-2">
      {leads.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-[var(--border-default)] py-8 text-center">
          <span className="icon-tile flex h-10 w-10 items-center justify-center rounded-full">
            <Radar className="h-5 w-5 text-[var(--highlight-text)]" strokeWidth={1.75} aria-hidden />
          </span>
          <p className="text-[13px] font-medium text-[var(--text-primary)]">
            Lead discovery is warming up
          </p>
          <p className="max-w-[260px] text-[12px] leading-relaxed text-[var(--text-tertiary)]">
            Your agent keeps hunting in the background — fresh matches land on your dashboard.
            Keep going; setup takes one more minute.
          </p>
        </div>
      ) : (
        <>
          <motion.p variants={fadeUp} className="pb-1 text-[13px] text-[var(--text-secondary)]">
            <span className="font-semibold text-[var(--text-primary)]">{leads.length}</span>{' '}
            decision-maker{leads.length === 1 ? '' : 's'} matched your ideal customer profile.
          </motion.p>
          {leads.map((lead, index) => (
            <motion.div key={lead.id} variants={fadeUp}>
              <LeadRow lead={lead} rank={index + 1} />
            </motion.div>
          ))}
          <motion.p variants={fadeUp} className="pt-1 text-[12px] text-[var(--text-tertiary)]">
            This is a preview — pick a plan next and your agent starts reaching out to the full list.
          </motion.p>
        </>
      )}
    </motion.div>
  )
}
