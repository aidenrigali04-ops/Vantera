'use client'

import { SequenceBuilder, type SequenceNode } from '@/components/linkedin/SequenceBuilder'
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
import { SectionEmptyState } from '@/components/onboarding/SectionEmptyState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { updateLead } from '@/lib/leads/actions'
import { LINKEDIN_TABLE_VIEWS } from '@/lib/operational/linkedin-table-views'
import type { leads, linkedinCampaigns } from '@vantera/db'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Activity, Link2, Pause, Play, Plus, Users } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'

type Campaign = typeof linkedinCampaigns.$inferSelect
type LeadRow = typeof leads.$inferSelect
type RelationshipStatus = LeadRow['relationshipStatus']

type Props = {
  campaigns: Campaign[]
  leads: LeadRow[]
  stats: { activeCampaigns: number; totalSequences: number }
  connectionStatus: 'connected' | 'disconnected' | 'pacing'
  accountId: string
}

const DEFAULT_NODES: SequenceNode[] = [
  { id: '1', stepNumber: 1, nodeType: 'trigger', label: 'Lead enrolled in campaign' },
  { id: '2', stepNumber: 2, nodeType: 'action', label: 'Send connection request', channel: 'linkedin' },
  { id: '3', stepNumber: 3, nodeType: 'logic', label: 'Wait 2 days if not accepted' },
  { id: '4', stepNumber: 4, nodeType: 'ai', label: 'Draft personalized follow-up DM' },
]

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
  return [row.firstName, row.lastName].filter(Boolean).join(' ') || row.company || 'Unknown'
}

