import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client for webhook/unsubscribe routes ONLY — bypasses RLS.
 * Never import from client code or user-session paths.
 */
export function createServiceClient() {
  return createSupabaseClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}
