'use client'

import { BulkActionBar } from '@/components/operational/BulkActionBar'
import { KpiStrip } from '@/components/operational/KpiStrip'
import { OperationalTable } from '@/components/operational/OperationalTable'
import { PageHeader } from '@/components/operational/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { convertLeadToClient } from '@/lib/leads/convert'
import type { leads } from '@vantera/db'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Calendar, MessageSquare, Plus, Target, TrendingUp, Users, Zap } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

type LeadRow = typeof leads.$inferSelect

type Props = {
  initialLeads: LeadRow[]
  stats: {
    total: number
    qualified: number
    byStatus: { status: string; count: number }[]
  }
  accountId: string
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

const SOURCE_LABELS: Record<string, string> = {
  linkedin: 'LinkedIn',
  aspire: 'Aspire',
  manual: 'Manual',
  csv: 'CSV',
  form: 'Form',
  referral: 'Referral',
}

export function PipelinePageClient({ initialLeads, stats, accountId }: Props) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
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

  const columns = useMemo(
    () => [
      {
        id: 'identity',
        header: 'Prospect',
        cell: (row: LeadRow) => (
          <div>
            <p className="font-medium text-stone-900">
              {[row.firstName, row.lastName].filter(Boolean).join(' ') || 'Unknown'}
            </p>
            <p className="text-xs text-stone-500">
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
          <Badge variant="outline">{SOURCE_LABELS[row.source] ?? row.source}</Badge>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        cell: (row: LeadRow) => (
          <Badge variant="secondary">
            {STATUS_LABELS[row.relationshipStatus] ?? row.relationshipStatus}
          </Badge>
        ),
      },
      {
        id: 'score',
        header: 'Score',
        cell: (row: LeadRow) => <span className="tabular-nums">{row.score}</span>,
      },
      {
        id: 'actions',
        header: '',
        className: 'text-right',
        cell: (row: LeadRow) =>
          row.convertedContactId ? (
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/admin/clients/${row.convertedContactId}`}>View client</Link>
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={async (e) => {
                e.stopPropagation()
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
    [queryClient, router],
  )

  const handleCreate = async () => {
    if (!form.company.trim()) {
      toast.error('Company is required')
      return
    }
    setCreating(true)
    const res = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const json = await res.json()
    setCreating(false)
    if (!json.success) {
      toast.error(json.error ?? 'Failed to create lead')
      return
    }
    toast.success('Lead added to pipeline')
    setCreateOpen(false)
    setForm({ firstName: '', lastName: '', company: '', email: '', title: '' })
    await queryClient.invalidateQueries({ queryKey: ['leads'] })
  }

  const handleBulkStatus = async (status: string) => {
    const res = await fetch('/api/leads/bulk', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadIds: selectedIds, relationshipStatus: status }),
    })
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
    <div className="space-y-5">
      <PageHeader
        title="Pipeline"
        description="Pre-conversion prospects — nurture, qualify, and convert to active clients."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add prospect
          </Button>
        }
      />

      <KpiStrip items={kpiItems} />

      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search prospects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            {Object.entries(SOURCE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-sm text-stone-500">Loading pipeline...</p>
      ) : (
        <OperationalTable
          columns={columns}
          rows={leadsData}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          onRowClick={(row) => router.push(`/admin/pipeline/${row.id}`)}
          emptyState={
            <div className="rounded-xl border border-dashed border-stone-200 bg-stone-50/50 px-6 py-12 text-center">
              <p className="text-sm font-medium text-stone-700">No prospects yet</p>
              <p className="mt-1 text-sm text-stone-500">
                Add manually or import from Aspire outreach.
              </p>
              <Button className="mt-4" size="sm" onClick={() => setCreateOpen(true)}>
                Add prospect
              </Button>
            </div>
          }
        />
      )}

      <BulkActionBar count={selectedIds.length} onClear={() => setSelectedIds([])}>
        <Button size="sm" variant="secondary" onClick={() => handleBulkStatus('nurturing')}>
          Mark nurturing
        </Button>
        <Button size="sm" variant="secondary" onClick={() => handleBulkStatus('qualified')}>
          Mark qualified
        </Button>
        <Button size="sm" variant="secondary" onClick={() => handleBulkStatus('lost')}>
          Mark lost
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
