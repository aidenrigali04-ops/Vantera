import { tasks } from "@trigger.dev/sdk";
import { decryptTokenWithKeyring } from "@vantera/crm-infra";
import { isMeetingProvider } from "@vantera/meetings-infra";
import { createServiceClient } from "@/lib/supabase/service";
import { handleMeetingWebhook } from "@/server/meeting-webhooks";
import { recordSecurityEvent, eventRequestMeta } from "@/lib/security/audit";

/** ML-6: booking webhooks from a connected scheduling tool (one URL + signing secret per connection). */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ provider: string; connectionId: string }> }
) {
  const { provider, connectionId } = await params;
  const rawBody = await req.text();
  const headers = Object.fromEntries(req.headers.entries());
  const supabase = createServiceClient();

  const result = await handleMeetingWebhook(provider, connectionId, headers, rawBody, {
    loadConnection: async (id) => {
      const { data } = await supabase
        .from("meeting_connections")
        .select("id, provider, signing_secret_enc")
        .eq("id", id)
        .maybeSingle<{ id: string; provider: string; signing_secret_enc: string }>();
      if (!data || !isMeetingProvider(data.provider)) return null;
      return { id: data.id, provider: data.provider, signingSecret: decryptTokenWithKeyring(data.signing_secret_enc) };
    },
    recordEvent: async (source, providerEventId, payload) => {
      const { error } = await supabase.from("webhook_events").insert({ source, provider_event_id: providerEventId, payload });
      if (error) {
        if (error.code === "23505") return false; // genuine duplicate
        throw new Error(`webhook event store failed: ${error.code}`); // → 500, vendor retries
      }
      return true;
    },
    enqueue: async (payload) => {
      await tasks.trigger("process-meeting-event", payload);
    },
    onUnverified: async (source) => {
      const { ip, userAgent } = eventRequestMeta(req);
      await recordSecurityEvent({ eventType: "webhook.signature_invalid", severity: "warn", ip, userAgent, metadata: { source } });
    },
  });
  return new Response(result.body, { status: result.status });
}
