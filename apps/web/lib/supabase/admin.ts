import { env } from '@/lib/env'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// NEVER import this in client components or expose to browser
let adminClient: SupabaseClient | undefined

function buildAdminClientOptions(): NonNullable<Parameters<typeof createClient>[2]> {
  const options: NonNullable<Parameters<typeof createClient>[2]> = {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }

  // Realtime WebSocket transport is only needed for Larry/CLI on older Node.
  // Avoid a top-level `ws` import — it breaks some Vercel/serverless bundles
  // and is unnecessary for REST-only admin queries (signup, onboarding, etc.).
  if (typeof WebSocket === 'undefined') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const ws = require('ws') as typeof WebSocket
      options.realtime = {
        transport: ws as unknown as typeof WebSocket,
      }
    } catch {
      // REST-only — fine for account/user CRUD.
    }
  }

  return options
}

export function getSupabaseAdmin(): SupabaseClient {
  if (!adminClient) {
    adminClient = createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      buildAdminClientOptions(),
    )
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
