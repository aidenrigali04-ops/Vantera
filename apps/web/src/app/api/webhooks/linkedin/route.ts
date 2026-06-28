import { tasks } from "@trigger.dev/sdk";
import { createLinkedInInfraFromEnv } from "@vantera/linkedin-infra";
import { createServiceClient } from "@/lib/supabase/service";
import { handleInboundWebhook } from "@/server/inbound-webhooks";
import { recordSecurityEvent, eventRequestMeta } from "@/lib/security/audit";

export async function POST(req: Request) {
  const rawBody = await req.text();
  const headers = Object.fromEntries(req.headers.entries());
  const infra = createLinkedInInfraFromEnv();
  // TEMP DIAG (remove after fixing parseEventWebhook): events arrive + verify 200 but parse→null,
  // so they're "ignored". Capture the real Unipile payload shape to align the parser.
  try {
    const p = JSON.parse(rawBody) as Record<string, unknown>;
    console.log(
      "[wh-diag]",
      JSON.stringify({
        topKeys: Object.keys(p),
        event: p.event ?? p.event_type ?? p.type ?? null,
        hasEventId: "event_id" in p,
        accountKeys: Object.keys(p).filter((k) => /account|provider/i.test(k)),
        snippet: rawBody.slice(0, 700),
      })
    );
  } catch {
    console.log("[wh-diag] non-json", rawBody.slice(0, 300));
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
