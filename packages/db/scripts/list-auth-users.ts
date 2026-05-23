// Quick diagnostic: list every Supabase auth user.
import ws from 'ws'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceKey) {
  console.error('Env not set.')
  process.exit(1)
}

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: ws as never },
})

async function main(): Promise<void> {
  let page = 1
  let total = 0
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) {
      console.error(error)
      break
    }
    for (const u of data.users) {
      total += 1
      console.log(`  ${u.email}  [${u.id}]  created=${u.created_at}`)
    }
    if (data.users.length < 200) break
    page += 1
  }
  console.log(`\nTotal: ${total} Supabase auth user(s).`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
