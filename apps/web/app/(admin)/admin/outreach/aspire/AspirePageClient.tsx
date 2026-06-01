'use client'

import { BulkActionBar } from '@/components/operational/BulkActionBar'
import { KpiStrip } from '@/components/operational/KpiStrip'
import {
  OperationalTable,
  type OperationalSort,
} from '@/components/operational/OperationalTable'
import { PageHeader } from '@/components/operational/PageHeader'
import { StatusBadge } from '@/components/operational/table/StatusBadge'
import { TableSavedViews } from '@/components/operational/table/TableSavedViews'
import { TableToolbar } from '@/components/operational/table/TableToolbar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { AspireSearchResult } from '@/lib/aspire/search'
import {
  ASPIRE_TABLE_VIEWS,
  aspireIntentTone,
} from '@/lib/operational/aspire-table-views'
import type { aspireSavedSearches } from '@vantera/db'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bookmark, Plus, Search, Target, TrendingUp, Users } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'

type SavedSearch = typeof aspireSavedSearches.$inferSelect

type AspireResultRow = AspireSearchResult & { id: string }

type Props = {
  savedSearches: SavedSearch[]
  accountId: string
}

function prospectName(row: AspireSearchResult): string {
  return [row.firstName, row.lastName].filter(Boolean).join(' ') || 'Unknown'
}

