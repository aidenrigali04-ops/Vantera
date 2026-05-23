'use client'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { clearSampleDataAction } from '@/app/(admin)/admin/dashboard/actions'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'

type Props = {
  accountId: string
}

const DISMISS_KEY_PREFIX = 'vantera_sample_banner_dismissed'

export function SampleDataBanner({ accountId }: Props) {
  const router = useRouter()
  const [dismissed, setDismissed] = useState(false)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (typeof window === 'undefined') return
    const flag = window.localStorage.getItem(`${DISMISS_KEY_PREFIX}_${accountId}`)
    if (flag === 'true') setDismissed(true)
  }, [accountId])

  function handleKeep() {
    setDismissed(true)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(`${DISMISS_KEY_PREFIX}_${accountId}`, 'true')
    }
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
      }
      setOpen(false)
      router.refresh()
    })
  }

  if (dismissed) return null

  return (
    <>
      <div className="border-b border-primary/20 bg-primary/5">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-3 px-4 py-2.5 text-sm sm:flex-row sm:items-center sm:px-6">
          <div className="flex items-center gap-2 text-foreground">
            <span aria-hidden className="inline-block size-2 shrink-0 rounded-full bg-primary" />
            <span className="font-medium">This is sample data — replace it with yours.</span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={handleKeep}>
              Keep sample data
            </Button>
            <Button size="sm" onClick={() => setOpen(true)}>
              I&rsquo;m ready to set up my workspace
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={(o) => (!isPending ? setOpen(o) : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set up your workspace?</DialogTitle>
            <DialogDescription>
              This will clear the sample data. Your pipeline, clients, and projects will start
              fresh. The pipeline stages you see now will stay so you can add your first real
              client right away.
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
