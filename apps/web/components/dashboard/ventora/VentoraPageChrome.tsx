'use client'

import { fadeUp } from '@/lib/motion'
import { useBranding } from '@/lib/branding/context'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { ChevronRight, Sparkles } from 'lucide-react'

type Props = {
  title?: string
  subtitle?: string
  className?: string
}

export function VentoraPageChrome({ title = 'Dashboard', subtitle, className }: Props) {
  const { businessName } = useBranding()
  const workspace = businessName?.trim() || 'Ventora'

  return (
    <motion.header
      className={cn('space-y-3', className)}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
    >
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[13px] text-[var(--text-secondary)]">
        <span className="font-medium">Team</span>
        <ChevronRight size={14} className="text-[var(--text-tertiary)]" aria-hidden />
        <span className="inline-flex items-center gap-1.5 font-medium text-[var(--text-primary)]">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[var(--accent-muted)]">
            <Sparkles size={12} className="text-[var(--accent)]" strokeWidth={2} aria-hidden />
          </span>
          {workspace}
        </span>
      </nav>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-[-0.03em] text-[var(--text-primary)] sm:text-[1.75rem]">
          {title}
        </h1>
        {subtitle ? (
          <p className="max-w-2xl text-[13px] leading-relaxed text-[var(--text-secondary)]">{subtitle}</p>
        ) : null}
      </div>
    </motion.header>
  )
}
