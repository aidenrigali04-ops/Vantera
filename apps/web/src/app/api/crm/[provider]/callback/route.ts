import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/site-url";
import { getConnector, encryptToken, isCrmProvider, type CrmProvider } from "@vantera/crm-infra";

// OAuth callback for a CRM / notification destination. The provider sends the user back here
// with `code` + `state`; we verify the CSRF state against the pending connection, exchange the
// code for tokens, store them encrypted (AES-256-GCM, CRM_TOKEN_KEY), and flip the connection
// to active. accountId is resolved from the session — never from params (rule 02). Tokens are
// never logged and never returned to the client.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  const fail = (reason: string): never =>
    redirect(`/settings/integrations?error=${encodeURIComponent(reason)}`);

  if (!isCrmProvider(provider)) fail("unsupported");
  if (!code || !state) fail("denied");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/settings/integrations");

  // Match the pending connection by provider; verify the state we issued at connect time.
  const { data: connection } = await supabase
    .from("crm_connections")
    .select("id, config")
    .eq("provider", provider)
    .maybeSingle<{ id: string; config: { oauthState?: string } & Record<string, unknown> }>();

  if (!connection || connection.config?.oauthState !== state) fail("state-mismatch");
  const conn = connection!;

  const redirectUri = `${siteUrl()}/api/crm/${provider}/callback`;
  const nextConfig = { ...conn.config };
  delete nextConfig.oauthState;

  try {
    // provider verified by isCrmProvider above; narrow for the typed factory
    const token = await getConnector(provider as CrmProvider).exchangeCode(code!, redirectUri);
    const { error } = await supabase
      .from("crm_connections")
      .update({
        status: "active",
        access_token_enc: encryptToken(token.accessToken),
        refresh_token_enc: token.refreshToken ? encryptToken(token.refreshToken) : null,
        token_expires_at: token.expiresAt ?? null,
        external_account_ref: token.externalAccountRef ?? null,
        last_error: null,
        last_sync_at: new Date().toISOString(),
        config: nextConfig,
      })
      .eq("id", conn.id);
    if (error) throw new Error("persist failed");
  } catch {
    // exchange or encryption failed — surface on the connection health card, prompt reconnect
    await supabase
      .from("crm_connections")
      .update({ status: "error", last_error: "Couldn't finish connecting. Try again." })
      .eq("id", conn.id);
    fail("connect-failed");
  }

  redirect(`/settings/integrations?connected=${provider}`);
}
