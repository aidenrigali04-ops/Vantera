import { requireAdminSession } from '@/lib/auth/require-session'
import { findLeads, getLeadPipelineStats } from '@/lib/leads/queries'
import { Bot } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  connected: 'Connected',
  nurturing: 'Nurturing',
  qualified: 'Qualified',
  discovery_booked: 'Call booked',
  proposal_sent: 'Proposal',
  won: 'Won',
  lost: 'Lost',
}
const STAGE_ORDER = [
  'new',
  'contacted',
  'connected',
  'nurturing',
  'qualified',
  'discovery_booked',
  'proposal_sent',
  'won',
  'lost',
]

type LeadRow = Awaited<ReturnType<typeof findLeads>>[number]

function fullName(lead: LeadRow): string {
  const name = `${lead.firstName ?? ''} ${lead.lastName ?? ''}`.trim()
  return name || '—'
}

export default async function PipelinePage() {
  const session = await requireAdminSession()
  const [leads, stats] = await Promise.all([
    findLeads(session.accountId, { limit: 100 }),
    getLeadPipelineStats(session.accountId),
  ])

  const countByStage = new Map<string, number>(
    stats.byStatus.map((row): [string, number] => [row.status, Number(row.count)]),
  )
  const total = stats.total
  const shown = leads.length

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <header>
        <h1 className="text-lg font-semibold tracking-[-0.01em] text-stone-900">Pipeline</h1>
        <p className="mt-0.5 text-sm text-stone-500">
          Every lead your agent has sourced — {total.toLocaleString()} total
          {shown < total ? ` · ${shown} shown` : ''}.
        </p>
      </header>

      {/* Stage counts — answer "where is everything?" at a glance. */}
      {total > 0 ? (
        <div className="flex flex-wrap gap-2">
          {STAGE_ORDER.filter((stage) => (countByStage.get(stage) ?? 0) > 0).map((stage) => (
            <div key={stage} className="rounded-lg border border-stone-200 bg-white px-3 py-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
                {STATUS_LABELS[stage] ?? stage}
              </p>
              <p className="text-lg font-semibold text-stone-900">{countByStage.get(stage)}</p>
            </div>
          ))}
        </div>
      ) : null}

      {total === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-stone-200 py-16 text-center">
          <Bot className="h-8 w-8 text-stone-300" aria-hidden />
          <p className="mt-3 text-sm font-medium text-stone-900">No leads yet</p>
          <p className="mt-1 max-w-sm text-sm text-stone-500">
            Your SDR agent fills this as it prospects. Pull your first batch to get started.
          </p>
          <Link
            href="/admin/sdr-agents"
            className="mt-4 rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-stone-700"
          >
            Open agent
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-stone-200">
          <table className="w-full text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-left">
              <tr>
                {['Name', 'Company', 'Title', 'Score', 'Stage', 'Source'].map((heading) => (
                  <th
                    key={heading}
                    className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide text-stone-400"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {leads.map((lead) => (
                <tr key={lead.id} className="transition-colors hover:bg-stone-50">
                  <td className="px-4 py-2.5 font-medium text-stone-900">{fullName(lead)}</td>
                  <td className="px-4 py-2.5 text-stone-600">{lead.company}</td>
                  <td className="px-4 py-2.5 text-stone-600">{lead.title ?? '—'}</td>
                  <td className="px-4 py-2.5 font-semibold text-stone-900">{lead.score ?? 0}</td>
                  <td className="px-4 py-2.5 text-stone-600">
                    {STATUS_LABELS[lead.relationshipStatus] ?? lead.relationshipStatus}
                  </td>
                  <td className="px-4 py-2.5 text-stone-400">{lead.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
