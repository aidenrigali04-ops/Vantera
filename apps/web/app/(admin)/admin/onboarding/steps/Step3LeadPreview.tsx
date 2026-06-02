'use client'

import type { PreviewLead } from '@/lib/onboarding/onboarding-wizard-types'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { MapPin, Sparkles } from 'lucide-react'
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
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent-muted)] text-[11px] font-semibold text-[var(--accent)]">
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
        <p className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--accent)]">
          <Sparkles className="h-3 w-3" aria-hidden />
          {lead.icpScore}% match
        </p>
      </div>
    </div>
  )
}

export function Step3LeadPreview({ leads }: Props) {
  useRegisterOnboardingStep({
    canAdvance: leads.length > 0,
    isSubmitting: false,
    submit: async () => true,
    primaryLabel: 'Get Started',
  })

  return (
    <motion.div variants={stepContainer} initial="hidden" animate="show" className="space-y-2">
      {leads.length === 0 ? (
        <p className="text-[13px] text-[var(--text-secondary)]">
          No preview leads yet. Go back and run lead discovery.
        </p>
      ) : (
        leads.map((lead, index) => (
          <motion.div key={lead.id} variants={fadeUp}>
            <LeadRow lead={lead} rank={index + 1} />
          </motion.div>
        ))
      )}

      {leads.length > 0 ? (
        <motion.p
          variants={fadeUp}
          className={cn('pt-1 text-[12px] text-[var(--text-tertiary)]')}
        >
          These are a preview — unlock full discovery and outreach on the next step.
        </motion.p>
      ) : null}
    </motion.div>
  )
}
