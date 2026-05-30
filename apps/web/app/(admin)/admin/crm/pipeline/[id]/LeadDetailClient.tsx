'use client'

import { convertLeadToClient } from '@/lib/leads/convert'
import { updateLead } from '@/lib/leads/actions'
import { formatRelativeTime } from '@/lib/contacts/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { activities, leadProfiles, leads } from '@vantera/db'
import { ArrowLeft, Brain, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'

type Props = {
  lead: typeof leads.$inferSelect
  profile: typeof leadProfiles.$inferSelect | null
  activities: (typeof activities.$inferSelect)[]
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

export function LeadDetailClient({ lead, profile, activities }: Props) {
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
    router.push(`/admin/crm/clients/${result.data.contactId}`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/crm/pipeline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Pipeline
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 rounded-xl border border-stone-200 bg-white p-5 shadow-sm lg:col-span-1">
          <div>
            <h1 className="text-xl font-semibold text-stone-900">{name}</h1>
            <p className="mt-1 text-sm text-stone-500">
              {lead.title ? `${lead.title} · ` : ''}
              {lead.company}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{lead.source}</Badge>
            <Badge variant="secondary">Score {lead.score}</Badge>
          </div>
          <div className="space-y-2 text-sm">
            {lead.email ? (
              <p>
                <span className="text-stone-500">Email:</span> {lead.email}
              </p>
            ) : null}
            {lead.phone ? (
              <p>
                <span className="text-stone-500">Phone:</span> {lead.phone}
              </p>
            ) : null}
            {lead.linkedinUrl ? (
              <p>
                <span className="text-stone-500">LinkedIn:</span>{' '}
                <a href={lead.linkedinUrl} className="text-blue-600 hover:underline" target="_blank" rel="noreferrer">
                  Profile
                </a>
              </p>
            ) : null}
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-stone-500">
              Relationship status
            </p>
            <Select value={status} onValueChange={handleStatusChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.replace(/_/g, ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {lead.convertedContactId ? (
            <Button asChild className="w-full">
              <Link href={`/admin/crm/clients/${lead.convertedContactId}`}>View active client</Link>
            </Button>
          ) : (
            <Button className="w-full" onClick={handleConvert} disabled={converting}>
              {converting ? 'Converting...' : 'Convert to client'}
            </Button>
          )}
        </div>

        <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm lg:col-span-1">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-stone-500">
            Timeline
          </h2>
          <div className="space-y-4">
            {activities.length === 0 ? (
              <p className="text-sm text-stone-500">No activity yet.</p>
            ) : (
              activities.map((activity) => (
                <div key={activity.id} className="flex gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stone-100">
                    <Sparkles className="h-4 w-4 text-stone-600" />
                  </span>
                  <div>
                    <p className="text-sm text-stone-800">{activity.body ?? activity.activityType}</p>
                    <p className="text-xs text-stone-500">{formatRelativeTime(activity.createdAt)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm lg:col-span-1">
          <div className="mb-4 flex items-center gap-2">
            <Brain className="h-4 w-4 text-stone-500" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
              AI insights
            </h2>
          </div>
          {profile ? (
            <div className="space-y-3 text-sm">
              {profile.openingHook ? (
                <div>
                  <p className="text-xs font-medium text-stone-500">Opening hook</p>
                  <p className="mt-1 text-stone-800">{profile.openingHook}</p>
                </div>
              ) : null}
              {Array.isArray(profile.topTriggers) && profile.topTriggers.length ? (
                <div>
                  <p className="text-xs font-medium text-stone-500">Triggers</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(profile.topTriggers as string[]).map((t) => (
                      <Badge key={t} variant="outline">
                        {t}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-stone-500">
              Enrichment and AI insights appear here after Aspire or LinkedIn sync.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
