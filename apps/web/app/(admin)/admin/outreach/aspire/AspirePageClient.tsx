'use client'

import { KpiStrip } from '@/components/operational/KpiStrip'
import { OperationalTable } from '@/components/operational/OperationalTable'
import { PageHeader } from '@/components/operational/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { AspireSearchResult } from '@/lib/aspire/search'
import type { aspireSavedSearches } from '@vantera/db'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bookmark, Plus, Search, Target, TrendingUp, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

type SavedSearch = typeof aspireSavedSearches.$inferSelect

type Props = {
  savedSearches: SavedSearch[]
  accountId: string
}

export function AspirePageClient({ savedSearches, accountId }: Props) {
  const queryClient = useQueryClient()
  const [query, setQuery] = useState('')
  const [company, setCompany] = useState('')
  const [selectedResult, setSelectedResult] = useState<AspireSearchResult | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const searchKey = ['aspire-search', accountId, query, company]

  const { data: results = [], isFetching } = useQuery({
    queryKey: searchKey,
    queryFn: async () => {
      const params = new URLSearchParams()
      if (query) params.set('q', query)
      if (company) params.set('company', company)
      const res = await fetch(`/api/aspire/search?${params.toString()}`)
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? 'Search failed')
      return json.data as AspireSearchResult[]
    },
    enabled: false,
  })

  const rows = useMemo(
    () =>
      results.map((r, i) => ({
        id: `${r.email ?? r.linkedinUrl ?? i}-${r.company}`,
        ...r,
      })),
    [results],
  )

  const addMutation = useMutation({
    mutationFn: async (result: AspireSearchResult) => {
      const res = await fetch('/api/aspire/add-to-pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? 'Failed to add')
      return json.data
    },
    onSuccess: () => {
      toast.success('Added to Lead Pipeline')
      queryClient.invalidateQueries({ queryKey: ['leads'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleSearch = () => {
    queryClient.fetchQuery({ queryKey: searchKey })
  }

  const handleBulkAdd = async () => {
    const selected = rows.filter((r) => selectedIds.includes(r.id))
    for (const row of selected) {
      await addMutation.mutateAsync(row)
    }
    setSelectedIds([])
  }

  const columns = useMemo(
    () => [
      {
        id: 'name',
        header: 'Prospect',
        cell: (row: (typeof rows)[0]) => (
          <div>
            <p className="font-medium text-stone-900">
              {row.firstName} {row.lastName}
            </p>
            <p className="text-xs text-stone-500">
              {row.title} · {row.company}
            </p>
          </div>
        ),
      },
      {
        id: 'intent',
        header: 'Intent',
        cell: (row: (typeof rows)[0]) => (
          <Badge variant={row.intentScore >= 75 ? 'default' : 'secondary'}>
            {row.intentScore}
          </Badge>
        ),
      },
      {
        id: 'industry',
        header: 'Industry',
        cell: (row: (typeof rows)[0]) => row.industry ?? '—',
      },
      {
        id: 'actions',
        header: '',
        className: 'text-right',
        cell: (row: (typeof rows)[0]) => (
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              addMutation.mutate(row)
            }}
            disabled={addMutation.isPending}
          >
            Add to Pipeline
          </Button>
        ),
      },
    ],
    [addMutation],
  )

  return (
    <div className="grid gap-5 lg:grid-cols-12">
      <div className="space-y-4 lg:col-span-3">
        <PageHeader title="Filters" description="Search criteria and saved views." />
        <div className="space-y-3 rounded-xl border border-stone-200 bg-white p-4">
          <div>
            <Label>Keywords</Label>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Title, skills, keywords..."
            />
          </div>
          <div>
            <Label>Company</Label>
            <Input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Company name"
            />
          </div>
          <Button className="w-full" onClick={handleSearch} disabled={isFetching}>
            <Search className="mr-2 h-4 w-4" />
            {isFetching ? 'Searching...' : 'Search prospects'}
          </Button>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-stone-700">
            <Bookmark className="h-4 w-4" />
            Saved searches
          </div>
          {savedSearches.length === 0 ? (
            <p className="text-sm text-stone-500">No saved searches yet.</p>
          ) : (
            <ul className="space-y-2">
              {savedSearches.map((s) => (
                <li key={s.id} className="text-sm text-stone-700">
                  {s.name}
                </li>
              ))}
            </ul>
          )}
          <Button variant="outline" size="sm" className="mt-3 w-full">
            <Plus className="mr-2 h-4 w-4" />
            Save current search
          </Button>
        </div>
      </div>

      <div className="space-y-4 lg:col-span-6">
        <KpiStrip
          items={[
            { label: 'Results', value: rows.length, icon: Users },
            { label: 'High intent', value: rows.filter((r) => r.intentScore >= 75).length, icon: Target },
            { label: 'Added today', value: 0, icon: TrendingUp },
          ]}
        />
        <OperationalTable
          columns={columns}
          rows={rows}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          onRowClick={(row) => setSelectedResult(row)}
          emptyState={
            <div className="rounded-xl border border-dashed border-stone-200 px-6 py-12 text-center">
              <p className="text-sm text-stone-500">Run a search to discover prospects.</p>
            </div>
          }
        />
        {selectedIds.length > 0 ? (
          <Button onClick={handleBulkAdd} disabled={addMutation.isPending}>
            Add {selectedIds.length} to Pipeline
          </Button>
        ) : null}
      </div>

      <div className="space-y-4 lg:col-span-3">
        <PageHeader title="Intelligence" description="Enrichment preview for selected prospect." />
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          {selectedResult ? (
            <div className="space-y-3 text-sm">
              <p className="font-medium text-stone-900">
                {selectedResult.firstName} {selectedResult.lastName}
              </p>
              <p className="text-stone-600">{selectedResult.title}</p>
              <p className="text-stone-600">{selectedResult.company}</p>
              <Badge>Intent {selectedResult.intentScore}</Badge>
              {selectedResult.email ? <p>{selectedResult.email}</p> : null}
              <Button
                className="w-full"
                onClick={() => addMutation.mutate(selectedResult)}
                disabled={addMutation.isPending}
              >
                Add to Pipeline
              </Button>
            </div>
          ) : (
            <p className="text-sm text-stone-500">Select a result to preview enrichment.</p>
          )}
        </div>
      </div>
    </div>
  )
}
