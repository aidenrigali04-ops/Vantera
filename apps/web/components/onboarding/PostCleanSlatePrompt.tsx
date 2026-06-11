'use client'

import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { useEffect, useState } from 'react'

/** Shown after clean slate — guided empty state per onboarding spec. */
export function PostCleanSlatePrompt() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setVisible(window.sessionStorage.getItem('vantera_clean_slate') === 'true')
  }, [])

  if (!visible) return null

  function dismiss() {
    window.sessionStorage.removeItem('vantera_clean_slate')
    setVisible(false)
  }

  return (
    <div className="rounded-xl border border-[var(--border-default)] bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-[var(--text-primary)]">Your workspace is ready</h3>
      <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
        Sample data cleared. Head to your pipeline to start prospecting and building outreach campaigns.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button asChild size="sm">
          <Link href="/admin/leads">Go to pipeline →</Link>
        </Button>
        <Button variant="outline" size="sm" onClick={dismiss}>
          Dismiss
        </Button>
      </div>
    </div>
  )
}
