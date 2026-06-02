'use client'

import { IcpScoreRing } from '@/components/aspire/IcpScoreRing'
import { StatusBadge } from '@/components/operational/table/StatusBadge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { AspireSearchResult } from '@/lib/aspire/types'
import { aspireIntentTone } from '@/lib/operational/aspire-table-views'
import { cn } from '@/lib/utils'
import { Loader2, Search, Sparkles } from 'lucide-react'
import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'

type Props = {
  campaignId: string
  onEnrolled: (count: number) => void
}

function prospectName(row: AspireSearchResult): string {
  return [row.firstName, row.lastName].filter(Boolean).join(' ') || 'Unknown'
}

export function CampaignAspireFinder({ campaignId, onEnrolled }: Props) {
  const [query, setQuery] = useState('')
  const [company, setCompany] = useState('')
  const [results, setResults] = useState<AspireSearchResult[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isPending, startTransition] = useTransition()

  const withEmail = useMemo(() => results.filter((r) => r.email), [results])

  async function handleSearch() {
    setIsSearching(true)
    try {
      const res = await fetch('/api/aspire/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: query || undefined, company: company || undefined }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? 'Search failed')
      setResults(json.data as AspireSearchResult[])
      setSelectedIds([])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Search failed')
    } finally {
      setIsSearching(false)
    }
  }

  function toggle(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    )
  }

  function handleAddSelected() {
    const selected = results.filter((r) => selectedIds.includes(r.id) && r.email)
    if (selected.length === 0) {
      toast.error('Select prospects with email addresses')
      return
    }

    startTransition(async () => {
      const res = await fetch('/api/aspire/enroll/campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId, people: selected }),
      })
      const json = await res.json()
      if (!json.success) {
        toast.error(json.error ?? 'Could not add prospects')
        return
      }
      toast.success(
        `Added ${json.data.enrolled} prospect${json.data.enrolled === 1 ? '' : 's'} to campaign` +
          (json.data.skipped ? ` (${json.data.skipped} already in pipeline)` : ''),
      )
      onEnrolled(json.data.enrolled)
      setSelectedIds([])
    })
  }

  return (
    <div className="mt-4 rounded-lg border border-violet-200/80 bg-violet-50/40 p-4">
      <div className="flex items-start gap-2">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold text-stone-900">Find leads with Aspire</h4>
          <p className="mt-0.5 text-[13px] text-stone-600">
            Search ICP-matched prospects, add them to your pipeline, and enroll in this campaign in one step.
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="campaign-aspire-keywords">Keywords</Label>
          <Input
            id="campaign-aspire-keywords"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Owner, HVAC, Phoenix…"
            className="mt-1.5 bg-white"
          />
        </div>
        <div>
          <Label htmlFor="campaign-aspire-company">Company</Label>
          <Input
            id="campaign-aspire-company"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Optional company filter"
            className="mt-1.5 bg-white"
          />
        </div>
      </div>

      <Button
        variant="outline"
        size="sm"
        className="mt-3 bg-white"
        onClick={() => void handleSearch()}
        disabled={isSearching}
      >
        {isSearching ? (
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        ) : (
          <Search className="mr-1.5 h-3.5 w-3.5" />
        )}
        Search Aspire
      </Button>

      {results.length > 0 ? (
        <div className="mt-4 max-h-64 space-y-2 overflow-y-auto rounded-lg border border-stone-200 bg-white p-2">
          {withEmail.length === 0 ? (
            <p className="px-2 py-3 text-sm text-stone-500">No results with email — broaden your search.</p>
          ) : (
            withEmail.map((row) => (
              <label
                key={row.id}
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-stone-50',
                  selectedIds.includes(row.id) && 'bg-violet-50/80',
                )}
              >
                <Checkbox checked={selectedIds.includes(row.id)} onCheckedChange={() => toggle(row.id)} />
                <IcpScoreRing score={row.icpScore ?? row.intentScore} size={40} strokeWidth={4} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-medium text-stone-900">{prospectName(row)}</span>
                    <StatusBadge
                      label={String(row.icpScore ?? row.intentScore)}
                      tone={aspireIntentTone(row.icpScore ?? row.intentScore)}
                    />
                  </span>
                  <span className="block truncate text-xs text-stone-500">
                    {[row.title, row.organizationName ?? row.company, row.email].filter(Boolean).join(' · ')}
                  </span>
                </span>
              </label>
            ))
          )}
        </div>
      ) : null}

      {selectedIds.length > 0 ? (
        <div className="mt-3 flex justify-end">
          <Button size="sm" onClick={handleAddSelected} disabled={isPending}>
            {isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            Add {selectedIds.length} to campaign
          </Button>
        </div>
      ) : null}
    </div>
  )
}
