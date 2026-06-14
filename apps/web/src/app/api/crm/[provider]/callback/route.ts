import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isCrmProvider } from "@vantera/crm-infra";

// OAuth callback for a CRM / notification destination. The provider sends the user back here
// with `code` + `state`; we verify the CSRF state against the pending connection and flip it
// to active. accountId is resolved from the session — never from params (rule 02).
//
// Token exchange (connector.exchangeCode -> encrypted tokens) is the remaining adapter work in
// Phase 9: this stub completes the connection lifecycle so the UI flow works end to end. When
// the adapters land, exchange the code here and persist access_token_enc / refresh_token_enc.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  const fail = (reason: string) =>
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

  const nextConfig = { ...connection!.config };
  delete nextConfig.oauthState;

  const { error } = await supabase
    .from("crm_connections")
    .update({
      status: "active",
      last_error: null,
      last_sync_at: new Date().toISOString(),
      config: nextConfig,
    })
    .eq("id", connection!.id);
  if (error) fail("save-failed");

  redirect(`/settings/integrations?connected=${provider}`);
}
