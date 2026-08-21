import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client for webhook/unsubscribe routes and pre-session auth admin
 * work (the confirmation-free signup) ONLY — bypasses RLS.
 * Never import from client code or session-scoped data paths.
 */
export function createServiceClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY must be set");
  }
  return createSupabaseClient(url, key, { auth: { persistSession: false } });
}

/**
 * Service-role client for the /start claim flow ONLY — the auth admin API
 * (createUser / generateLink). Never returns data to the browser; the session the
 * browser receives is minted by the SSR client via verifyOtp.
 */
export function createAuthAdminClient() {
  return createServiceClient();
}
