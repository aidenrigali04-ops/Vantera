import { getSupabaseAdmin } from '@/lib/supabase/admin'

/**
 * Sample-workspace seeding for new accounts.
 *
 * Philosophy: rather than gate the first session behind a configuration
 * wizard, new accounts get a populated "explorable" workspace immediately
 * — three sample agency clients, five deals across the pipeline, and two
 * active projects. The user can either layer real data on top, or clear
 * the sample data via {@link clearSampleData} to start fresh.
 *
 * Sample data is identified by two markers:
 *   - contacts.tags contains 'demo'
 *   - records.source = 'demo'
 *
 * stage_definitions are intentionally NOT marked as sample data: they
 * are operational configuration (pipeline stages) that the user will
 * still need after wiping demo content, so the empty state has a
 * pipeline to add the first real deal into.
 */

export const SAMPLE_TAG = 'demo'
export const SAMPLE_SOURCE = 'demo'

type StageSeed = {
  recordType: 'deal' | 'project'
  label: string
  position: number
  color: string
  triggersAutomation: boolean
  isTerminalWin: boolean
  isTerminalLoss: boolean
}

const DEAL_STAGES: StageSeed[] = [
  { recordType: 'deal', label: 'Lead', position: 1, color: '#94A3B8', triggersAutomation: false, isTerminalWin: false, isTerminalLoss: false },
  { recordType: 'deal', label: 'Qualified', position: 2, color: '#60A5FA', triggersAutomation: true, isTerminalWin: false, isTerminalLoss: false },
  { recordType: 'deal', label: 'Proposal', position: 3, color: '#A855F7', triggersAutomation: true, isTerminalWin: false, isTerminalLoss: false },
  { recordType: 'deal', label: 'Negotiation', position: 4, color: '#F59E0B', triggersAutomation: true, isTerminalWin: false, isTerminalLoss: false },
  { recordType: 'deal', label: 'Won', position: 5, color: '#10B981', triggersAutomation: false, isTerminalWin: true, isTerminalLoss: false },
  { recordType: 'deal', label: 'Lost', position: 6, color: '#EF4444', triggersAutomation: false, isTerminalWin: false, isTerminalLoss: true },
]

const PROJECT_STAGES: StageSeed[] = [
  { recordType: 'project', label: 'Active', position: 1, color: '#60A5FA', triggersAutomation: true, isTerminalWin: false, isTerminalLoss: false },
  { recordType: 'project', label: 'On Hold', position: 2, color: '#F59E0B', triggersAutomation: false, isTerminalWin: false, isTerminalLoss: false },
  { recordType: 'project', label: 'Completed', position: 3, color: '#10B981', triggersAutomation: false, isTerminalWin: true, isTerminalLoss: false },
]

const SAMPLE_CONTACTS = [
  {
    firstName: 'Sarah',
    lastName: 'Chen',
    email: 'sarah@acme.example',
    phone: '+15550100001',
    source: 'Acme Corporation',
    notes: 'Sample contact — Acme Corporation.',
  },
  {
    firstName: 'Marcus',
    lastName: 'Webb',
    email: 'marcus@brightside.example',
    phone: '+15550100002',
    source: 'Brightside Studios',
    notes: 'Sample contact — Brightside Studios.',
  },
  {
    firstName: 'Priya',
    lastName: 'Patel',
    email: 'priya@northwind.example',
    phone: '+15550100003',
    source: 'Northwind Labs',
    notes: 'Sample contact — Northwind Labs.',
  },
]

type DealSeed = {
  contactIndex: number
  stageLabel: string
  title: string
  valueCents: number
  closeProbability: number
}

const SAMPLE_DEALS: DealSeed[] = [
  { contactIndex: 0, stageLabel: 'Proposal', title: 'Q2 Marketing Campaign', valueCents: 2_400_000, closeProbability: 75 },
  { contactIndex: 1, stageLabel: 'Qualified', title: 'Brand Identity Refresh', valueCents: 1_850_000, closeProbability: 50 },
  { contactIndex: 0, stageLabel: 'Negotiation', title: 'Website Redesign', valueCents: 3_600_000, closeProbability: 80 },
  { contactIndex: 2, stageLabel: 'Lead', title: 'SEO + Content Strategy', valueCents: 1_200_000, closeProbability: 30 },
  { contactIndex: 1, stageLabel: 'Proposal', title: 'Annual Retainer 2026', valueCents: 6_000_000, closeProbability: 65 },
]

type ProjectSeed = {
  contactIndex: number
  stageLabel: string
  title: string
  valueCents: number
}

const SAMPLE_PROJECTS: ProjectSeed[] = [
  { contactIndex: 0, stageLabel: 'Active', title: 'Acme — Onboarding Implementation', valueCents: 4_500_000 },
  { contactIndex: 2, stageLabel: 'Active', title: 'Northwind — Pipeline Build', valueCents: 2_800_000 },
]

