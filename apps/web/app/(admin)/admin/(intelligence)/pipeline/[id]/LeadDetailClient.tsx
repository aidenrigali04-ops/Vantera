'use client'

import {
  DetailBackLink,
  DetailField,
  DetailFieldGrid,
  DetailHeader,
  DetailLayout,
  DetailSection,
  DetailShell,
  DetailTimeline,
} from '@/components/operational/detail/DetailShell'
import { EmbeddedInsightsPanel } from '@/components/intelligence/EmbeddedInsightsPanel'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatRelativeTime } from '@/lib/contacts/format'
import { convertLeadToClient } from '@/lib/leads/convert'
import { updateLead } from '@/lib/leads/actions'
import type { EmbeddedInsight } from '@/lib/intelligence/types'
import type { activities, leadProfiles, leads } from '@vantera/db'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'

type Props = {
  lead: typeof leads.$inferSelect
  profile: typeof leadProfiles.$inferSelect | null
  activities: (typeof activities.$inferSelect)[]
  insights: EmbeddedInsight[]
}

const STATUS_OPTIONS = [
  'new',
  'contacted',
  'connected',
  'nurturing',
  'qualified',
  'discovery_booked',
  'proposal_sent',
  'won',
  'lost',
] as const

export function LeadDetailClient({ lead, profile, activities, insights }: Props) {
  const router = useRouter()
  const [status, setStatus] = useState(lead.relationshipStatus)
  const [converting, setConverting] = useState(false)
  const name = [lead.firstName, lead.lastName].filter(Boolean).join(' ') || 'Unknown prospect'

  const handleStatusChange = async (value: (typeof STATUS_OPTIONS)[number]) => {
    setStatus(value)
    const result = await updateLead(lead.id, { relationshipStatus: value })
    if (!result.success) {
      toast.error(result.error)
      return
    }
    toast.success('Status updated')
  }

  const handleConvert = async () => {
    setConverting(true)
    const result = await convertLeadToClient(lead.id)
    setConverting(false)
    if (!result.success) {
      toast.error(result.error)
      return
    }
    toast.success('Converted to active client')
    router.push(`/admin/clients/${result.data.contactId}`)
  }

  return (
    <DetailShell>
      <DetailBackLink href="/admin/pipeline" label="Back to pipeline" />

      <DetailHeader
        eyebrow="Prospect"
        title={name}
        subtitle={[lead.title, lead.company].filter(Boolean).join(' · ')}
        badges={
          <>
            <Badge variant="outline">{lead.source}</Badge>
            <Badge variant="secondary">Score {lead.score}</Badge>
            <Badge variant="outline">{status.replace(/_/g, ' ')}</Badge>
          </>
        }
        actions={
          lead.convertedContactId ? (
            <Button asChild className="bg-stone-900 hover:bg-stone-800">
              <Link href={`/admin/clients/${lead.convertedContactId}`}>View active client</Link>
            </Button>
          ) : (
            <Button
              className="bg-stone-900 hover:bg-stone-800"
              onClick={handleConvert}
              disabled={converting}
            >
              {converting ? 'Converting…' : 'Convert to client'}
            </Button>
          )
        }
      />

      <DetailLayout
        main={
          <>
            <DetailSection title="Contact & status">
              <DetailFieldGrid>
                <DetailField label="Email" value={lead.email} />
                <DetailField label="Phone" value={lead.phone} />
                <DetailField label="LinkedIn">
                  {lead.linkedinUrl ? (
                    <a
                      href={lead.linkedinUrl}
                      className="text-blue-600 hover:underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Profile
                    </a>
                  ) : (
                    '—'
                  )}
                </DetailField>
                <DetailField label="Last updated" value={formatRelativeTime(lead.updatedAt)} />
              </DetailFieldGrid>

              <div className="mt-5">
                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-stone-500">
                  Relationship status
                </p>
                <Select value={status} onValueChange={handleStatusChange}>
                  <SelectTrigger className="max-w-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option.replace(/_/g, ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </DetailSection>

            <DetailSection title="Timeline" subtitle="Outreach, replies, and stage changes">
              <DetailTimeline
                items={activities}
                emptyTitle="No activity yet"
                emptyDescription="Enroll in LinkedIn sequences or log outreach to start building history."
              />
            </DetailSection>
          </>
        }
        aside={
          <>
            <DetailSection>
              <EmbeddedInsightsPanel
                insights={insights}
                title="AI insights"
                subtitle="Workflow-native recommendations for this prospect."
                emptyMessage="Insights appear as the system detects momentum, replies, or missing data."
              />
              {profile?.openingHook ? (
                <div className="mt-4 border-t border-stone-100 pt-4">
                  <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-stone-500">
                    Opening hook
                  </p>
                  <p className="mt-1 text-[13px] leading-relaxed text-stone-800">
                    {profile.openingHook}
                  </p>
                </div>
              ) : null}
            </DetailSection>

            <DetailSection title="Quick links">
              <div className="space-y-2 text-[13px]">
                <Link href="/admin/outreach/aspire" className="block text-stone-700 hover:text-stone-900 hover:underline">
                  Enrich in Aspire →
                </Link>
                <Link href="/admin/outreach/linkedin" className="block text-stone-700 hover:text-stone-900 hover:underline">
                  LinkedIn automation →
                </Link>
              </div>
            </DetailSection>
          </>
        }
      />
    </DetailShell>
  )
}
