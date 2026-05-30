'use client'

import {
  clearSampleDataAction,
  keepSampleDataAction,
} from '@/app/(admin)/admin/dashboard/actions'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'

type Props = {
  accountId: string
  onboardingIncomplete?: boolean
}

const DISMISS_KEY_PREFIX = 'vantera_sample_banner_dismissed'

export function SampleDataBanner({ accountId, onboardingIncomplete = false }: Props) {
  const router = useRouter()
  const [dismissed, setDismissed] = useState(false)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (onboardingIncomplete) return
    if (typeof window === 'undefined') return
    const flag = window.localStorage.getItem(`${DISMISS_KEY_PREFIX}_${accountId}`)
    if (flag === 'true') setDismissed(true)
  }, [accountId, onboardingIncomplete])

  function handleKeep() {
    startTransition(async () => {
      if (onboardingIncomplete) {
        const result = await keepSampleDataAction()
        if (!result.success) {
          setError(result.error ?? 'Failed to complete setup')
          return
        }
      } else {
        setDismissed(true)
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(`${DISMISS_KEY_PREFIX}_${accountId}`, 'true')
        }
      }
      router.refresh()
    })
  }

  function handleConfirm() {
    setError(null)
    startTransition(async () => {
      const result = await clearSampleDataAction()
      if (!result.success) {
        setError(result.error ?? 'Failed to clear sample data')
        return
      }
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(`${DISMISS_KEY_PREFIX}_${accountId}`)
        window.sessionStorage.setItem('vantera_clean_slate', 'true')
      }
      setOpen(false)
      router.refresh()
    })
  }

  if (dismissed && !onboardingIncomplete) return null

  return (
    <>
      <div className="border-b border-amber-200/60 bg-amber-50">
        <div className="flex flex-col items-start justify-between gap-3 px-4 py-2.5 text-sm sm:flex-row sm:items-center sm:px-6">
          <div className="flex items-center gap-2 text-stone-800">
            <span
              aria-hidden
              className="inline-block size-1.5 shrink-0 rounded-full bg-amber-500"
            />
            <span className="font-medium">This is sample data — replace it with yours.</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleKeep}
              disabled={isPending}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900 disabled:opacity-50"
            >
              Keep sample data
            </button>
            <button
              type="button"
              onClick={() => setOpen(true)}
              disabled={isPending}
              className="rounded-md border border-stone-900 bg-stone-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-stone-800 disabled:opacity-50"
            >
              I&rsquo;m ready to set up my workspace
            </button>
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={(o) => (!isPending ? setOpen(o) : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set up your workspace?</DialogTitle>
            <DialogDescription>
              This will clear the sample data. Your pipeline, clients, and projects will start
              fresh.
            </DialogDescription>
          </DialogHeader>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={isPending}>
              {isPending ? 'Clearing…' : 'Clear sample data'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
