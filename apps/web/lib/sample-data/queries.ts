import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { SAMPLE_TAG } from './seed'

export type DashboardClient = {
  id: string
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  source: string | null
  isSample: boolean
}

export type DashboardDeal = {
  id: string
  title: string
  valueCents: number
  closeProbability: number
  stageLabel: string
  stageColor: string
  stagePosition: number
  isTerminalWin: boolean
  isTerminalLoss: boolean
  contactName: string
  isSample: boolean
}

export type DashboardProject = {
  id: string
  title: string
  stageLabel: string
  contactName: string
  valueCents: number
  isSample: boolean
}

export type DashboardSnapshot = {
  clients: DashboardClient[]
  deals: DashboardDeal[]
  projects: DashboardProject[]
  hasSampleData: boolean
  isEmpty: boolean
  pipelineValueCents: number
  weightedPipelineValueCents: number
  wonValueCents: number
}

const EMPTY_SNAPSHOT: DashboardSnapshot = {
  clients: [],
  deals: [],
  projects: [],
  hasSampleData: false,
  isEmpty: true,
  pipelineValueCents: 0,
  weightedPipelineValueCents: 0,
  wonValueCents: 0,
}

export async function getDashboardSnapshot(accountId: string): Promise<DashboardSnapshot> {
  if (!accountId) return EMPTY_SNAPSHOT

  try {
    const admin = getSupabaseAdmin()

    const [contactsRes, recordsRes, stagesRes] = await Promise.all([
      admin
        .from('contacts')
        .select('id, first_name, last_name, email, phone, source, tags')
        .eq('account_id', accountId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(50),
      admin
        .from('records')
        .select(
          'id, title, value_cents, close_probability, record_type, source, stage_id, contact_id',
        )
        .eq('account_id', accountId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(200),
      admin
        .from('stage_definitions')
        .select('id, label, color, position, is_terminal_win, is_terminal_loss')
        .eq('account_id', accountId),
    ])

    if (contactsRes.error || recordsRes.error || stagesRes.error) {
      return EMPTY_SNAPSHOT
    }

    const stagesById = new Map(
      (stagesRes.data ?? []).map((s) => [
        s.id,
        {
          label: s.label as string,
          color: s.color as string,
          position: Number(s.position),
          isTerminalWin: Boolean(s.is_terminal_win),
          isTerminalLoss: Boolean(s.is_terminal_loss),
        },
      ]),
    )

    type ContactRow = {
      id: string
      first_name: string
      last_name: string
      email: string | null
      phone: string | null
      source: string | null
      tags: string[] | null
    }
    const contactsById = new Map<string, ContactRow>()
    const clients: DashboardClient[] = []
    let hasSampleData = false

    for (const c of (contactsRes.data ?? []) as ContactRow[]) {
      contactsById.set(c.id, c)
      const isSample = Array.isArray(c.tags) && c.tags.includes(SAMPLE_TAG)
      if (isSample) hasSampleData = true
      clients.push({
        id: c.id,
        firstName: c.first_name,
        lastName: c.last_name,
        email: c.email,
        phone: c.phone,
        source: c.source,
        isSample,
      })
    }

    const deals: DashboardDeal[] = []
    const projects: DashboardProject[] = []
    let pipelineValueCents = 0
    let weightedPipelineValueCents = 0
    let wonValueCents = 0

    for (const r of recordsRes.data ?? []) {
      const stage = stagesById.get(r.stage_id as string)
      const contact = contactsById.get(r.contact_id as string)
      const contactName =
        contact?.source ?? `${contact?.first_name ?? ''} ${contact?.last_name ?? ''}`.trim() ?? '—'
      const stageLabel = stage?.label ?? '—'
      const stageColor = stage?.color ?? '#64748B'
      const stagePosition = stage?.position ?? 0
      const isTerminalWin = stage?.isTerminalWin ?? false
      const isTerminalLoss = stage?.isTerminalLoss ?? false
      const isSample = r.source === 'demo'
      const valueCents = Number(r.value_cents ?? 0)
      const closeProbability = Number(r.close_probability ?? 0)

      if (r.record_type === 'deal') {
        deals.push({
          id: r.id as string,
          title: r.title as string,
          valueCents,
          closeProbability,
          stageLabel,
          stageColor,
          stagePosition,
          isTerminalWin,
          isTerminalLoss,
          contactName,
          isSample,
        })

        if (isTerminalWin) {
          wonValueCents += valueCents
        } else if (!isTerminalLoss) {
          pipelineValueCents += valueCents
          weightedPipelineValueCents += Math.round((valueCents * closeProbability) / 100)
        }
      } else if (r.record_type === 'project') {
        projects.push({
          id: r.id as string,
          title: r.title as string,
          stageLabel,
          contactName,
          valueCents,
          isSample,
        })
      }
    }

    const isEmpty = clients.length === 0 && deals.length === 0 && projects.length === 0

    return {
      clients,
      deals,
      projects,
      hasSampleData,
      isEmpty,
      pipelineValueCents,
      weightedPipelineValueCents,
      wonValueCents,
    }
  } catch {
    return EMPTY_SNAPSHOT
  }
}

export async function hasSampleDataForAccount(accountId: string): Promise<boolean> {
  if (!accountId) return false
  try {
    const admin = getSupabaseAdmin()
    const { count, error } = await admin
      .from('contacts')
      .select('id', { head: true, count: 'exact' })
      .eq('account_id', accountId)
      .contains('tags', [SAMPLE_TAG])

    if (error) return false
    return Boolean(count && count > 0)
  } catch {
    return false
  }
}