/**
 * Seed a brand-new account with sample agency-style content.
 * Safe to call multiple times — but typically only called once at signup.
 */
export async function seedSampleWorkspace(accountId: string): Promise<void> {
  const admin = getSupabaseAdmin()

  const stagesPayload = [...DEAL_STAGES, ...PROJECT_STAGES].map((s) => ({
    account_id: accountId,
    record_type: s.recordType,
    label: s.label,
    position: s.position,
    color: s.color,
    triggers_automation: s.triggersAutomation,
    is_terminal_win: s.isTerminalWin,
    is_terminal_loss: s.isTerminalLoss,
  }))

  const { data: stageRows, error: stageErr } = await admin
    .from('stage_definitions')
    .insert(stagesPayload)
    .select('id, label, record_type')

  if (stageErr) throw new Error(`Sample seed (stages): ${stageErr.message}`)
  if (!stageRows) throw new Error('Sample seed: stages returned no rows')

  const dealStageByLabel = new Map<string, string>()
  const projectStageByLabel = new Map<string, string>()
  for (const row of stageRows) {
    if (row.record_type === 'deal') dealStageByLabel.set(row.label, row.id)
    if (row.record_type === 'project') projectStageByLabel.set(row.label, row.id)
  }

  const contactsPayload = SAMPLE_CONTACTS.map((c) => ({
    account_id: accountId,
    type: 'agency_client',
    first_name: c.firstName,
    last_name: c.lastName,
    email: c.email,
    phone: c.phone,
    source: c.source,
    notes: c.notes,
    tags: [SAMPLE_TAG],
    portal_access: false,
  }))

  const { data: contactRows, error: contactErr } = await admin
    .from('contacts')
    .insert(contactsPayload)
    .select('id')

  if (contactErr) throw new Error(`Sample seed (contacts): ${contactErr.message}`)
  if (!contactRows || contactRows.length < SAMPLE_CONTACTS.length) {
    throw new Error('Sample seed: contacts returned wrong row count')
  }

  const dealsPayload = SAMPLE_DEALS.map((d) => {
    const stageId = dealStageByLabel.get(d.stageLabel)
    const contactId = contactRows[d.contactIndex]?.id
    if (!stageId) throw new Error(`Sample seed: missing deal stage "${d.stageLabel}"`)
    if (!contactId) throw new Error(`Sample seed: missing contact index ${d.contactIndex}`)
    return {
      account_id: accountId,
      contact_id: contactId,
      record_type: 'deal',
      title: d.title,
      stage_id: stageId,
      value_cents: d.valueCents,
      close_probability: d.closeProbability,
      is_pipeline: true,
      source: SAMPLE_SOURCE,
      priority: 'normal',
    }
  })

  const { error: dealErr } = await admin.from('records').insert(dealsPayload)
  if (dealErr) throw new Error(`Sample seed (deals): ${dealErr.message}`)

  const projectsPayload = SAMPLE_PROJECTS.map((p) => {
    const stageId = projectStageByLabel.get(p.stageLabel)
    const contactId = contactRows[p.contactIndex]?.id
    if (!stageId) throw new Error(`Sample seed: missing project stage "${p.stageLabel}"`)
    if (!contactId) throw new Error(`Sample seed: missing contact index ${p.contactIndex}`)
    return {
      account_id: accountId,
      contact_id: contactId,
      record_type: 'project',
      title: p.title,
      stage_id: stageId,
      value_cents: p.valueCents,
      close_probability: 100,
      is_pipeline: false,
      source: SAMPLE_SOURCE,
      priority: 'normal',
    }
  })

  const { error: projectErr } = await admin.from('records').insert(projectsPayload)
  if (projectErr) throw new Error(`Sample seed (projects): ${projectErr.message}`)
}

/**
 * Hard-delete all sample-tagged content for an account.
 *
 * Hard delete is intentional and safe here: every row is marked with
 * source='demo' or tag='demo'. Anything the user added on top stays
 * untouched. Stage definitions are preserved so the empty state still
 * has a pipeline to add the first real deal/project into.
 */
export async function clearSampleData(accountId: string): Promise<void> {
  const admin = getSupabaseAdmin()

  const { error: recordsErr } = await admin
    .from('records')
    .delete()
    .eq('account_id', accountId)
    .eq('source', SAMPLE_SOURCE)
  if (recordsErr) throw new Error(`Sample clear (records): ${recordsErr.message}`)

  const { error: contactsErr } = await admin
    .from('contacts')
    .delete()
    .eq('account_id', accountId)
    .contains('tags', [SAMPLE_TAG])
  if (contactsErr) throw new Error(`Sample clear (contacts): ${contactsErr.message}`)
}
