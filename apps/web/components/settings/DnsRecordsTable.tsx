'use client'

import { Button } from '@/components/ui/button'
import type { ResendDnsRecord } from '@/lib/outreach/resend-domains'
import { cn } from '@/lib/utils'
import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

type Props = {
  title: string
  description: string
  records: ResendDnsRecord[]
  emptyMessage?: string
}

function recordStatusTone(status?: string): string {
  switch (status) {
    case 'verified':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-200/80'
    case 'failed':
    case 'temporary_failure':
      return 'bg-red-50 text-red-700 ring-red-200/80'
    default:
      return 'bg-amber-50 text-amber-800 ring-amber-200/80'
  }
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      toast.success(`${label} copied`)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('Could not copy — select the text manually')
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-7 px-2 text-xs"
      onClick={handleCopy}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  )
}

export function DnsRecordsTable({ title, description, records, emptyMessage }: Props) {
  if (records.length === 0) {
    return emptyMessage ? (
      <div className="rounded-xl border border-dashed border-stone-200 px-4 py-3 text-sm text-stone-500">
        {emptyMessage}
      </div>
    ) : null
  }

  return (
    <div className="overflow-hidden rounded-xl border border-stone-200">
      <div className="border-b border-stone-200 bg-stone-50 px-4 py-3">
        <p className="text-sm font-medium text-stone-900">{title}</p>
        <p className="mt-0.5 text-xs text-stone-500">{description}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-[13px]">
          <thead className="border-b border-stone-100 bg-white">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-stone-500">Type</th>
              <th className="px-4 py-2 text-left font-medium text-stone-500">Host / name</th>
              <th className="px-4 py-2 text-left font-medium text-stone-500">Value</th>
              <th className="px-4 py-2 text-left font-medium text-stone-500">Status</th>
              <th className="px-4 py-2 text-right font-medium text-stone-500">Copy</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {records.map((record) => (
              <tr key={`${record.type}-${record.name}-${record.value}`}>
                <td className="px-4 py-2.5 font-mono text-xs text-stone-700">{record.type}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-stone-700">{record.name}</td>
                <td className="max-w-xs px-4 py-2.5 font-mono text-xs break-all text-stone-600">
                  {record.priority != null ? `${record.priority} ` : ''}
                  {record.value}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={cn(
                      'inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset',
                      recordStatusTone(record.status),
                    )}
                  >
                    {record.status ?? 'pending'}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex justify-end gap-1">
                    <CopyButton value={record.name} label="Host" />
                    <CopyButton value={record.value} label="Value" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
