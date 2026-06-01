'use client'

import { BulkActionBar } from '@/components/operational/BulkActionBar'
import { KpiStrip } from '@/components/operational/KpiStrip'
import {
  OperationalTable,
  type OperationalSort,
} from '@/components/operational/OperationalTable'
import { PageHeader } from '@/components/operational/PageHeader'
import { TableInlineSelect } from '@/components/operational/table/TableInlineSelect'
import { TableSavedViews } from '@/components/operational/table/TableSavedViews'
import { TableToolbar } from '@/components/operational/table/TableToolbar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { convertLeadToClient } from '@/lib/leads/convert'
import { updateLead } from '@/lib/leads/actions'
import { PIPELINE_TABLE_VIEWS } from '@/lib/operational/pipeline-table-views'
import { SectionEmptyState } from '@/components/onboarding/SectionEmptyState'
import type { leads } from '@vantera/db'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Calendar, MessageSquare, Plus, Target, TrendingUp, Users, Zap } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'

type LeadRow = typeof leads.$inferSelect
type RelationshipStatus = LeadRow['relationshipStatus']

type Props = {
  initialLeads: LeadRow[]
  stats: {
    total: number
    qualified: number
    byStatus: { status: string; count: number }[]
  }
  accountId: string
  setupMode?: boolean
}

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  connected: 'Connected',
  nurturing: 'Nurturing',
  qualified: 'Qualified',
  discovery_booked: 'Discovery booked',
  proposal_sent: 'Proposal sent',
  won: 'Won',
  lost: 'Lost',
}

const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))

const SOURCE_LABELS: Record<string, string> = {
  linkedin: 'LinkedIn',
  aspire: 'Aspire',
  manual: 'Manual',
  csv: 'CSV',
  form: 'Form',
  referral: 'Referral',
}

function leadDisplayName(row: LeadRow): string {
  return [row.firstName, row.lastName].filter(Boolean).join(' ') || 'Unknown'
}

