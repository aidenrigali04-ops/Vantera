import { tasks } from "@trigger.dev/sdk";
import { createAdsInfraFromEnv } from "@vantera/ads-infra";
import { createServiceClient } from "@/lib/supabase/service";
import { recordSecurityEvent, eventRequestMeta } from "@/lib/security/audit";

/**
 * Ad lead-form webhook (Phase 11). The ad platform POSTs a signed lead-form submission here; we
 * verify the signature, dedupe via webhook_events, and enqueue ad-lead ingestion. GET handles the
 * platform's subscription verification challenge. The vendor name never surfaces (white-label).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token && token === process.env.ADS_VERIFY_TOKEN) {
    return new Response(challenge ?? "", { status: 200 });
  }
  return new Response("forbidden", { status: 403 });
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const headers = Object.fromEntries(req.headers.entries());

  let infra: ReturnType<typeof createAdsInfraFromEnv>;
  try {
    infra = createAdsInfraFromEnv();
  } catch {
    return new Response("ads integration not configured", { status: 503 });
  }

  if (!infra.verifyWebhook(headers, rawBody)) {
    const { ip, userAgent } = eventRequestMeta(req);
    await recordSecurityEvent({
      eventType: "webhook.signature_invalid",
      severity: "warn",
      ip,
      userAgent,
      metadata: { source: "ads" },
    });
    return new Response("invalid signature", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  const lead = infra.parseLeadWebhook(payload);
  if (!lead) return new Response("ignored", { status: 200 });

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("webhook_events")
    .insert({ source: "ads", provider_event_id: lead.providerLeadId, payload });
  if (error) {
    if (error.code === "23505") return new Response("duplicate", { status: 200 });
    throw new Error(`webhook event store failed: ${error.code}`);
  }

  const firstName = lead.fields.firstName ?? lead.fields.fullName?.split(/\s+/)[0] ?? null;
  await tasks.trigger("ads-inbound", {
    providerLeadId: lead.providerLeadId,
    campaignRef: lead.campaignRef,
    email: lead.fields.email ?? null,
    firstName,
    companyName: lead.fields.companyName ?? null,
  });
  return new Response("ok", { status: 200 });
}
