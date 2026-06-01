'use client'

import { PageHeader } from '@/components/operational/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

type SequenceRow = {
  sequence: {
    id: string
    status: string
    currentStep: number
    totalSteps: number
    nextStepAt: Date | null
    replyType: string | null
  }
  firstName: string | null
  lastName: string | null
  company: string
  score: number
}

type Props = {
  rows: SequenceRow[]
}

export function SdrSequencesPageClient({ rows }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<string[]>([])
  const [isPending, startTransition] = useTransition()

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    )
  }

  function cancelSelected() {
    if (selected.length === 0) return
    startTransition(async () => {
      const res = await fetch('/api/sdr/sequences', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sequenceIds: selected }),
      })
      const json = await res.json()
      if (!json.success) {
        toast.error(json.error ?? 'Cancel failed')
        return
      }
      toast.success(`Cancelled ${json.data.cancelled} sequences`)
      setSelected([])
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Active sequences"
        description="Every prospect enrolled in your SDR agent's nurture sequence."
        actions={
          <Button variant="outline" asChild>
            <Link href="/admin/outreach/agents">Back to command center</Link>
          </Button>
        }
      />

      {selected.length > 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
          <span className="text-sm text-stone-600">{selected.length} selected</span>
          <Button size="sm" variant="outline" disabled={isPending} onClick={cancelSelected}>
            Cancel selected
          </Button>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-stone-200">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-left text-xs text-stone-500">
            <tr>
              <th className="px-3 py-2" />
              <th className="px-3 py-2">Contact</th>
              <th className="px-3 py-2">ICP</th>
              <th className="px-3 py-2">Step</th>
              <th className="px-3 py-2">Next send</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ sequence, firstName, lastName, company, score }) => (
              <tr key={sequence.id} className="border-t border-stone-100">
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selected.includes(sequence.id)}
                    onChange={() => toggle(sequence.id)}
                  />
                </td>
                <td className="px-3 py-2">
                  <p className="font-medium text-stone-900">
                    {[firstName, lastName].filter(Boolean).join(' ') || 'Unknown'}
                  </p>
                  <p className="text-xs text-stone-500">{company}</p>
                </td>
                <td className="px-3 py-2">{score}/100</td>
                <td className="px-3 py-2">
                  {sequence.currentStep}/{sequence.totalSteps}
                </td>
                <td className="px-3 py-2 text-stone-600">
                  {sequence.nextStepAt
                    ? new Date(sequence.nextStepAt).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })
                    : '—'}
                </td>
                <td className="px-3 py-2">
                  <Badge variant="outline">{sequence.status}</Badge>
                  {sequence.replyType ? (
                    <span className="ml-1 text-xs text-stone-500">{sequence.replyType}</span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <p className="p-6 text-center text-sm text-stone-500">No sequences yet.</p>
        ) : null}
      </div>
    </div>
  )
}
