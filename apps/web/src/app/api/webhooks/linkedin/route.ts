import { tasks } from "@trigger.dev/sdk";
import { createLinkedInInfraFromEnv } from "@vantera/linkedin-infra";
import { createServiceClient } from "@/lib/supabase/service";
import { handleInboundWebhook } from "@/server/inbound-webhooks";

export async function POST(req: Request) {
  const rawBody = await req.text();
  const headers = Object.fromEntries(req.headers.entries());
  const infra = createLinkedInInfraFromEnv();
  const result = await handleInboundWebhook("linkedin", headers, rawBody, {
    verify: (h, b) => infra.verifyWebhook(h, b),
    extractEventId: (p) => infra.parseEventWebhook(p)?.providerEventId ?? null,
    recordEvent: async (source, providerEventId, payload) => {
      const supabase = createServiceClient();
      const { error } = await supabase
        .from("webhook_events")
        .insert({ source, provider_event_id: providerEventId, payload });
      return !error; // unique violation = duplicate
    },
    enqueue: async (payload) => {
      await tasks.trigger("process-inbound", payload);
    },
  });
  return new Response(result.body, { status: result.status });
}
