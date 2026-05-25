/**
 * Simulate completeOnboarding DB steps for every incomplete account.
 * Usage: pnpm exec dotenv -e .env -- tsx packages/db/scripts/debug-onboarding-complete.ts
 */
import ws from 'ws'
import { createClient } from '@supabase/supabase-js'
import postgres from 'postgres'

const url = process.env.DATABASE_URL
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !supabaseUrl || !serviceKey) {
  console.error('Missing env vars')
  process.exit(1)
}

const sql = postgres(url, { prepare: false, max: 2 })
const admin = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: ws as never },
})

const FULL_SELECT =
  'id, slug, name, vertical, plan, brand_logo_url, brand_primary_color, brand_secondary_color, portal_domain, timezone, booking_link, review_link, payment_link, emergency_line, business_hours_start, business_hours_end, voice_preference, active_template_id, onboarding_completed_at'

const MINIMAL_SELECT = 'id, slug, name, vertical, onboarding_completed_at'

async function probeAccount(accountId: string, label: string): Promise<void> {
  console.log(`\n--- ${label} (${accountId}) ---`)

  const { data: full, error: fullErr } = await admin
    .from('accounts')
    .select(FULL_SELECT)
    .eq('id', accountId)
    .maybeSingle()

  console.log('full select:', full ? 'OK' : 'NULL', fullErr?.message ?? '')

  const { data: minimal, error: minErr } = await admin
    .from('accounts')
    .select(MINIMAL_SELECT)
    .eq('id', accountId)
    .maybeSingle()

  console.log('minimal select:', minimal ? 'OK' : 'NULL', minErr?.message ?? '')

  const { data: stages } = await admin
    .from('stage_definitions')
    .select('id, label')
    .eq('account_id', accountId)

  console.log('stages:', stages?.length ?? 0)

  const { data: patchDry, error: patchErr } = await admin
    .from('accounts')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', accountId)
    .select('id')
    .maybeSingle()

  console.log('patch updated_at:', patchDry ? 'OK' : 'NULL', patchErr?.message ?? '')

  const { data: markDry, error: markErr } = await admin
    .from('accounts')
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq('id', accountId)
    .select('id')
    .maybeSingle()

  console.log('patch onboarding_completed_at:', markDry ? 'OK' : 'NULL', markErr?.message ?? '')

  if (markDry) {
    await admin
      .from('accounts')
      .update({ onboarding_completed_at: null })
      .eq('id', accountId)
    console.log('(reverted onboarding_completed_at for probe)')
  }
}

async function main(): Promise<void> {
  const accounts = await sql<
    { id: string; name: string; slug: string; onboarding_completed_at: string | null }[]
  >`
    SELECT id, name, slug, onboarding_completed_at
    FROM accounts
    ORDER BY created_at ASC
  `

  console.log(`Found ${accounts.length} account(s)`)

  for (const acc of accounts) {
    await probeAccount(acc.id, `${acc.name} (${acc.slug}) onboarded=${acc.onboarding_completed_at ? 'yes' : 'no'}`)
  }

  // Check if migration 0003 columns exist
  const cols = await sql<{ column_name: string }[]>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'accounts'
    ORDER BY column_name
  `
  console.log('\n=== accounts columns ===')
  console.log(cols.map((c) => c.column_name).join(', '))

  const missing = ['active_template_id', 'voice_preference', 'booking_link'].filter(
    (c) => !cols.some((row) => row.column_name === c),
  )
  if (missing.length > 0) {
    console.log('\n⚠️  MISSING COLUMNS (migration 0003 not applied?):', missing.join(', '))
  }

  await sql.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
