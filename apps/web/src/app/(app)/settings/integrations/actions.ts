"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/site-url";
import {
  buildAuthorizeUrl,
  getConnectorMeta,
  type CrmProvider,
} from "@vantera/crm-infra";
import { validateProvider, validateConnectionConfig, nextActivityConfig, type ActivityConfig } from "./validation";

export type IntegrationActionState = { error?: string; success?: string };

const PATH = "/settings/integrations";

// OAuth client credentials live per-provider in env (rule 10). When a provider's client id
// is present we run the real OAuth redirect; otherwise the adapter is "stubbed" (the scope
// chosen for this build) and Connect stands up a real DB connection so the management UI is
// fully exercisable. The push pipeline + token exchange are the remainder of Phase 9.
function oauthClientId(provider: CrmProvider): string | undefined {
  return process.env[`CRM_${provider.toUpperCase()}_CLIENT_ID`] || undefined;
}

async function resolveAccountId(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  // account always resolved from the RLS-scoped session — never from the form (rule 02)
  const { data: account } = await supabase
    .from("accounts")
    .select("id")
    .limit(1)
    .maybeSingle<{ id: string }>();
  return account?.id ?? null;
}

// ── Connect ───────────────────────────────────────────────────────────────────
// Returns { url } to redirect into the provider's OAuth dialog when configured, or
// { success } when the stub connection was created. Errors come back as { error }.
export async function connectDestination(
  providerInput: string
): Promise<{ url?: string; success?: string; error?: string }> {
  const parsed = validateProvider(providerInput);
  if (!parsed.ok) return { error: parsed.error };
  const provider = parsed.values;
  const meta = getConnectorMeta(provider)!;

  const supabase = await createClient();
  const accountId = await resolveAccountId(supabase);
  if (!accountId) return { error: "Your session expired. Sign in again." };

  const defaultConfig = {
    autoPush: true,
    target: {},
    mapping: meta.defaultMapping,
  };

  const clientId = oauthClientId(provider);
  if (clientId) {
    // Real OAuth path: stand up a 'connecting' row, send the user to authorize.
    const state = randomUUID();
    const { error } = await supabase.from("crm_connections").upsert(
      {
        account_id: accountId,
        provider,
        kind: meta.kind,
        status: "connecting",
        config: { ...defaultConfig, oauthState: state },
      },
      { onConflict: "account_id,provider" }
    );
    if (error) return { error: "Could not start the connection. Try again shortly." };

    const url = buildAuthorizeUrl({
      provider,
      clientId,
      redirectUri: `${siteUrl()}/api/crm/${provider}/callback`,
      state,
    });
    if (!url) return { error: "That destination isn't supported." };
    revalidatePath(PATH);
    return { url };
  }

  // No OAuth client configured: say so honestly (L4 trust integrity, spec 2026-07-15).
  // The old behavior wrote a fake "active"/"stub" row that showed "Connected · healthy"
  // while pushing nothing — a hollow success is worse than a clear not-yet.
  return {
    error: `${meta.label} is finishing certification — the connection opens here the moment it's live.`,
  };
}

// ── Disconnect ──────────────────────────────────────────────────────────────────
export async function disconnectDestination(
  _prev: IntegrationActionState,
  formData: FormData
): Promise<IntegrationActionState> {
  const id = String(formData.get("connectionId") ?? "");
  if (!id) return { error: "Missing connection." };

  const supabase = await createClient();
  // RLS limits the delete to the caller's account + admin policy; no account id passed.
  const { error } = await supabase.from("crm_connections").delete().eq("id", id);
  if (error) return { error: "Could not disconnect. Try again shortly." };
  revalidatePath(PATH);
  return { success: "Disconnected." };
}

