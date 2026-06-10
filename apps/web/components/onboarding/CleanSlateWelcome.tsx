'use client'

import { Button } from '@/components/ui/button'
import { DURATION, EASE_OUT } from '@/lib/motion'
import { motion } from 'framer-motion'
import Link from 'next/link'

type Props = {
  primaryColor?: string
}

export function CleanSlateWelcome({ primaryColor: _primaryColor }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.page, ease: EASE_OUT }}
      className="card-surface p-8 text-center sm:p-10"
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
        Fresh workspace
      </p>
      <h2 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-[var(--text-primary)] sm:text-3xl">
        Ready to find your first prospects.
      </h2>
      <p className="mx-auto mt-3 max-w-lg text-[13px] leading-relaxed text-[var(--text-secondary)]">
        Search 285M prospects and launch your first outreach campaign in minutes.
      </p>
      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Button
          type="button"
          size="lg"
          className="min-w-[200px] bg-[var(--text-primary)] text-[var(--text-inverse)] hover:opacity-90"
          asChild
        >
          <Link href="/admin/sdr-agents">Find prospects</Link>
        </Button>
        <Button
          type="button"
          size="lg"
          variant="outline"
          className="min-w-[200px] border-[var(--border-default)] text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
          asChild
        >
          <Link href="/admin/agents">Configure agents</Link>
        </Button>
      </div>
    </motion.div>
  )
}