export function LinkedInPageClient({
  campaigns,
  leads: initialLeads,
  stats,
  connectionStatus,
  accountId,
}: Props) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(
    campaigns[0]?.id ?? null,
  )
  const [campaignName, setCampaignName] = useState('')
  const [nodes, setNodes] = useState<SequenceNode[]>(DEFAULT_NODES)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [activeViewId, setActiveViewId] = useState('all')
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([])
  const [sort, setSort] = useState<OperationalSort | null>({
    columnId: 'prospect',
    direction: 'asc',
  })
  const [enrolling, setEnrolling] = useState(false)

  const selectedCampaign = campaigns.find((c) => c.id === selectedCampaignId)
  const queryKey = ['leads', accountId, search, statusFilter, sourceFilter, 'linkedin-page']

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
        case 'prospect':
          av = leadDisplayName(a).toLowerCase()
          bv = leadDisplayName(b).toLowerCase()
          break
        case 'status':
          av = a.relationshipStatus
          bv = b.relationshipStatus
          break
        case 'source':
          av = a.source
          bv = b.source
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

  function applySavedView(viewId: string) {
    const view = LINKEDIN_TABLE_VIEWS.find((item) => item.id === viewId)
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

  const leadColumns = useMemo(
    () => [
      {
        id: 'prospect',
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
        id: 'source',
        header: 'Source',
        sortable: true,
        cell: (row: LeadRow) => (
          <Badge variant="outline" className="font-normal">
            {SOURCE_LABELS[row.source] ?? row.source}
          </Badge>
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
    ],
    [handleStatusChange],
  )

  const handleCreateCampaign = async () => {
    if (!campaignName.trim()) {
      toast.error('Campaign name is required')
      return
    }
    const res = await fetch('/api/linkedin/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: campaignName }),
    })
    const json = await res.json()
    if (!json.success) {
      toast.error(json.error ?? 'Failed to create campaign')
      return
    }
    toast.success('Campaign created')
    setCampaignName('')
    window.location.reload()
  }

  const handleEnroll = useCallback(
    async (leadIds: string[]) => {
      if (!selectedCampaignId) {
        toast.error('Select a campaign first')
        return
      }
      if (leadIds.length === 0) {
        toast.error('Select leads to enroll')
        return
      }

      setEnrolling(true)
      const res = await fetch('/api/linkedin/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId: selectedCampaignId, leadIds }),
      })
      const json = await res.json()
      setEnrolling(false)

      if (!json.success) {
        toast.error(json.error ?? 'Enrollment failed')
        return
      }

      toast.success(`Enrolled ${json.data.enrolled} leads`)
      setSelectedLeadIds([])
    },
    [selectedCampaignId],
  )

  const handleBulkStatus = async (status: string) => {
    const res = await fetch('/api/leads/bulk', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadIds: selectedLeadIds, relationshipStatus: status }),
    })
    const json = await res.json()
    if (!json.success) {
      toast.error(json.error ?? 'Bulk update failed')
      return
    }
    toast.success(`Updated ${json.data.updated} leads`)
    setSelectedLeadIds([])
    await queryClient.invalidateQueries({ queryKey: ['leads'] })
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="LinkedIn Automation"
        description="Build sequences, enroll pipeline prospects, and track connection pacing — without leaving the table."
      />

      <KpiStrip
        items={[
          { label: 'Active campaigns', value: stats.activeCampaigns, icon: Activity },
          { label: 'Enrolled leads', value: stats.totalSequences, icon: Users },
          {
            label: 'Extension',
            value: connectionStatus === 'connected' ? 'Connected' : 'Setup needed',
            icon: Link2,
          },
        ]}
      />

      <div className="grid gap-5 lg:grid-cols-12">
        <div className="space-y-3 lg:col-span-3">
          <div className="rounded-xl border border-stone-200/90 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-stone-900">Campaigns</h3>
            <div className="space-y-2">
              {campaigns.length === 0 ? (
                <p className="text-sm text-stone-500">No campaigns yet.</p>
              ) : (
                campaigns.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCampaignId(c.id)}
                    className={
                      selectedCampaignId === c.id
                        ? 'w-full rounded-lg border border-stone-900 bg-stone-50 px-3 py-2 text-left text-sm'
                        : 'w-full rounded-lg border border-stone-200 px-3 py-2 text-left text-sm transition-colors hover:bg-stone-50'
                    }
                  >
                    <p className="font-medium text-stone-900">{c.name}</p>
                    <Badge variant="outline" className="mt-1 text-[10px] font-normal">
                      {c.status}
                    </Badge>
                  </button>
                ))
              )}
            </div>
            <div className="mt-4 space-y-2 border-t border-stone-100 pt-4">
              <Input
                placeholder="New campaign name"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
              />
              <Button
                size="sm"
                className="w-full bg-stone-900 hover:bg-stone-800"
                onClick={handleCreateCampaign}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create campaign
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-stone-200/90 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-stone-900">Connection status</h3>
            <div className="mt-2 flex items-center gap-2">
              <span
                className={
                  connectionStatus === 'connected'
                    ? 'h-2 w-2 rounded-full bg-emerald-500'
                    : 'h-2 w-2 rounded-full bg-amber-500'
                }
              />
              <span className="text-sm text-stone-600">
                {connectionStatus === 'connected'
                  ? 'Extension connected · pacing active'
                  : 'Install Chrome extension to connect'}
              </span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5">
          <SequenceBuilder
            nodes={nodes}
            onAddNode={() =>
              setNodes((prev) => [
                ...prev,
                {
                  id: String(prev.length + 1),
                  stepNumber: prev.length + 1,
                  nodeType: 'action',
                  label: 'New step',
                  channel: 'linkedin',
                },
              ])
            }
          />
          {selectedCampaign ? (
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="outline">
                <Pause className="mr-2 h-4 w-4" />
                Pause
              </Button>
              <Button size="sm" variant="outline">
                <Play className="mr-2 h-4 w-4" />
                Activate
              </Button>
            </div>
          ) : null}
        </div>

        <div className="lg:col-span-4">
          <div className="rounded-xl border border-stone-200/90 bg-white p-4 shadow-sm">
            <h3 className="mb-1 text-sm font-semibold text-stone-900">Insights</h3>
            <p className="mb-4 text-[12px] text-stone-500">
              Sequence execution runs via Trigger.dev. Enroll leads from the table below.
            </p>
            <ul className="space-y-2 text-sm text-stone-700">
              <li>Reply rate: —</li>
              <li>Connections sent today: —</li>
              <li>Pending steps: —</li>
            </ul>
            {selectedCampaign ? (
              <p className="mt-4 text-[12px] text-stone-500">
                Enrolling into:{' '}
                <span className="font-medium text-stone-800">{selectedCampaign.name}</span>
              </p>
            ) : (
              <p className="mt-4 text-[12px] text-amber-700">Select a campaign to enroll leads.</p>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-stone-900">Pipeline leads</h3>
            <p className="text-[12px] text-stone-500">
              Select prospects and enroll them into{' '}
              {selectedCampaign ? selectedCampaign.name : 'a campaign'}.
            </p>
          </div>
          <Button variant="outline" size="sm" asChild className="shrink-0">
            <Link href="/admin/pipeline">View full pipeline</Link>
          </Button>
        </div>

        <TableToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search prospects, companies, titles…"
          savedViews={
            <TableSavedViews
              views={LINKEDIN_TABLE_VIEWS}
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
          columns={leadColumns}
          rows={sortedLeads}
          selectedIds={selectedLeadIds}
          onSelectionChange={setSelectedLeadIds}
          onRowClick={(row) => router.push(`/admin/pipeline/${row.id}`)}
          sort={sort}
          onSortChange={setSort}
          loading={isLoading}
          emptyState={
            <SectionEmptyState
              title="No leads to enroll"
              description="Add prospects to your pipeline or import from Aspire, then return here to start a sequence."
              actionLabel="Go to pipeline"
              onAction={() => router.push('/admin/pipeline')}
            />
          }
        />

        <BulkActionBar count={selectedLeadIds.length} onClear={() => setSelectedLeadIds([])}>
          <Button
            size="sm"
            variant="secondary"
            disabled={enrolling || !selectedCampaignId}
            onClick={() => void handleEnroll(selectedLeadIds)}
          >
            {enrolling ? 'Enrolling…' : 'Enroll in campaign'}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => void handleBulkStatus('contacted')}>
            Mark contacted
          </Button>
          <Button size="sm" variant="secondary" onClick={() => void handleBulkStatus('connected')}>
            Mark connected
          </Button>
          <Button size="sm" variant="outline" disabled title="Coming soon">
            Export
          </Button>
        </BulkActionBar>
      </div>
    </div>
  )
}
