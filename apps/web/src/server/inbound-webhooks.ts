export interface WebhookHandlerDeps {
  verify: (headers: Record<string, string>, rawBody: string) => boolean;
  /** providerEventId via the infra adapter's parseEventWebhook; null = not an event we know */
  extractEventId: (payload: unknown) => string | null;
  /** insert into webhook_events; false = duplicate provider_event_id */
  recordEvent: (source: "linkedin", providerEventId: string, payload: unknown) => Promise<boolean>;
  enqueue: (payload: { source: "linkedin"; payload: unknown }) => Promise<void>;
  /** Optional: invoked when signature verification fails (security auditing). Best-effort. */
  onUnverified?: () => Promise<void> | void;
  /**
   * Optional: invoked when a VERIFIED webhook can't be parsed into an event we know.
   *
   * This is the quiet failure mode that hides shape drift: the provider is delivering
   * correctly, the signature is good, and we answer 200 while dropping the event on the
   * floor. Left unobserved it looks identical to "the provider never sent anything".
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
  if (!(await deps.recordEvent(source, eventId, payload))) return { status: 200, body: "duplicate" };
  await deps.enqueue({ source, payload });
  return { status: 200, body: "ok" };
}
