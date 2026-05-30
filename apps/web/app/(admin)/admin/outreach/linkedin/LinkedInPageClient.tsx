'use client'

import { SequenceBuilder, type SequenceNode } from '@/components/linkedin/SequenceBuilder'
import { KpiStrip } from '@/components/operational/KpiStrip'
import { OperationalTable } from '@/components/operational/OperationalTable'
import { PageHeader } from '@/components/operational/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { leads, linkedinCampaigns } from '@vantera/db'
import { Activity, Link2, Pause, Play, Plus, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

type Campaign = typeof linkedinCampaigns.$inferSelect
type LeadRow = typeof leads.$inferSelect

type Props = {
  campaigns: Campaign[]
  leads: LeadRow[]
  stats: { activeCampaigns: number; totalSequences: number }
  connectionStatus: 'connected' | 'disconnected' | 'pacing'
}

const DEFAULT_NODES: SequenceNode[] = [
  { id: '1', stepNumber: 1, nodeType: 'trigger', label: 'Lead enrolled in campaign' },
  { id: '2', stepNumber: 2, nodeType: 'action', label: 'Send connection request', channel: 'linkedin' },
  { id: '3', stepNumber: 3, nodeType: 'logic', label: 'Wait 2 days if not accepted' },
  { id: '4', stepNumber: 4, nodeType: 'ai', label: 'Draft personalized follow-up DM' },
]

export function LinkedInPageClient({ campaigns, leads, stats, connectionStatus }: Props) {
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(
    campaigns[0]?.id ?? null,
  )
  const [campaignName, setCampaignName] = useState('')
  const [nodes, setNodes] = useState<SequenceNode[]>(DEFAULT_NODES)
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([])

  const selectedCampaign = campaigns.find((c) => c.id === selectedCampaignId)

  const leadColumns = useMemo(
    () => [
      {
        id: 'prospect',
        header: 'Prospect',
        cell: (row: LeadRow) => (
          <div>
            <p className="font-medium text-stone-900">
              {[row.firstName, row.lastName].filter(Boolean).join(' ') || row.company}
            </p>
            <p className="text-xs text-stone-500">{row.company}</p>
          </div>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        cell: (row: LeadRow) => (
          <Badge variant="outline">{row.relationshipStatus.replace(/_/g, ' ')}</Badge>
        ),
      },
      {
        id: 'source',
        header: 'Source',
        cell: (row: LeadRow) => <Badge variant="secondary">{row.source}</Badge>,
      },
    ],
    [],
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

  const handleEnroll = async () => {
    if (!selectedCampaignId || selectedLeadIds.length === 0) {
      toast.error('Select a campaign and leads')
      return
    }
    const res = await fetch('/api/linkedin/enroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaignId: selectedCampaignId, leadIds: selectedLeadIds }),
    })
    const json = await res.json()
    if (!json.success) {
      toast.error(json.error ?? 'Enrollment failed')
      return
    }
    toast.success(`Enrolled ${json.data.enrolled} leads`)
    setSelectedLeadIds([])
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="LinkedIn Automation"
        description="Campaigns, sequences, and connection pacing for pipeline prospects."
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
          <div className="rounded-xl border border-stone-200 bg-white p-4">
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
                        : 'w-full rounded-lg border border-stone-200 px-3 py-2 text-left text-sm hover:bg-stone-50'
                    }
                  >
                    <p className="font-medium text-stone-900">{c.name}</p>
                    <Badge variant="outline" className="mt-1 text-[10px]">
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
              <Button size="sm" className="w-full" onClick={handleCreateCampaign}>
                <Plus className="mr-2 h-4 w-4" />
                Create campaign
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-stone-200 bg-white p-4">
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
          <div className="rounded-xl border border-stone-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-stone-900">Insights</h3>
            <p className="text-sm text-stone-500">
              Sequence execution runs via Trigger.dev. Enroll leads from the pipeline table below.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-stone-700">
              <li>Reply rate: —</li>
              <li>Connections sent today: —</li>
              <li>Pending steps: —</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-stone-900">Pipeline leads</h3>
          <Button size="sm" onClick={handleEnroll} disabled={selectedLeadIds.length === 0}>
            Enroll selected ({selectedLeadIds.length})
          </Button>
        </div>
        <OperationalTable
          columns={leadColumns}
          rows={leads}
          selectedIds={selectedLeadIds}
          onSelectionChange={setSelectedLeadIds}
          emptyState={<p className="p-6 text-sm text-stone-500">No leads available to enroll.</p>}
        />
      </div>
    </div>
  )
}
