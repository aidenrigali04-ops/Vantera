import { env } from '@/lib/env'
import { createClient } from '@supabase/supabase-js'

// Read-only Supabase client — no cookies(), safe for layouts and metadata
export function createSupabasePublicClient() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
