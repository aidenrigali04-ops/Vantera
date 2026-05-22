import { env } from '@/lib/env'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// NEVER import this in client components or expose to browser
let adminClient: SupabaseClient | undefined

export function getSupabaseAdmin(): SupabaseClient {
  if (!adminClient) {
    adminClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  }

  return adminClient
}

/** @deprecated Use getSupabaseAdmin() — lazy init avoids build-time side effects */
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = getSupabaseAdmin() as object
    const value = Reflect.get(client, prop, receiver)
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(client) : value
  },
})
