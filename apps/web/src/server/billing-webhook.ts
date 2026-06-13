import {
  isActive,
  snapshotFromEvent,
  type BillingProvider,
  type PersistedSnapshot,
} from "@vantera/billing";

export interface BillingWebhookDeps {
  provider: BillingProvider;
  /** Insert into webhook_events; return false if it's a duplicate (PG 23505). */
  recordEvent: (providerEventId: string, payload: unknown) => Promise<boolean>;
  /** Persist the snapshot to the matching account (by stripe_customer_id). */
  applySnapshot: (snapshot: PersistedSnapshot & { outreachPaused: boolean }) => Promise<void>;
}

export interface WebhookResponse {
  status: number;
  body: string;
}

export async function handleStripeWebhook(
  rawBody: string,
  signature: string,
  deps: BillingWebhookDeps
): Promise<WebhookResponse> {
  let rawEvent: unknown;
  try {
    rawEvent = deps.provider.verifyWebhook(rawBody, signature);
  } catch {
    return { status: 401, body: "invalid signature" };
  }

  const eventId = deps.provider.webhookEventId(rawEvent);
  if (!eventId) return { status: 400, body: "missing event id" };

  const isNew = await deps.recordEvent(eventId, rawEvent);
  if (!isNew) return { status: 200, body: "duplicate" };

  const parsed = deps.provider.parseWebhook(rawEvent);
  const snapshot = snapshotFromEvent(parsed);
  if (!snapshot) return { status: 200, body: "ignored" };

  // lapse → pause; reactivation → unpause. Existing data is untouched.
  await deps.applySnapshot({
    ...snapshot,
    outreachPaused: !isActive(snapshot.subscriptionStatus),
  });
  return { status: 200, body: "ok" };
}
