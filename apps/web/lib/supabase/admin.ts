import { env } from '@/lib/env'
import { createClient } from '@supabase/supabase-js'

// NEVER import this in client components or expose to browser
export const supabaseAdmin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
)
