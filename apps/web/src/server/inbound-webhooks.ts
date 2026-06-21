export interface WebhookHandlerDeps {
  verify: (headers: Record<string, string>, rawBody: string) => boolean;
  /** providerEventId via the infra adapter's parseEventWebhook; null = not an event we know */
  extractEventId: (payload: unknown) => string | null;
  /** insert into webhook_events; false = duplicate provider_event_id */
  recordEvent: (source: "linkedin", providerEventId: string, payload: unknown) => Promise<boolean>;
  enqueue: (payload: { source: "linkedin"; payload: unknown }) => Promise<void>;
  /** Optional: invoked when signature verification fails (security auditing). Best-effort. */
  onUnverified?: () => Promise<void> | void;
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
  if (!eventId) return { status: 200, body: "ignored" };
  if (!(await deps.recordEvent(source, eventId, payload))) return { status: 200, body: "duplicate" };
  await deps.enqueue({ source, payload });
  return { status: 200, body: "ok" };
}
