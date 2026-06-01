'use client'

import { OperatingModelModal } from '@/components/onboarding/OperatingModelModal'
import { hasSelectedOperatingModel } from '@/lib/onboarding/operating-model-storage'
import { useEffect, useState } from 'react'

type Props = {
  accountId: string
  enabled: boolean
}

/** Shows the operating model picker once on first dashboard visit during onboarding. */
export function OperatingModelHost({ accountId, enabled }: Props) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!enabled || hasSelectedOperatingModel(accountId)) return
    const timer = window.setTimeout(() => setOpen(true), 400)
    return () => window.clearTimeout(timer)
  }, [accountId, enabled])

  if (!enabled) return null

  return (
    <OperatingModelModal
      accountId={accountId}
      open={open}
      onOpenChange={(next) => {
        if (!next && !hasSelectedOperatingModel(accountId)) return
        setOpen(next)
      }}
    />
  )
}
