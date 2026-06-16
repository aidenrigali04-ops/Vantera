import { tasks } from "@trigger.dev/sdk";
import { createMessageInfraFromEnv } from "@vantera/imessage-infra";
import { createServiceClient } from "@/lib/supabase/service";
import { handleInboundWebhook } from "@/server/inbound-webhooks";
import { recordSecurityEvent, eventRequestMeta } from "@/lib/security/audit";

export async function POST(req: Request) {
  const rawBody = await req.text();
  const headers = Object.fromEntries(req.headers.entries());
  const infra = createMessageInfraFromEnv();
  const result = await handleInboundWebhook("imessage", headers, rawBody, {
    verify: (h, b) => infra.verifyWebhook(h, b),
    onUnverified: async () => {
      const { ip, userAgent } = eventRequestMeta(req);
      await recordSecurityEvent({
        eventType: "webhook.signature_invalid",
        severity: "warn",
        ip,
        userAgent,
        metadata: { source: "imessage" },
      });
    },
    // iMessage events carry the provider message id as the idempotency key.
    extractEventId: (p) => infra.parseEventWebhook(p)?.providerMessageId ?? null,
    recordEvent: async (source, providerEventId, payload) => {
      const supabase = createServiceClient();
      const { error } = await supabase
        .from("webhook_events")
        .insert({ source, provider_event_id: providerEventId, payload });
      if (error) {
        if (error.code === "23505") return false; // genuine duplicate
        throw new Error(`webhook event store failed: ${error.code}`); // → 500, vendor retries
      }
      return true;
    },
    enqueue: async (payload) => {
      await tasks.trigger("process-inbound", payload);
    },
  });
  return new Response(result.body, { status: result.status });
}
