import type { SupabaseClient } from "@supabase/supabase-js";
import { googleOAuthRedirectTo } from "./oauth-redirect";
import { friendlyAuthError } from "./errors";

export async function startGoogleOAuth(
  supabase: Pick<SupabaseClient, "auth">,
  params: { next?: unknown; site?: unknown; invite?: unknown }
): Promise<{ url: string } | { error: string }> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: googleOAuthRedirectTo(params),
      skipBrowserRedirect: true,
      // Let invitees pick the Google account that matches the invited email.
      queryParams: { prompt: "select_account" },
    },
  });
  if (error) return { error: friendlyAuthError(error.message) };
  if (!data.url) {
    return { error: "Google sign-in isn't available yet. Use email and password." };
  }
  return { url: data.url };
}
