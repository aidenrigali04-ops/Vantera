// Probe: can the anon key read from `users`?
// If yes, the RLS policy is effectively wide-open (a serious bug).
import ws from 'ws'
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url || !anon) {
  console.error('NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY not set.')
  process.exit(1)
}

const supabase = createClient(url, anon, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: ws as never },
})

async function main(): Promise<void> {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, account_id, role')
    .limit(10)

  console.log('error:', error)
  console.log('rows returned:', data?.length ?? 0)
  if (data && data.length > 0) {
    console.log('SAMPLE row:', data[0])
    console.log('\n⚠️  ANON KEY CAN READ THE USERS TABLE — this is a major tenant-leak.')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
