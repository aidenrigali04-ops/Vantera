"use server";

import { revalidatePath } from "next/cache";
import { randomBytes, randomUUID } from "node:crypto";
import { decryptTokenWithKeyring, encryptTokenWithKeyring } from "@vantera/crm-infra";
import { getMeetingsInfra, isMeetingProvider, MeetingsError } from "@vantera/meetings-infra";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { siteUrl } from "@/lib/site-url";
import { parseSchedulingForm, schedulingError } from "./scheduling-validation";

export type SchedulingState = { error?: string; success?: string };

const PATH = "/settings/integrations";

/** The session's account, only when the caller is an owner/admin (rule 02 — never from the form). */
async function adminAccount(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("account_members")
    .select("account_id")
    .eq("user_id", user.id)
    .in("role", ["owner", "admin"])
    .limit(1)
    .maybeSingle<{ account_id: string }>();
  return data?.account_id ?? null;
}

/**
 * ML-6: connect a scheduling tool. Verify the pasted key, create the booking webhook pointing at
 * this connection's own URL with a fresh signing secret, then store key + secret encrypted.
 * Secrets are written with the service role only after the admin check above; the client roles
 * can never read them back (0067 column lockdown). If storing fails, the vendor webhook is removed.
 */
export async function connectScheduling(_prev: SchedulingState, formData: FormData): Promise<SchedulingState> {
  const parsed = parseSchedulingForm(formData);
  if (!parsed.ok) return { error: parsed.error };
  const { provider, apiKey } = parsed.values;
  const accountId = await adminAccount();
  if (!accountId) return { error: "Only workspace admins can connect a scheduling tool." };

  const service = createServiceClient();
  const { data: existing } = await service
    .from("meeting_connections")
    .select("id")
    .eq("account_id", accountId)
    .eq("provider", provider)
    .maybeSingle();
  if (existing) return { error: "Already connected — disconnect it first to use a different key." };

  const infra = getMeetingsInfra(provider);
  const check = await infra.verifyCredential(apiKey).catch(() => ({ ok: false as const, reason: "unavailable" as const }));
  if (!check.ok) return { error: schedulingError(provider, check.reason) };

  const id = randomUUID();
  const signingSecret = randomBytes(32).toString("hex");
  let webhookRef: string;
  try {
    ({ webhookRef } = await infra.createWebhook(apiKey, {
      url: `${siteUrl()}/api/webhooks/meetings/${provider}/${id}`,
      signingSecret,
      ownerRef: check.ownerRef,
      scopeRef: check.scopeRef,
    }));
  } catch (err) {
    return { error: schedulingError(provider, err instanceof MeetingsError ? err.reason : "unavailable") };
  }

  const { error } = await service.from("meeting_connections").insert({
    id,
    account_id: accountId,
    provider,
    credential_enc: encryptTokenWithKeyring(apiKey),
    signing_secret_enc: encryptTokenWithKeyring(signingSecret),
    webhook_ref: webhookRef,
    external_owner_ref: check.ownerRef,
    label: check.label,
  });
  if (error) {
    await infra.deleteWebhook(apiKey, webhookRef).catch(() => undefined);
    return { error: "Couldn't save the connection. Try again shortly." };
  }
  revalidatePath(PATH);
  return { success: "Connected — meetings booked through your link will now show up automatically." };
}

/** Disconnect: remove the vendor webhook (best-effort) and delete the stored connection + secrets. */
export async function disconnectScheduling(_prev: SchedulingState, formData: FormData): Promise<SchedulingState> {
  const provider = String(formData.get("provider") ?? "");
  if (!isMeetingProvider(provider)) return { error: "Unknown scheduling tool." };
  const accountId = await adminAccount();
  if (!accountId) return { error: "Only workspace admins can disconnect a scheduling tool." };

  const service = createServiceClient();
  const { data: conn } = await service
    .from("meeting_connections")
    .select("id, credential_enc, webhook_ref")
    .eq("account_id", accountId)
    .eq("provider", provider)
    .maybeSingle<{ id: string; credential_enc: string; webhook_ref: string | null }>();
  if (!conn) return { success: "Disconnected." };

  if (conn.webhook_ref) {
    await getMeetingsInfra(provider)
      .deleteWebhook(decryptTokenWithKeyring(conn.credential_enc), conn.webhook_ref)
      .catch(() => undefined); // a revoked key can't delete — the stale webhook then 404s here
  }
  const { error } = await service.from("meeting_connections").delete().eq("id", conn.id);
  if (error) return { error: "Couldn't disconnect. Try again shortly." };
  revalidatePath(PATH);
  return { success: "Disconnected." };
}
