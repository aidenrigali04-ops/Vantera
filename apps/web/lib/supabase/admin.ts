import { sanitizeEnvValue } from '@/lib/env'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import ws from 'ws'

// NEVER import this in client components or expose to browser
let adminClient: SupabaseClient | undefined

function getAdminCredentials(): { url: string; key: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? sanitizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL)
    : undefined
  const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY
  const key = rawKey ? sanitizeEnvValue(rawKey) : undefined

  if (!url || !key) {
    throw new Error(
      'Supabase admin credentials are not configured (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).',
    )
  }

  return { url, key }
}

function buildAdminClientOptions(): NonNullable<Parameters<typeof createClient>[2]> {
  const options: NonNullable<Parameters<typeof createClient>[2]> = {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }

  // Supabase JS 2.106+ constructs RealtimeClient in createClient(). On Node
  // (< 22) that requires the `ws` transport — a dynamic require() often fails
  // once Next bundles server code for Vercel, which is what broke onboarding
  // after signup (resolveSessionWorkspace could not init the admin client).
  if (typeof window === 'undefined') {
    options.realtime = {
      transport: ws as unknown as typeof WebSocket,
    }
  }

  return options
}

export function getSupabaseAdmin(): SupabaseClient {
  if (!adminClient) {
    const { url, key } = getAdminCredentials()
    adminClient = createClient(url, key, buildAdminClientOptions())
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