// ── Save target + field mapping ─────────────────────────────────────────────────
export async function saveConnectionConfig(
  _prev: IntegrationActionState,
  formData: FormData
): Promise<IntegrationActionState> {
  const id = String(formData.get("connectionId") ?? "");
  const provider = String(formData.get("provider") ?? "");
  if (!id) return { error: "Missing connection." };

  const meta = getConnectorMeta(provider);
  if (!meta) return { error: "That destination isn't supported." };

  const target: Record<string, string> = {};
  for (const field of meta.targets) {
    target[field.key] = String(formData.get(`target.${field.key}`) ?? "");
  }
  const mapping: Record<string, string> = {};
  for (const field of meta.fields) {
    mapping[field.source] = String(formData.get(`mapping.${field.source}`) ?? "");
  }

  const parsed = validateConnectionConfig(provider, {
    autoPush: formData.get("autoPush") ?? false,
    target,
    mapping,
  });
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  // Merge over the existing config — replacing it wholesale would silently wipe keys other
  // features own (activity sync settings, the OAuth state).
  const { data: row } = await supabase
    .from("crm_connections")
    .select("config")
    .eq("id", id)
    .maybeSingle<{ config: Record<string, unknown> }>();
  if (!row) return { error: "Connection not found." };

  const { error } = await supabase
    .from("crm_connections")
    .update({ config: { ...row.config, ...parsed.values } })
    .eq("id", id);
  if (error) return { error: "Could not save settings. Try again shortly." };
  revalidatePath(PATH);
  return { success: "Settings saved." };
}

// ── Activity sync (timeline notes) ────────────────────────────────────────────────
// Opt-in per connection: LinkedIn touches (outreach, replies, meetings) are logged onto
// the destination's contact timeline by the sync pipeline. Fresh enables start from NOW —
// history is never imported (see nextActivityConfig).
export async function saveActivitySync(
  _prev: IntegrationActionState,
  formData: FormData
): Promise<IntegrationActionState> {
  const id = String(formData.get("connectionId") ?? "");
  if (!id) return { error: "Missing connection." };

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("crm_connections")
    .select("config")
    .eq("id", id)
    .maybeSingle<{ config: Record<string, unknown> & { activity?: Partial<ActivityConfig> } }>();
  if (!row) return { error: "Connection not found." };

  const activity = nextActivityConfig(row.config?.activity, {
    enabled: formData.get("enabled") === "on",
    outreach: formData.get("events.outreach") === "on",
    replies: formData.get("events.replies") === "on",
    meetings: formData.get("events.meetings") === "on",
  });

  const { error } = await supabase
    .from("crm_connections")
    .update({ config: { ...row.config, activity } })
    .eq("id", id);
  if (error) return { error: "Could not save activity sync. Try again shortly." };
  revalidatePath(PATH);
  return {
    success: activity.enabled
      ? "Activity sync on — touches from now on will appear on the contact timeline."
      : "Activity sync off.",
  };
}

// ── Toggle auto-push ──────────────────────────────────────────────────────────────
export async function toggleAutoPush(
  _prev: IntegrationActionState,
  formData: FormData
): Promise<IntegrationActionState> {
  const id = String(formData.get("connectionId") ?? "");
  const next = formData.get("autoPush") === "true";
  if (!id) return { error: "Missing connection." };

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("crm_connections")
    .select("config")
    .eq("id", id)
    .maybeSingle<{ config: Record<string, unknown> }>();
  if (!row) return { error: "Connection not found." };

  const { error } = await supabase
    .from("crm_connections")
    .update({ config: { ...row.config, autoPush: next } })
    .eq("id", id);
  if (error) return { error: "Could not update auto-push. Try again shortly." };
  revalidatePath(PATH);
  return { success: next ? "Auto-push on." : "Auto-push off." };
}

// ── Test connection ───────────────────────────────────────────────────────────────
// In the stubbed scope this confirms the row + stamps last_sync_at. When the real adapters
// land it will call connector.testConnection() and flip status on failure.
export async function testConnection(
  _prev: IntegrationActionState,
  formData: FormData
): Promise<IntegrationActionState> {
  const id = String(formData.get("connectionId") ?? "");
  if (!id) return { error: "Missing connection." };

  // L4: never fabricate health. Stub rows (pre-honesty connects) report the truth.
  const supabase = await createClient();
  const { data: conn } = await supabase
    .from("crm_connections")
    .select("external_account_ref")
    .eq("id", id)
    .maybeSingle<{ external_account_ref: string | null }>();
  if (!conn) return { error: "Missing connection." };
  if (conn.external_account_ref === "stub") {
    return { error: "This connection was never completed — the provider link is still being certified. Disconnect it and reconnect once it opens." };
  }
  const { error } = await supabase
    .from("crm_connections")
    .update({ status: "active", last_error: null, last_sync_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: "Could not reach this destination. Try again shortly." };
  revalidatePath(PATH);
  return { success: "Connection healthy." };
}
