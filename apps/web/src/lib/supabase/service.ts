import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client for webhook/unsubscribe routes ONLY — bypasses RLS.
 * Never import from client code or user-session paths.
 */
export function createServiceClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY must be set");
  }
  return createSupabaseClient(url, key, { auth: { persistSession: false } });
}