export function AspirePageClient({ savedSearches, accountId }: Props) {
  const queryClient = useQueryClient()
  const [query, setQuery] = useState('')
  const [company, setCompany] = useState('')
  const [tableSearch, setTableSearch] = useState('')
  const [intentFilter, setIntentFilter] = useState('all')
  const [industryFilter, setIndustryFilter] = useState('all')
  const [activeViewId, setActiveViewId] = useState('all')
  const [selectedResult, setSelectedResult] = useState<AspireResultRow | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [sort, setSort] = useState<OperationalSort | null>({
    columnId: 'intent',
    direction: 'desc',
  })

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

  const rows = useMemo<AspireResultRow[]>(
    () =>
      results.map((r, i) => ({
        id: `${r.email ?? r.linkedinUrl ?? i}-${r.company}`,
        ...r,
      })),
    [results],
  )

  const industryOptions = useMemo(() => {
    const industries = Array.from(
      new Set(rows.map((r) => r.industry).filter(Boolean) as string[]),
    )
    return [
      { value: 'all', label: 'All industries' },
      ...industries.map((value) => ({ value, label: value })),
    ]
  }, [rows])

  const filteredRows = useMemo(() => {
    let next = rows

    if (tableSearch.trim()) {
      const q = tableSearch.toLowerCase()
      next = next.filter(
        (row) =>
          prospectName(row).toLowerCase().includes(q) ||
          row.company.toLowerCase().includes(q) ||
          row.title.toLowerCase().includes(q) ||
          (row.email?.toLowerCase().includes(q) ?? false),
      )
    }

    if (intentFilter === 'high') {
      next = next.filter((row) => row.intentScore >= 75)
    } else if (intentFilter === 'medium') {
      next = next.filter((row) => row.intentScore >= 60 && row.intentScore < 75)
    } else if (intentFilter === 'low') {
      next = next.filter((row) => row.intentScore < 60)
    }

    if (industryFilter !== 'all') {
      next = next.filter((row) => row.industry === industryFilter)
    }

    return next
  }, [rows, tableSearch, intentFilter, industryFilter])

  const sortedRows = useMemo(() => {
    if (!sort) return filteredRows
    const copy = [...filteredRows]
    copy.sort((a, b) => {
      let av: string | number = ''
      let bv: string | number = ''
      switch (sort.columnId) {
        case 'name':
          av = prospectName(a).toLowerCase()
          bv = prospectName(b).toLowerCase()
          break
        case 'intent':
          av = a.intentScore
          bv = b.intentScore
          break
        case 'industry':
          av = (a.industry ?? '').toLowerCase()
          bv = (b.industry ?? '').toLowerCase()
          break
        default:
          return 0
      }
      if (av < bv) return sort.direction === 'asc' ? -1 : 1
      if (av > bv) return sort.direction === 'asc' ? 1 : -1
      return 0
    })
    return copy
  }, [filteredRows, sort])

  function applySavedView(viewId: string) {
    const view = ASPIRE_TABLE_VIEWS.find((item) => item.id === viewId)
    if (!view) return
    setActiveViewId(viewId)
    setIndustryFilter(view.industry)
    setIntentFilter(view.intentMin >= 75 ? 'high' : 'all')
    setTableSearch('')
  }

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
      toast.success('Added to pipeline')
      queryClient.invalidateQueries({ queryKey: ['leads'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleSearch = () => {
    void queryClient.fetchQuery({ queryKey: searchKey })
  }

  const handleBulkAdd = useCallback(async () => {
    const selected = sortedRows.filter((r) => selectedIds.includes(r.id))
    for (const row of selected) {
      await addMutation.mutateAsync(row)
    }
    setSelectedIds([])
  }, [addMutation, selectedIds, sortedRows])

  const emailFilteredRows = useMemo(() => {
    const view = ASPIRE_TABLE_VIEWS.find((item) => item.id === activeViewId)
    if (!view?.requireEmail) return sortedRows
    return sortedRows.filter((row) => Boolean(row.email))
  }, [activeViewId, sortedRows])

  const displayRows = emailFilteredRows

  const columns = useMemo(
    () => [
      {
        id: 'name',
        header: 'Prospect',
        sortable: true,
        cell: (row: AspireResultRow) => (
          <div>
            <p className="font-medium text-stone-900">{prospectName(row)}</p>
            <p className="text-[12px] text-stone-500">
              {row.title} · {row.company}
            </p>
          </div>
        ),
      },
      {
        id: 'intent',
        header: 'Intent',
        sortable: true,
        cell: (row: AspireResultRow) => (
          <StatusBadge
            label={String(row.intentScore)}
            tone={aspireIntentTone(row.intentScore)}
          />
        ),
      },
      {
        id: 'industry',
        header: 'Industry',
        sortable: true,
        cell: (row: AspireResultRow) => (
          <Badge variant="outline" className="font-normal">
            {row.industry ?? '—'}
          </Badge>
        ),
      },
      {
        id: 'email',
        header: 'Email',
        cell: (row: AspireResultRow) =>
          row.email ? (
            <span className="text-blue-600">{row.email}</span>
          ) : (
            <span className="text-stone-400">—</span>
          ),
      },
      {
        id: 'actions',
        header: '',
        interactive: true,
        className: 'text-right',
        cell: (row: AspireResultRow) => (
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            onClick={(event) => {
              event.stopPropagation()
              addMutation.mutate(row)
            }}
            disabled={addMutation.isPending}
          >
            Add to pipeline
          </Button>
        ),
      },
    ],
    [addMutation],
  )

  const kpiItems = useMemo(
    () => [
      { label: 'Results', value: rows.length, icon: Users },
      {
        label: 'High intent',
        value: rows.filter((r) => r.intentScore >= 75).length,
        icon: Target,
      },
      { label: 'Added today', value: 0, icon: TrendingUp },
    ],
    [rows],
  )

  return (
    <div className="space-y-5">
      <PageHeader
        title="Aspire"
        description="Discover and enrich prospects — add high-intent leads to your pipeline without leaving the table."
      />

      <div className="grid gap-5 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-3">
          <div className="rounded-xl border border-stone-200/90 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-stone-900">Search criteria</h3>
            <div className="space-y-3">
              <div>
                <Label htmlFor="aspire-keywords">Keywords</Label>
                <Input
                  id="aspire-keywords"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Title, skills, keywords…"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="aspire-company">Company</Label>
                <Input
                  id="aspire-company"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Company name"
                  className="mt-1.5"
                />
              </div>
              <Button className="w-full bg-stone-900 hover:bg-stone-800" onClick={handleSearch} disabled={isFetching}>
                <Search className="mr-2 h-4 w-4" />
                {isFetching ? 'Searching…' : 'Search prospects'}
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-stone-200/90 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-stone-900">
              <Bookmark className="h-4 w-4" aria-hidden />
              Saved searches
            </div>
            {savedSearches.length === 0 ? (
              <p className="text-sm text-stone-500">No saved searches yet.</p>
            ) : (
              <ul className="space-y-2">
                {savedSearches.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      className="w-full rounded-lg border border-stone-200 px-3 py-2 text-left text-sm text-stone-700 transition-colors hover:bg-stone-50"
                      onClick={() => {
                        const filters = s.filters as { q?: string; company?: string }
                        if (filters.q) setQuery(filters.q)
                        if (filters.company) setCompany(filters.company)
                        handleSearch()
                      }}
                    >
                      {s.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <Button variant="outline" size="sm" className="mt-3 w-full" disabled title="Coming soon">
              <Plus className="mr-2 h-4 w-4" />
              Save current search
            </Button>
          </div>
        </div>

        <div className="space-y-4 lg:col-span-6">
          <KpiStrip items={kpiItems} />

          <TableToolbar
            search={tableSearch}
            onSearchChange={setTableSearch}
            searchPlaceholder="Filter results by name, company, title…"
            savedViews={
              rows.length > 0 ? (
                <TableSavedViews
                  views={ASPIRE_TABLE_VIEWS}
                  activeViewId={activeViewId}
                  onViewChange={applySavedView}
                />
              ) : null
            }
            filters={
              rows.length > 0
                ? [
                    {
                      id: 'intent',
                      label: 'Intent',
                      value: intentFilter,
                      onChange: (value) => {
                        setIntentFilter(value)
                        setActiveViewId('custom')
                      },
                      options: [
                        { value: 'all', label: 'All intent levels' },
                        { value: 'high', label: 'High (75+)' },
                        { value: 'medium', label: 'Medium (60–74)' },
                        { value: 'low', label: 'Low (<60)' },
                      ],
                      widthClassName: 'w-[148px]',
                    },
                    {
                      id: 'industry',
                      label: 'Industry',
                      value: industryFilter,
                      onChange: (value) => {
                        setIndustryFilter(value)
                        setActiveViewId('custom')
                      },
                      options: industryOptions,
                      widthClassName: 'w-[160px]',
                    },
                  ]
                : []
            }
          />

          <OperationalTable
            columns={columns}
            rows={displayRows}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            onRowClick={(row) => setSelectedResult(row)}
            sort={sort}
            onSortChange={setSort}
            loading={isFetching}
            emptyState={
              <div className="rounded-xl border border-dashed border-stone-200 bg-stone-50/80 px-6 py-12 text-center">
                <p className="text-sm font-medium text-stone-800">No results yet</p>
                <p className="mt-1 text-sm text-stone-500">
                  Run a search to discover prospects, then add them to your pipeline.
                </p>
              </div>
            }
          />

          <BulkActionBar count={selectedIds.length} onClear={() => setSelectedIds([])}>
            <Button size="sm" variant="secondary" onClick={() => void handleBulkAdd()} disabled={addMutation.isPending}>
              Add to pipeline
            </Button>
            <Button size="sm" variant="outline" disabled title="Coming soon">
              Export
            </Button>
            <Button size="sm" variant="outline" disabled title="Coming soon">
              Save to list
            </Button>
          </BulkActionBar>
        </div>

        <div className="space-y-4 lg:col-span-3">
          <div className="rounded-xl border border-stone-200/90 bg-white p-4 shadow-sm">
            <h3 className="mb-1 text-sm font-semibold text-stone-900">Intelligence</h3>
            <p className="mb-4 text-[12px] text-stone-500">Enrichment preview for selected prospect.</p>
            {selectedResult ? (
              <div className="space-y-3 text-sm">
                <p className="font-medium text-stone-900">{prospectName(selectedResult)}</p>
                <p className="text-stone-600">{selectedResult.title}</p>
                <p className="text-stone-600">{selectedResult.company}</p>
                <StatusBadge
                  label={`Intent ${selectedResult.intentScore}`}
                  tone={aspireIntentTone(selectedResult.intentScore)}
                />
                {selectedResult.email ? (
                  <p className="text-stone-700">{selectedResult.email}</p>
                ) : (
                  <p className="text-stone-400">No email on record</p>
                )}
                {selectedResult.linkedinUrl ? (
                  <p className="truncate text-blue-600">{selectedResult.linkedinUrl}</p>
                ) : null}
                <Button
                  className="w-full bg-stone-900 hover:bg-stone-800"
                  onClick={() => addMutation.mutate(selectedResult)}
                  disabled={addMutation.isPending}
                >
                  Add to pipeline
                </Button>
              </div>
            ) : (
              <p className="text-sm text-stone-500">Select a result to preview enrichment.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
