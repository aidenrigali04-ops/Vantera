import { PUBLIC_ENV_DEFAULTS } from '@/config/public-env-defaults'
import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

let browserClient: SupabaseClient | undefined

// Static process.env access — required so Next.js inlines NEXT_PUBLIC_* in client bundles.
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? PUBLIC_ENV_DEFAULTS.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? PUBLIC_ENV_DEFAULTS.NEXT_PUBLIC_SUPABASE_ANON_KEY

export function createSupabaseBrowserClient(): SupabaseClient {
  if (browserClient) {
    return browserClient
  }

  browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey)

  return browserClient
}
