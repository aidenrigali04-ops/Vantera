'use client'

import { Button } from '@/components/ui/button'
import { DURATION, EASE_OUT } from '@/lib/motion'
import { useOnboardingStore } from '@/lib/stores/onboarding-store'
import { motion } from 'framer-motion'

type Props = {
  primaryColor: string
}

export function CleanSlateWelcome({ primaryColor }: Props) {
  const { setNewClientDrawerOpen, setCsvImportOpen } = useOnboardingStore()

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.page, ease: EASE_OUT }}
      className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-8 text-center sm:p-10"
    >
      <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
        Welcome to your operating system.
      </h2>
      <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-white/55">
        Start by adding your first client, or import your existing data.
      </p>
      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Button
          type="button"
          size="lg"
          className="min-w-[200px] bg-white text-stone-900 hover:bg-white/90"
          style={{ boxShadow: `0 0 0 1px ${primaryColor}33 inset` }}
          onClick={() => setNewClientDrawerOpen(true)}
        >
          Add my first client
        </Button>
        <Button
          type="button"
          size="lg"
          variant="outline"
          className="min-w-[200px] border-white/20 bg-transparent text-white hover:bg-white/[0.06] hover:text-white"
          onClick={() => setCsvImportOpen(true)}
        >
          Import from CSV
        </Button>
      </div>
    </motion.div>
  )
}
