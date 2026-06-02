'use client'

import { AspireIntelligencePanel } from '@/components/aspire/AspireIntelligencePanel'
import {
  AspireContactCell,
  AspireEnrollCell,
  AspireIcpCell,
  AspireIndustryCell,
  AspireProspectCell,
} from '@/components/aspire/AspireTableCells'
import { BulkActionBar } from '@/components/operational/BulkActionBar'
import { KpiStrip } from '@/components/operational/KpiStrip'
import {
  OperationalTable,
  type OperationalSort,
} from '@/components/operational/OperationalTable'
import { PageHeader } from '@/components/operational/PageHeader'
import { TableSavedViews } from '@/components/operational/table/TableSavedViews'
import { TableToolbar } from '@/components/operational/table/TableToolbar'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { aspireCompanyName, aspireProspectName } from '@/lib/aspire/display'
import { mergeAspireResults } from '@/lib/aspire/merge-results'
import { getIcpConfigForVertical } from '@/lib/aspire/icp-score'
import { normalizeApolloFilters } from '@/lib/aspire/filters'
import type { AspireSearchResult } from '@/lib/aspire/types'
import { ASPIRE_TABLE_VIEWS } from '@/lib/operational/aspire-table-views'
import { LiveIndicator } from '@/components/operational/LiveIndicator'
import { SectionEmptyState } from '@/components/onboarding/SectionEmptyState'
import { useAccountRealtime } from '@/lib/supabase/account-realtime'
import { cn } from '@/lib/utils'
import type { aspireSavedSearches } from '@vantera/db'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bookmark, Loader2, Play, Plus, Search, Target, Trash2, TrendingUp, Users } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

type SavedSearch = typeof aspireSavedSearches.$inferSelect
type AspireResultRow = AspireSearchResult & { id: string }
type EnrollState = 'idle' | 'pending' | 'added' | 'exists'

const LIVE_RESULTS_TTL_MS = 90_000
const STORED_RESULTS_POLL_MS = 500
const STORED_RESULTS_MAX_POLLS = 12

type SearchMeta = {
  source?: 'apify' | 'stub' | 'demo'
  providerConfigured?: boolean
  providerError?: string
}

type Props = {
  savedSearches: SavedSearch[]
  accountId: string
  accountVertical: string
}

async function fetchAspireResultsFromApi(searchId: string | null): Promise<AspireSearchResult[]> {
  const res = searchId
    ? await fetch(`/api/aspire/results/${searchId}`)
    : await fetch('/api/aspire/scout-results')
  const json = await res.json()
  if (!json.success) throw new Error(json.error ?? 'Could not load results')
  return json.data as AspireSearchResult[]
}

