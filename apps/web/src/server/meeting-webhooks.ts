import { getMeetingsInfra, isMeetingProvider, type MeetingEvent, type MeetingProvider } from "@vantera/meetings-infra";

export type MeetingWebhookDeps = {
  /** the connection the URL names, with its DECRYPTED signing secret (null = unknown) */
  loadConnection(connectionId: string): Promise<{ id: string; provider: MeetingProvider; signingSecret: string } | null>;
  /** dedupe gate (webhook_events); false = already seen */
  recordEvent(source: MeetingProvider, providerEventId: string, payload: unknown): Promise<boolean>;
  enqueue(payload: { connectionId: string; event: MeetingEvent }): Promise<void>;
  onUnverified?(provider: MeetingProvider): Promise<void>;
};

/**
 * ML-6: one scheduling-tool delivery. Each connection has its own signing secret, so the URL names
 * the connection (`/api/webhooks/meetings/<provider>/<connectionId>`). Unknown connection or a
 * provider mismatch → 404 (no oracle about which). Signature checked on the RAW body before any
 * parse. The dedupe log keeps only {kind, bookingRef} — never the invitee's personal data.
 */
export async function handleMeetingWebhook(
  providerParam: string,
  connectionId: string,
  headers: Record<string, string>,
  rawBody: string,
  deps: MeetingWebhookDeps
): Promise<{ status: number; body: string }> {
  if (!isMeetingProvider(providerParam)) return { status: 404, body: "not found" };
  const connection = await deps.loadConnection(connectionId);
  if (!connection || connection.provider !== providerParam) return { status: 404, body: "not found" };

  const infra = getMeetingsInfra(connection.provider);
  if (!infra.verifyWebhook(headers, rawBody, connection.signingSecret)) {
    await deps.onUnverified?.(connection.provider);
    return { status: 401, body: "invalid signature" };
  }
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return { status: 400, body: "invalid json" };
  }
  const event = infra.parseWebhook(payload);
  if (!event) return { status: 200, body: "ignored" };
  // dedupe per connection: two workspaces sharing a calendar each get the delivery (rls-auditor)
  if (!(await deps.recordEvent(connection.provider, `${connection.id}:${event.providerEventId}`, { kind: event.kind, bookingRef: event.bookingRef }))) {
    return { status: 200, body: "duplicate" };
  }
  await deps.enqueue({ connectionId: connection.id, event });
  return { status: 200, body: "ok" };
}
