import { tasks } from "@trigger.dev/sdk";
import { createLinkedInInfraFromEnv } from "@vantera/linkedin-infra";
import { createServiceClient } from "@/lib/supabase/service";
import { handleInboundWebhook } from "@/server/inbound-webhooks";
import { recordSecurityEvent, eventRequestMeta } from "@/lib/security/audit";

export async function POST(req: Request) {
  const rawBody = await req.text();
  const headers = Object.fromEntries(req.headers.entries());

  // A missing provider env var used to throw here, turning every inbound event into an
  // unexplained 500. Fail with a logged, named reason instead — the 503 still tells the
  // provider to retry once the config is fixed.
  let infra: ReturnType<typeof createLinkedInInfraFromEnv>;
  try {
    infra = createLinkedInInfraFromEnv();
  } catch (err) {
    console.error("linkedin webhook: provider config unavailable", err);
    return new Response("provider not configured", { status: 503 });
  }

  const result = await handleInboundWebhook("linkedin", headers, rawBody, {
    verify: (h, b) => infra.verifyWebhook(h, b),
    onUnverified: async () => {
      const { ip, userAgent } = eventRequestMeta(req);
      await recordSecurityEvent({
        eventType: "webhook.signature_invalid",
        severity: "warn",
        ip,
        userAgent,
        metadata: { source: "linkedin" },
      });
    },
    extractEventId: (p) => infra.parseEventWebhook(p)?.providerEventId ?? null,
    onUnparsed: async (payload) => {
      // Shape only — the payload can carry prospect PII, and the field names are what
      // identify drift.
      const keys =
        typeof payload === "object" && payload !== null ? Object.keys(payload) : [typeof payload];
      console.warn("linkedin webhook: verified but unparsed; payload keys:", keys);
    },
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
