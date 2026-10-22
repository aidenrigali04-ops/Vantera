import type { LinkedInEvent } from "@vantera/linkedin-infra";

export interface WebhookHandlerDeps {
  verify: (headers: Record<string, string>, rawBody: string) => boolean;
  /** providerEventId via the infra adapter's parseEventWebhook; null = not an event we know */
  extractEventId: (payload: unknown) => string | null;
  /** per-lead serialization key (see inboundConcurrencyKey); null = the event id is used */
  concurrencyKeyFor?: (payload: unknown) => string | null;
  /** insert into webhook_events; false = duplicate provider_event_id */
  recordEvent: (source: "linkedin", providerEventId: string, payload: unknown) => Promise<boolean>;
  /**
   * Enqueue processing. `idempotencyKey` is derived from the provider event id, so enqueuing the
   * same event twice runs it once; `concurrencyKey` serializes events from one lead's thread.
   */
  enqueue: (
    payload: { source: "linkedin"; payload: unknown },
    opts: { idempotencyKey: string; concurrencyKey: string }
  ) => Promise<void>;
  /** Optional: invoked when signature verification fails (security auditing). Best-effort. */
  onUnverified?: () => Promise<void> | void;
  /**
   * Optional: invoked when a webhook passes verification but yields no event id. Without this the
   * drop is invisible — a payload-shape drift reads exactly like "nothing happened". Best-effort.
   */
  onUnparsed?: (payload: unknown) => Promise<void> | void;
}

export async function handleInboundWebhook(
  source: "linkedin",
  headers: Record<string, string>,
  rawBody: string,
  deps: WebhookHandlerDeps
): Promise<{ status: number; body: string }> {
  if (!deps.verify(headers, rawBody)) {
    if (deps.onUnverified) await deps.onUnverified();
    return { status: 401, body: "invalid signature" };
  }
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return { status: 400, body: "invalid json" };
  }
  const eventId = deps.extractEventId(payload);
  if (!eventId) {
    if (deps.onUnparsed) await deps.onUnparsed(payload);
    return { status: 200, body: "ignored" };
  }
  // Persist first (the replay source), then enqueue — ALWAYS, duplicates included. A duplicate may
  // be the provider retrying after our enqueue failed (the row was written, the run never was);
  // skipping it lost the event forever. The idempotency key makes a re-enqueue of an event that
  // DID run a no-op, and an enqueue failure throws → 500 → the provider retries.
  const fresh = await deps.recordEvent(source, eventId, payload);
  await deps.enqueue(
    { source, payload },
    { idempotencyKey: `inbound:${source}:${eventId}`, concurrencyKey: deps.concurrencyKeyFor?.(payload) ?? eventId }
  );
  return { status: 200, body: fresh ? "ok" : "duplicate" };
}

/**
 * Two messages from one lead must never be processed in parallel (each would draft its own answer
 * blind to the other). Messages in a thread — replies and outbound echoes — share a key per
 * connected account + counterpart; every other event keys on its own id (no serialization).
 */
export function inboundConcurrencyKey(event: LinkedInEvent): string {
  if (event.type !== "reply" && event.type !== "outbound_echo") return event.providerEventId;
  const url = event.type === "reply" ? event.fromProfileUrl : event.toProfileUrl;
  const who = event.fromProviderRef ?? url.trim().toLowerCase().replace(/\/+$/, "");
  return `${event.connectedAccountRef}:${who}`;
}