export function PipelinePageClient({ initialLeads, stats, accountId, setupMode = false }: Props) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [activeViewId, setActiveViewId] = useState('all')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [sort, setSort] = useState<OperationalSort | null>({ columnId: 'score', direction: 'desc' })
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    company: '',
    email: '',
    title: '',
  })

  const queryKey = ['leads', accountId, search, statusFilter, sourceFilter]

  const { data: leadsData = initialLeads, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (sourceFilter !== 'all') params.set('source', sourceFilter)
      const res = await fetch(`/api/leads?${params.toString()}`)
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? 'Failed to load leads')
      return json.data as LeadRow[]
    },
    initialData: initialLeads,
  })

  const sortedLeads = useMemo(() => {
    if (!sort) return leadsData
    const copy = [...leadsData]
    copy.sort((a, b) => {
      let av: string | number = ''
      let bv: string | number = ''
      switch (sort.columnId) {
        case 'identity':
          av = leadDisplayName(a).toLowerCase()
          bv = leadDisplayName(b).toLowerCase()
          break
        case 'status':
          av = a.relationshipStatus
          bv = b.relationshipStatus
          break
        case 'score':
          av = a.score ?? 0
          bv = b.score ?? 0
          break
        default:
          return 0
      }
      if (av < bv) return sort.direction === 'asc' ? -1 : 1
      if (av > bv) return sort.direction === 'asc' ? 1 : -1
      return 0
    })
    return copy
  }, [leadsData, sort])

  const kpiItems = useMemo(
    () => [
      { label: 'Active prospects', value: stats.total, icon: Users },
      { label: 'Qualified', value: stats.qualified, icon: Target },
      {
        label: 'In nurture',
        value: stats.byStatus.find((s) => s.status === 'nurturing')?.count ?? 0,
        icon: MessageSquare,
      },
      {
        label: 'Meetings booked',
        value: stats.byStatus.find((s) => s.status === 'discovery_booked')?.count ?? 0,
        icon: Calendar,
      },
      { label: 'Pipeline value', value: '—', icon: TrendingUp },
      { label: 'Active sequences', value: 0, icon: Zap },
    ],
    [stats],
  )

  function applySavedView(viewId: string) {
    const view = PIPELINE_TABLE_VIEWS.find((item) => item.id === viewId)
    if (!view) return
    setActiveViewId(viewId)
    setStatusFilter(view.status)
    setSourceFilter(view.source)
  }

  const handleStatusChange = useCallback(
    async (leadId: string, relationshipStatus: string) => {
      const previous = queryClient.getQueryData<LeadRow[]>(queryKey)
      queryClient.setQueryData<LeadRow[]>(queryKey, (old) =>
        old?.map((row) =>
          row.id === leadId
            ? { ...row, relationshipStatus: relationshipStatus as RelationshipStatus }
            : row,
        ),
      )

      const result = await updateLead(leadId, {
        relationshipStatus: relationshipStatus as RelationshipStatus,
      })

      if (!result.success) {
        queryClient.setQueryData(queryKey, previous)
        toast.error(result.error ?? 'Could not update status')
        return
      }

      toast.success('Status updated')
      await queryClient.invalidateQueries({ queryKey: ['leads'] })
    },
    [queryClient, queryKey],
  )

  const columns = useMemo(
    () => [
      {
        id: 'identity',
        header: 'Prospect',
        sortable: true,
        cell: (row: LeadRow) => (
          <div>
            <p className="font-medium text-stone-900">{leadDisplayName(row)}</p>
            <p className="text-[12px] text-stone-500">
              {row.title ? `${row.title} · ` : ''}
              {row.company}
            </p>
          </div>
        ),
      },
      {
        id: 'source',
        header: 'Source',
        cell: (row: LeadRow) => (
          <Badge variant="outline" className="font-normal">
            {SOURCE_LABELS[row.source] ?? row.source}
          </Badge>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        sortable: true,
        interactive: true,
        cell: (row: LeadRow) => (
          <TableInlineSelect
            value={row.relationshipStatus}
            options={STATUS_OPTIONS}
            onSave={(value) => handleStatusChange(row.id, value)}
          />
        ),
      },
      {
        id: 'score',
        header: 'Score',
        sortable: true,
        cell: (row: LeadRow) => (
          <span className="tabular-nums font-medium text-stone-800">{row.score ?? 0}</span>
        ),
      },
      {
        id: 'actions',
        header: '',
        interactive: true,
        className: 'text-right',
        cell: (row: LeadRow) =>
          row.convertedContactId ? (
            <Button variant="ghost" size="sm" asChild className="h-8">
              <Link href={`/admin/clients/${row.convertedContactId}`}>View client</Link>
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={async (event) => {
                event.stopPropagation()
                const result = await convertLeadToClient(row.id)
                if (!result.success) {
                  toast.error(result.error)
                  return
                }
                toast.success('Converted to active client')
                await queryClient.invalidateQueries({ queryKey: ['leads'] })
                router.push(`/admin/clients/${result.data.contactId}`)
              }}
            >
              Convert
            </Button>
          ),
      },
    ],
    [handleStatusChange, queryClient, router],
  )

  const handleCreate = async () => {
    if (!form.company.trim()) {
      toast.error('Company is required')
      return
    }
    setCreating(true)
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        toast.error('Failed to create lead')
        return
      }
      const json = await res.json()
      if (!json.success) {
        toast.error(json.error ?? 'Failed to create lead')
        return
      }
      toast.success('Lead added to pipeline')
      setCreateOpen(false)
      setForm({ firstName: '', lastName: '', company: '', email: '', title: '' })
      await queryClient.invalidateQueries({ queryKey: ['leads'] })
    } catch {
      toast.error('Failed to create lead')
    } finally {
      setCreating(false)
    }
  }

  const handleBulkStatus = async (status: string) => {
    const res = await fetch('/api/leads/bulk', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadIds: selectedIds, relationshipStatus: status }),
    })
    if (!res.ok) {
      toast.error('Bulk update failed')
      return
    }
    const json = await res.json()
    if (!json.success) {
      toast.error(json.error ?? 'Bulk update failed')
      return
    }
    toast.success(`Updated ${json.data.updated} leads`)
    setSelectedIds([])
    await queryClient.invalidateQueries({ queryKey: ['leads'] })
  }

  return (
    <div className="space-y-5" data-tour="pipeline-leads">
      <PageHeader
        title="Deals"
        description="Pre-conversion prospects — nurture, qualify, and convert without leaving the table."
        actions={
          <Button onClick={() => setCreateOpen(true)} className="bg-stone-900 hover:bg-stone-800">
            <Plus className="mr-2 h-4 w-4" />
            Add prospect
          </Button>
        }
      />

      <KpiStrip items={kpiItems} />

      <TableToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search prospects, companies, titles…"
        savedViews={
          <TableSavedViews
            views={PIPELINE_TABLE_VIEWS}
            activeViewId={activeViewId}
            onViewChange={applySavedView}
          />
        }
        filters={[
          {
            id: 'status',
            label: 'Status',
            value: statusFilter,
            onChange: (value) => {
              setStatusFilter(value)
              setActiveViewId('custom')
            },
            options: [{ value: 'all', label: 'All statuses' }, ...STATUS_OPTIONS],
            widthClassName: 'w-[168px]',
          },
          {
            id: 'source',
            label: 'Source',
            value: sourceFilter,
            onChange: (value) => {
              setSourceFilter(value)
              setActiveViewId('custom')
            },
            options: [
              { value: 'all', label: 'All sources' },
              ...Object.entries(SOURCE_LABELS).map(([value, label]) => ({ value, label })),
            ],
            widthClassName: 'w-[148px]',
          },
        ]}
      />

      <OperationalTable
        columns={columns}
        rows={sortedLeads}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        onRowClick={(row) => router.push(`/admin/pipeline/${row.id}`)}
        sort={sort}
        onSortChange={setSort}
        loading={isLoading}
        emptyState={
          setupMode ? (
            <SectionEmptyState
              title="No prospects yet"
              description="No leads yet. Add your first prospect or connect LinkedIn Automation to start building your pipeline."
              actionLabel="Add a lead"
              onAction={() => setCreateOpen(true)}
            />
          ) : (
            <SectionEmptyState
              title="No prospects yet"
              description="Add manually or import from Aspire outreach."
              actionLabel="Add prospect"
              onAction={() => setCreateOpen(true)}
            />
          )
        }
      />

      <BulkActionBar count={selectedIds.length} onClear={() => setSelectedIds([])}>
        <Button size="sm" variant="secondary" onClick={() => handleBulkStatus('nurturing')}>
          Move to nurture
        </Button>
        <Button size="sm" variant="secondary" onClick={() => handleBulkStatus('qualified')}>
          Mark qualified
        </Button>
        <Button size="sm" variant="secondary" onClick={() => handleBulkStatus('discovery_booked')}>
          Book meeting
        </Button>
        <Button size="sm" variant="outline" disabled title="Coming soon">
          Assign owner
        </Button>
        <Button size="sm" variant="outline" disabled title="Coming soon">
          Export
        </Button>
        <Button size="sm" variant="outline" onClick={() => handleBulkStatus('lost')}>
          Archive
        </Button>
      </BulkActionBar>

      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Add prospect</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>First name</Label>
                <Input
                  value={form.firstName}
                  onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                />
              </div>
              <div>
                <Label>Last name</Label>
                <Input
                  value={form.lastName}
                  onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>Company</Label>
              <Input
                value={form.company}
                onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
              />
            </div>
            <div>
              <Label>Title</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
          </div>
          <SheetFooter className="mt-6">
            <Button onClick={handleCreate} disabled={creating || !form.company.trim()}>
              {creating ? 'Saving...' : 'Add to pipeline'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