export function AspirePageClient({ savedSearches: initialSaved, accountId, accountVertical }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const icpConfig = useMemo(() => getIcpConfigForVertical(accountVertical), [accountVertical])

  const [savedSearches, setSavedSearches] = useState(initialSaved)
  const [activeSearchId, setActiveSearchId] = useState<string | null>(
    searchParams.get('searchId'),
  )
  const [query, setQuery] = useState('')
  const [company, setCompany] = useState('')
  const [tableSearch, setTableSearch] = useState('')
  const [intentFilter, setIntentFilter] = useState('all')
  const [industryFilter, setIndustryFilter] = useState('all')
  const [activeViewId, setActiveViewId] = useState('all')
  const [selectedResult, setSelectedResult] = useState<AspireResultRow | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [enrollStates, setEnrollStates] = useState<Record<string, EnrollState>>({})
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [sort, setSort] = useState<OperationalSort | null>({
    columnId: 'icp',
    direction: 'desc',
  })
  const [isSearching, setIsSearching] = useState(false)
  const [runningSearchId, setRunningSearchId] = useState<string | null>(null)
  /** Primary table data — always set directly from search API or DB load. */
  const [displayLeads, setDisplayLeads] = useState<AspireSearchResult[]>([])
  const [searchMeta, setSearchMeta] = useState<SearchMeta | null>(null)
  const isSearchingRef = useRef(false)
  /** Bumps when a new search starts so stale loadStoredResults cannot clear the table. */
  const resultsLoadSeqRef = useRef(0)
  const displayLeadsRef = useRef<AspireSearchResult[]>([])
  const liveSearchRef = useRef<{ at: number; results: AspireSearchResult[] } | null>(null)

  const applyDisplayLeads = useCallback(
    (results: AspireSearchResult[], source: 'live' | 'stored' | 'merge') => {
      setDisplayLeads((current) => {
        const next =
          source === 'merge'
            ? mergeAspireResults(current, results)
            : results
        displayLeadsRef.current = next
        return next
      })
      if (source === 'live') {
        liveSearchRef.current = { at: Date.now(), results }
      } else if (source === 'stored' && results.length > 0) {
        liveSearchRef.current = null
      }
    },
    [],
  )

  const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

  useEffect(() => {
    const id = searchParams.get('searchId')
    if (id && id !== activeSearchId) {
      setActiveSearchId(id)
    }
  }, [searchParams, activeSearchId])

  const activeSaved = savedSearches.find((s) => s.id === activeSearchId)

  useEffect(() => {
    if (!activeSaved) return
    const filters = activeSaved.filters as { q?: string; company?: string }
    if (filters.q) setQuery(filters.q)
    if (filters.company) setCompany(filters.company)
  }, [activeSaved?.id])

  const loadStoredResults = useCallback(
    async (
      searchId: string | null = activeSearchId,
      options?: { force?: boolean; merge?: boolean },
    ): Promise<AspireSearchResult[]> => {
      const seq = resultsLoadSeqRef.current
      try {
        const list = await fetchAspireResultsFromApi(searchId)
        if (seq !== resultsLoadSeqRef.current) {
          return displayLeadsRef.current
        }

        if (list.length > 0) {
          applyDisplayLeads(list, options?.merge ? 'merge' : 'stored')
          return displayLeadsRef.current
        }

        const live = liveSearchRef.current
        if (live && Date.now() - live.at < LIVE_RESULTS_TTL_MS && !options?.force) {
          return live.results
        }

        if (displayLeadsRef.current.length > 0 && !options?.force) {
          return displayLeadsRef.current
        }

        if (options?.force) {
          applyDisplayLeads([], 'stored')
          return []
        }

        return displayLeadsRef.current
      } catch {
        if (seq !== resultsLoadSeqRef.current) {
          return displayLeadsRef.current
        }
        if (displayLeadsRef.current.length > 0) {
          return displayLeadsRef.current
        }
        if (options?.force) {
          applyDisplayLeads([], 'stored')
          return []
        }
        return displayLeadsRef.current
      }
    },
    [activeSearchId, applyDisplayLeads],
  )

  const pollStoredResults = useCallback(
    async (searchId: string | null) => {
      for (let attempt = 0; attempt < STORED_RESULTS_MAX_POLLS; attempt += 1) {
        const force = attempt === STORED_RESULTS_MAX_POLLS - 1
        const list = await loadStoredResults(searchId, { force, merge: !force })
        if (list.length > 0) return list
        if (displayLeadsRef.current.length > 0) return displayLeadsRef.current
        await sleep(STORED_RESULTS_POLL_MS)
      }
      return displayLeadsRef.current
    },
    [loadStoredResults],
  )

  useEffect(() => {
    resultsLoadSeqRef.current += 1
    liveSearchRef.current = null
    void loadStoredResults(activeSearchId, { force: true })
  }, [activeSearchId, loadStoredResults])

  const reloadStoredResults = useCallback(() => {
    if (isSearchingRef.current) return
    void loadStoredResults(activeSearchId, { merge: true })
  }, [activeSearchId, loadStoredResults])

  const { isLive: resultsLive } = useAccountRealtime({
    accountId,
    table: 'aspire_results',
    searchId: activeSearchId ?? undefined,
    enabled: true,
    onChange: reloadStoredResults,
  })

  useAccountRealtime({
    accountId,
    table: 'aspire_search_runs',
    enabled: Boolean(activeSearchId),
    onChange: reloadStoredResults,
  })

  useEffect(() => {
    displayLeadsRef.current = displayLeads
  }, [displayLeads])

  const isFetching = isSearching
  const tableLoading = isSearching && displayLeads.length === 0
  const sourceResults = displayLeads

  const rows = useMemo<AspireResultRow[]>(
    () =>
      sourceResults.map((r, i) => ({
        ...r,
        id: r.id || `${r.email ?? r.linkedinUrl ?? i}-${aspireCompanyName(r) || 'unknown'}`,
        icpScore: r.icpScore ?? r.intentScore ?? 0,
        intentScore: r.icpScore ?? r.intentScore ?? 0,
      })),
    [sourceResults],
  )

  const scoreOf = (row: AspireResultRow) => row.icpScore ?? row.intentScore ?? 0

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
          aspireProspectName(row).toLowerCase().includes(q) ||
          aspireCompanyName(row).toLowerCase().includes(q) ||
          row.title.toLowerCase().includes(q) ||
          (row.email?.toLowerCase().includes(q) ?? false),
      )
    }

    if (intentFilter === 'high') next = next.filter((row) => scoreOf(row) >= 70)
    else if (intentFilter === 'medium') next = next.filter((row) => scoreOf(row) >= 40 && scoreOf(row) < 70)
    else if (intentFilter === 'low') next = next.filter((row) => scoreOf(row) < 40)

    if (industryFilter !== 'all') next = next.filter((row) => row.industry === industryFilter)

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
          av = aspireProspectName(a).toLowerCase()
          bv = aspireProspectName(b).toLowerCase()
          break
        case 'icp':
          av = scoreOf(a)
          bv = scoreOf(b)
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
      if (!json.success) {
        const err = new Error(json.error ?? 'Failed to add') as Error & { code?: string }
        err.code = json.code
        throw err
      }
      return json.data
    },
    onSuccess: (_data, variables) => {
      toast.success('Added to pipeline — draft generating')
      setEnrollStates((current) => ({ ...current, [variables.id]: 'added' }))
      queryClient.invalidateQueries({ queryKey: ['leads'] })
    },
    onError: (err: Error & { code?: string }, variables) => {
      if (err.code === 'ALREADY_ENROLLED') {
        setEnrollStates((current) => ({ ...current, [variables.id]: 'exists' }))
        toast.message('Already in your pipeline')
        return
      }
      toast.error(err.message)
    },
  })

  const saveSearchMutation = useMutation({
    mutationFn: async (name: string) => {
      const filters = normalizeApolloFilters(accountVertical, {
        q: query || undefined,
        company: company || undefined,
      })
      const res = await fetch('/api/aspire/searches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          filters,
          runFrequency: 'weekly',
        }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? 'Could not save search')
      return json.data as SavedSearch
    },
    onSuccess: (data) => {
      setSavedSearches((current) => [data, ...current])
      setActiveSearchId(data.id)
      setSaveDialogOpen(false)
      setSaveName('')
      toast.success('Search saved — runs weekly')
      router.replace(`/admin/outreach/aspire?searchId=${data.id}`)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteSearchMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/aspire/searches?id=${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? 'Could not delete search')
      return id
    },
    onSuccess: (id) => {
      setSavedSearches((current) => current.filter((s) => s.id !== id))
      if (activeSearchId === id) {
        setActiveSearchId(null)
        router.replace('/admin/outreach/aspire')
      }
      toast.success('Saved search removed')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const runSavedSearchMutation = useMutation({
    mutationFn: async (searchId: string) => {
      const res = await fetch('/api/aspire/searches/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ searchId }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? 'Could not run search')
      return json.data as { found: number; enrolled: number; status: string }
    },
    onMutate: (searchId) => {
      setRunningSearchId(searchId)
      isSearchingRef.current = true
      resultsLoadSeqRef.current += 1
      liveSearchRef.current = null
    },
    onSuccess: async (data, searchId) => {
      setActiveSearchId(searchId)
      setSearchMeta(null)
      const list = await pollStoredResults(searchId)
      const listCount = list.length
      toast.success(
        listCount > 0
          ? `Found ${listCount} prospect${listCount === 1 ? '' : 's'} for this search`
          : data.found > 0
            ? `Apify found ${data.found} prospect${data.found === 1 ? '' : 's'}`
            : 'Apify search complete — no prospects matched your criteria',
      )
    },
    onError: (err: Error) => toast.error(err.message),
    onSettled: () => {
      isSearchingRef.current = false
      setRunningSearchId(null)
    },
  })

  const handleSearch = async () => {
    const trimmedQuery = query.trim()
    const trimmedCompany = company.trim()
    if (!trimmedQuery && !trimmedCompany) {
      toast.error('Enter a keyword or company to search')
      return
    }

    setIsSearching(true)
    isSearchingRef.current = true
    resultsLoadSeqRef.current += 1
    liveSearchRef.current = null
    try {
      const res = await fetch('/api/aspire/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          q: trimmedQuery || undefined,
          company: trimmedCompany || undefined,
          searchId: activeSearchId ?? undefined,
        }),
      })
      const json = (await res.json()) as {
        success: boolean
        data?: AspireSearchResult[]
        meta?: SearchMeta
        error?: string
      }

      if (!res.ok || !json.success) {
        throw new Error(json.error ?? `Search failed (${res.status})`)
      }

      const results = Array.isArray(json.data) ? json.data : []
      applyDisplayLeads(results, 'live')
      setSearchMeta(json.meta ?? null)

      if (json.meta?.source === 'stub') {
        toast.message(
          'Apify is not configured — showing sample leads. Set APIFY_API_TOKEN for live prospect data.',
          { duration: 6000 },
        )
      }

      toast.success(
        results.length > 0
          ? `Found ${results.length} prospect${results.length === 1 ? '' : 's'} for "${trimmedQuery || trimmedCompany}"`
          : 'No prospects matched — try a broader keyword',
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Apify search failed')
    } finally {
      isSearchingRef.current = false
      setIsSearching(false)
    }
  }

  const handleSelectSavedSearch = (search: SavedSearch) => {
    liveSearchRef.current = null
    setSearchMeta(null)
    router.replace(`/admin/outreach/aspire?searchId=${search.id}`)
    const filters = search.filters as { q?: string; company?: string }
    if (filters.q) setQuery(filters.q)
    if (filters.company) setCompany(filters.company)
    setActiveSearchId(search.id)
  }

  const enrollOne = useCallback(
    (row: AspireResultRow) => {
      setEnrollStates((current) => ({ ...current, [row.id]: 'pending' }))
      addMutation.mutate(row, {
        onSettled: (_data, error) => {
          if (error) {
            setEnrollStates((current) => {
              const prev = current[row.id]
              if (prev === 'added' || prev === 'exists') return current
              return { ...current, [row.id]: 'idle' }
            })
          }
        },
      })
    },
    [addMutation],
  )

  const handleBulkAdd = useCallback(async () => {
    const selected = sortedRows.filter((r) => selectedIds.includes(r.id))
    for (const row of selected) {
      setEnrollStates((current) => ({ ...current, [row.id]: 'pending' }))
      try {
        await addMutation.mutateAsync(row)
      } catch {
        setEnrollStates((current) => ({ ...current, [row.id]: 'idle' }))
      }
    }
    setSelectedIds([])
  }, [addMutation, selectedIds, sortedRows])

  const displayRows = useMemo(() => {
    const view = ASPIRE_TABLE_VIEWS.find((item) => item.id === activeViewId)
    if (!view?.requireEmail) return sortedRows
    return sortedRows.filter((row) => Boolean(row.email))
  }, [activeViewId, sortedRows])

  const columns = useMemo(
    () => [
      {
        id: 'name',
        header: 'Prospect',
        sortable: true,
        cell: (row: AspireResultRow) => <AspireProspectCell row={row} />,
      },
      {
        id: 'icp',
        header: 'ICP fit',
        sortable: true,
        cell: (row: AspireResultRow) => <AspireIcpCell score={scoreOf(row)} />,
      },
      {
        id: 'industry',
        header: 'Industry',
        sortable: true,
        cell: (row: AspireResultRow) => <AspireIndustryCell industry={row.industry} />,
      },
      {
        id: 'contact',
        header: 'Contact',
        cell: (row: AspireResultRow) => <AspireContactCell row={row} />,
      },
      {
        id: 'actions',
        header: '',
        interactive: true,
        className: 'text-right',
        cell: (row: AspireResultRow) => (
          <AspireEnrollCell
            state={enrollStates[row.id] ?? 'idle'}
            disabled={addMutation.isPending}
            onEnroll={() => enrollOne(row)}
          />
        ),
      },
    ],
    [addMutation.isPending, enrollOne, enrollStates],
  )

  const kpiItems = useMemo(
    () => [
      { label: 'Results', value: rows.length, icon: Users },
      { label: 'Strong ICP (70+)', value: rows.filter((r) => scoreOf(r) >= 70).length, icon: Target },
      {
        label: 'Added',
        value: Object.values(enrollStates).filter((s) => s === 'added').length,
        icon: TrendingUp,
      },
    ],
    [rows, enrollStates],
  )

  const showTable = tableLoading || displayRows.length > 0

  return (
    <div className="mx-auto w-full space-y-6 px-4 py-5 md:px-8 md:py-6">
      <PageHeader
        title="Aspire"
        description="Discover ICP-matched prospects, score them instantly, and add to your pipeline with AI drafts ready to review."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(220px,260px)_minmax(0,1fr)]">
        <aside className="space-y-4">
          <div className="card-surface p-4">
            <h3 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Search criteria</h3>
            <div className="space-y-3">
              <div>
                <Label htmlFor="aspire-keywords">Keywords</Label>
                <Input
                  id="aspire-keywords"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Title, skills, keywords…"
                  className="mt-1.5 border-[var(--border-default)]"
                />
              </div>
              <div>
                <Label htmlFor="aspire-company">Company</Label>
                <Input
                  id="aspire-company"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Company name"
                  className="mt-1.5 border-[var(--border-default)]"
                />
              </div>
              <Button
                className="w-full bg-[var(--text-primary)] text-[var(--text-inverse)] hover:opacity-90"
                onClick={handleSearch}
                disabled={isFetching}
              >
                {isFetching ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Search className="mr-2 h-4 w-4" />
                )}
                {isFetching ? 'Searching…' : 'Search prospects'}
              </Button>
            </div>
          </div>

          <div className="card-surface p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                <Bookmark className="h-4 w-4" aria-hidden />
                Saved searches
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={() => {
                  setSaveName(query ? `${query}${company ? ` · ${company}` : ''}` : 'My search')
                  setSaveDialogOpen(true)
                }}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            {savedSearches.length === 0 ? (
              <p className="text-[13px] leading-relaxed text-[var(--text-secondary)]">
                Save a search to auto-run weekly and get ICP matches in your feed.
              </p>
            ) : (
              <ul className="space-y-2">
                {savedSearches.map((s) => (
                  <li key={s.id}>
                    <div
                      className={cn(
                        'flex items-center gap-1 rounded-lg border px-2 py-1',
                        activeSearchId === s.id
                          ? 'border-[var(--accent-border)] bg-[var(--accent-muted)]'
                          : 'border-[var(--border-default)]',
                      )}
                    >
                      <button
                        type="button"
                        className="min-w-0 flex-1 rounded-md px-1 py-1.5 text-left text-sm text-[var(--text-secondary)] transition-colors duration-150 hover:bg-[var(--bg-overlay)]"
                        onClick={() => handleSelectSavedSearch(s)}
                      >
                        <span className="block truncate font-medium text-[var(--text-primary)]">
                          {s.name}
                        </span>
                        <span className="block text-[11px] text-[var(--text-tertiary)]">
                          {s.totalFound} found · {s.runFrequency}
                        </span>
                      </button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 shrink-0 px-0 text-[var(--text-secondary)] hover:text-[var(--accent)]"
                        title="Run Apify search now"
                        onClick={() => runSavedSearchMutation.mutate(s.id)}
                        disabled={runningSearchId === s.id}
                      >
                        {runningSearchId === s.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Play className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 shrink-0 px-0 text-[var(--text-tertiary)] hover:text-[var(--danger)]"
                        onClick={() => deleteSearchMutation.mutate(s.id)}
                        disabled={deleteSearchMutation.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <Button
              variant="outline"
              size="sm"
              className="mt-3 w-full border-[var(--border-default)]"
              onClick={() => {
                setSaveName(query ? `${query}${company ? ` · ${company}` : ''}` : 'My search')
                setSaveDialogOpen(true)
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Save current search
            </Button>
          </div>
        </aside>

        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(240px,280px)]">
          <div className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[13px] text-[var(--text-secondary)]">
                {activeSaved ? (
                  <>
                    Viewing saved search{' '}
                    <span className="font-medium text-[var(--text-primary)]">{activeSaved.name}</span>
                    {searchMeta?.source === 'stub'
                      ? ' — sample leads (configure APIFY_API_TOKEN for live data)'
                      : ' — stored results'}
                  </>
                ) : rows.length > 0 ? (
                  <>
                    Showing{' '}
                    <span className="font-medium text-[var(--text-primary)]">
                      {rows.length} prospect{rows.length === 1 ? '' : 's'}
                    </span>
                    {searchMeta?.source === 'apify' ? ' from latest Apify run' : searchMeta?.source === 'stub' ? ' (sample data)' : ''}
                  </>
                ) : (
                  'Run a search to discover ICP-matched prospects'
                )}
              </p>
              <LiveIndicator active={resultsLive} />
            </div>

            {searchMeta?.source === 'stub' ? (
              <div className="rounded-lg border border-[var(--warning)]/30 bg-[var(--warning-muted)] px-4 py-3 text-sm text-[var(--text-primary)]">
                Apify is not configured. Showing sample leads — add APIFY_API_TOKEN in Vercel (and
                Trigger) for live prospect data.
              </div>
            ) : null}

            <KpiStrip items={kpiItems} />

            <section className="card-surface overflow-hidden">
              <div className="border-b border-[var(--border-default)] bg-[var(--bg-subtle)]/50 px-4 py-4 md:px-5">
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
                            id: 'icp',
                            label: 'ICP score',
                            value: intentFilter,
                            onChange: (value) => {
                              setIntentFilter(value)
                              setActiveViewId('custom')
                            },
                            options: [
                              { value: 'all', label: 'All scores' },
                              { value: 'high', label: 'Strong (70+)' },
                              { value: 'medium', label: 'Moderate (40–69)' },
                              { value: 'low', label: 'Weak (<40)' },
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
                  trailing={
                    displayRows.length > 0 ? (
                      <span className="hidden text-[12px] text-[var(--text-secondary)] lg:inline">
                        {displayRows.length} result{displayRows.length === 1 ? '' : 's'}
                      </span>
                    ) : null
                  }
                />
              </div>

              {showTable ? (
                <OperationalTable
                  columns={columns}
                  rows={displayRows}
                  selectedIds={selectedIds}
                  onSelectionChange={setSelectedIds}
                  onRowClick={(row) => setSelectedResult(row)}
                  sort={sort}
                  onSortChange={setSort}
                  loading={tableLoading}
                  className="rounded-none border-0 shadow-none"
                />
              ) : (
                <div className="px-4 py-12 md:px-5">
                  <SectionEmptyState
                    title="No results yet"
                    description="Run a search or select a saved search to discover ICP-matched prospects."
                    actionLabel="Search prospects"
                    onAction={handleSearch}
                  />
                </div>
              )}
            </section>

            <BulkActionBar count={selectedIds.length} onClear={() => setSelectedIds([])}>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void handleBulkAdd()}
                disabled={addMutation.isPending}
              >
                Add {selectedIds.length || ''} to pipeline
              </Button>
            </BulkActionBar>
          </div>

          <div className="min-w-0 xl:sticky xl:top-6 xl:self-start">
            <AspireIntelligencePanel
              result={selectedResult}
              icpConfig={icpConfig}
              enrollState={selectedResult ? enrollStates[selectedResult.id] ?? 'idle' : 'idle'}
              onAdd={selectedResult ? () => enrollOne(selectedResult) : undefined}
              onSkip={
                selectedResult
                  ? () => {
                      setSelectedResult(null)
                    }
                  : undefined
              }
            />
          </div>
        </div>
      </div>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="border-[var(--border-default)] bg-[var(--bg-surface)]">
          <DialogHeader>
            <DialogTitle className="text-[var(--text-primary)]">Save search</DialogTitle>
          </DialogHeader>
          <div>
            <Label htmlFor="save-search-name">Name</Label>
            <Input
              id="save-search-name"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="HVAC Phoenix owners"
              className="mt-1.5 border-[var(--border-default)]"
            />
            <p className="mt-2 text-xs text-[var(--text-secondary)]">
              Saved searches run weekly and notify you of new ICP matches.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => saveSearchMutation.mutate(saveName.trim())}
              disabled={!saveName.trim() || saveSearchMutation.isPending}
              className="bg-[var(--text-primary)] text-[var(--text-inverse)] hover:opacity-90"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
