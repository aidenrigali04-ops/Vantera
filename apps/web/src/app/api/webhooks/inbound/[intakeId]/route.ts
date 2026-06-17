import { tasks } from "@trigger.dev/sdk";
import { decryptSecretWithKeyring } from "@vantera/email-infra";
import { createServiceClient } from "@/lib/supabase/service";
import { handleInboundIntake } from "@/server/inbound-intake";
import { recordSecurityEvent, eventRequestMeta } from "@/lib/security/audit";
import { checkLimit, clientIp, rateLimitResponse } from "@/lib/rate-limit";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Inbound intake webhook for the Responder agent. The customer's form / site / signal source
 * POSTs lead events here, signed with the per-agent secret (`X-Vantera-Signature: sha256=…`).
 * Verify → dedupe (webhook_events) → enqueue the responder pipeline. The vendor name is never
 * surfaced; this is the customer's own integration endpoint.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ intakeId: string }> }
) {
  const { intakeId } = await params;
  // Per-IP rate limit (intake ids are UUIDs) — blunts a scanner hammering the endpoint.
  const limited = rateLimitResponse(await checkLimit("publicToken", clientIp(req)));
  if (limited) return limited;
  if (!UUID_RE.test(intakeId)) return new Response("unknown intake", { status: 404 });

  const rawBody = await req.text();
  const headers = Object.fromEntries(req.headers.entries());
  const supabase = createServiceClient();

  const result = await handleInboundIntake(intakeId, headers, rawBody, {
    resolveIntake: async (id) => {
      const { data } = await supabase
        .from("inbound_intake_secrets")
        .select("account_id, agent_id, secret_enc")
        .eq("intake_id", id)
        .maybeSingle();
      if (!data) return null;
      return {
        accountId: data.account_id as string,
        agentId: data.agent_id as string,
        secret: decryptSecretWithKeyring(data.secret_enc as string),
      };
    },
    onUnverified: async () => {
      const { ip, userAgent } = eventRequestMeta(req);
      await recordSecurityEvent({
        eventType: "webhook.signature_invalid",
        severity: "warn",
        ip,
        userAgent,
        metadata: { source: "inbound", intakeId },
      });
    },
    recordEvent: async (providerEventId, payload) => {
      const { error } = await supabase
        .from("webhook_events")
        .insert({ source: "inbound", provider_event_id: providerEventId, payload });
      if (error) {
        if (error.code === "23505") return false; // genuine duplicate
        throw new Error(`webhook event store failed: ${error.code}`); // → 500, source retries
      }
      return true;
    },
    enqueue: async (payload) => {
      await tasks.trigger("inbound-respond", payload);
    },
  });

  return new Response(result.body, { status: result.status });
}
