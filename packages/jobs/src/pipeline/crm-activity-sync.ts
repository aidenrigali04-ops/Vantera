import type { ConnectorCtx, CrmConnector, CrmProvider } from "@vantera/crm-infra";

// Pure activity-sync core (rule 13): logs LinkedIn touches as timeline notes on the
// customer's CRM contact, for connections that OPTED IN (config.activity.enabled). The
// contact is created at the first synced touch — before close, which the account chose;
// the default path stays closed-won-only (rule 01). Deps injected via the interfaces
// below; the drizzle implementation lives in pg-store. No Trigger.dev / DB imports here.
//
// Activity sync only READS outreach history — it never sends anything to a prospect, so
// rule 11's suppression gate does not apply (intentionally absent, same as crm-push).

export interface ActivityConnectionRow {
  id: string;
  accountId: string;
  provider: CrmProvider;
  status: string;
  accessTokenEnc: string | null;
  refreshTokenEnc: string | null;
  tokenExpiresAt: string | null;
  externalAccountRef: string | null;
  config: {
    target?: Record<string, string>;
    mapping?: Record<string, string>;
    activity?: {
      enabled?: boolean;
      events?: { outreach?: boolean; replies?: boolean; meetings?: boolean };
      watermark?: string;
    };
  } | null;
}

export interface LeadActivityEvent {
  leadId: string;
  kind: "outreach" | "reply" | "meeting";
  occurredAt: string; // ISO
  /** reply body excerpt, when kind === "reply" */
  excerpt?: string | null;
  lead: {
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    title?: string | null;
    company?: string | null;
    linkedinUrl?: string | null;
  };
}

export interface CrmActivityStore {
  /** active connections with config.activity.enabled — provider-agnostic rows */
  listActivityConnections(): Promise<ActivityConnectionRow[]>;
  /** account events strictly after sinceIso, ordered occurredAt asc, capped at limit */
  eventsSince(accountId: string, sinceIso: string, limit: number): Promise<LeadActivityEvent[]>;
  getContactRef(connectionId: string, leadId: string): Promise<string | null>;
  saveContactRef(args: {
    accountId: string;
    connectionId: string;
    leadId: string;
    externalRef: string;
  }): Promise<void>;
  saveWatermark(connectionId: string, iso: string): Promise<void>;
  saveRefreshedTokens(
    connectionId: string,
    t: { accessTokenEnc: string; refreshTokenEnc: string | null; tokenExpiresAt: string | null }
  ): Promise<void>;
  markConnectionError(connectionId: string, error: string): Promise<void>;
}

export interface CrmActivitySyncDeps {
  store: CrmActivityStore;
  getConnector: (provider: CrmProvider) => CrmConnector;
  decrypt: (enc: string) => string;
  encrypt: (plain: string) => string;
  now?: () => Date;
  /** max events per connection per tick (bounded work; the cron catches up next tick) */
  batchLimit?: number;
}

const DEFAULT_BATCH_LIMIT = 50;
const EXCERPT_MAX = 300;

function leadDisplayName(lead: LeadActivityEvent["lead"]): string {
  return (
    [lead.firstName, lead.lastName].filter(Boolean).join(" ") || lead.company || "this prospect"
  );
}

/** One human line per touch — what the customer reads on their CRM timeline. */
export function renderActivityNote(e: LeadActivityEvent): string {
  const name = leadDisplayName(e.lead);
  switch (e.kind) {
    case "outreach":
      return `LinkedIn outreach sent to ${name} — via Vantera`;
    case "reply": {
      const excerpt = (e.excerpt ?? "").trim();
      const clamped = excerpt.length > EXCERPT_MAX ? `${excerpt.slice(0, EXCERPT_MAX)}…` : excerpt;
      return clamped
        ? `LinkedIn reply from ${name} — “${clamped}” — via Vantera`
        : `LinkedIn reply from ${name} — via Vantera`;
    }
    case "meeting":
      return `Meeting booked with ${name} — via Vantera`;
  }
}

export interface CrmActivitySyncOutcome {
  connections: number;
  logged: number;
  errors: number;
}

export async function runCrmActivitySync(
  deps: CrmActivitySyncDeps
): Promise<CrmActivitySyncOutcome> {
  const now = deps.now?.() ?? new Date();
  const batchLimit = deps.batchLimit ?? DEFAULT_BATCH_LIMIT;
  const outcome: CrmActivitySyncOutcome = { connections: 0, logged: 0, errors: 0 };

  for (const conn of await deps.store.listActivityConnections()) {
    const activity = conn.config?.activity;
    if (!activity?.enabled || conn.status !== "active" || !conn.accessTokenEnc) continue;

    const connector = deps.getConnector(conn.provider);
    // Registry-driven support: only destinations that declare activity sync take part.
    if (!connector.meta.supportsActivitySync || !connector.ensureContact || !connector.logActivity)
      continue;

    outcome.connections++;

    // First tick after enabling: stamp the watermark at now and sync nothing — the
    // customer's CRM never gets months of history dumped onto it.
    if (!activity.watermark) {
      await deps.store.saveWatermark(conn.id, now.toISOString());
      continue;
    }

    // Refresh an expired token inline (same contract as crm-push); persist the new set.
    let accessToken = deps.decrypt(conn.accessTokenEnc);
    const expired =
      conn.tokenExpiresAt != null && new Date(conn.tokenExpiresAt).getTime() <= now.getTime();
    if (expired && conn.refreshTokenEnc) {
      try {
        const refreshed = await connector.refreshToken(deps.decrypt(conn.refreshTokenEnc));
        accessToken = refreshed.accessToken;
        await deps.store.saveRefreshedTokens(conn.id, {
          accessTokenEnc: deps.encrypt(refreshed.accessToken),
          refreshTokenEnc: refreshed.refreshToken
            ? deps.encrypt(refreshed.refreshToken)
            : conn.refreshTokenEnc,
          tokenExpiresAt: refreshed.expiresAt ?? null,
        });
      } catch {
        await deps.store.markConnectionError(conn.id, "Authorization expired — reconnect.");
        outcome.errors++;
        continue;
      }
    }

    const ctx: ConnectorCtx = {
      accessToken,
      externalAccountRef: conn.externalAccountRef,
      config: { target: conn.config?.target, mapping: conn.config?.mapping },
    };
    const toggles = activity.events ?? {};
    const kindEnabled = (kind: LeadActivityEvent["kind"]): boolean =>
      kind === "outreach"
        ? toggles.outreach !== false
        : kind === "reply"
          ? toggles.replies !== false
          : toggles.meetings !== false;

    const events = await deps.store.eventsSince(conn.accountId, activity.watermark, batchLimit);
    let watermark = activity.watermark;

    // Chronological, stop-at-first-failure: the watermark only moves past events that
    // synced (or were toggled off), so a transient failure re-attempts next tick.
    for (const event of events) {
      if (!kindEnabled(event.kind)) {
        watermark = event.occurredAt;
        continue;
      }

      let contactId = await deps.store.getContactRef(conn.id, event.leadId);
      if (!contactId) {
        const ensured = await connector.ensureContact(ctx, {
          firstName: event.lead.firstName ?? undefined,
          lastName: event.lead.lastName ?? undefined,
          email: event.lead.email ?? undefined,
          title: event.lead.title ?? undefined,
          company: event.lead.company ?? undefined,
          linkedinUrl: event.lead.linkedinUrl ?? undefined,
        });
        if (!ensured.ok) {
          await deps.store.markConnectionError(conn.id, ensured.error);
          outcome.errors++;
          break;
        }
        contactId = ensured.data.contactId;
        await deps.store.saveContactRef({
          accountId: conn.accountId,
          connectionId: conn.id,
          leadId: event.leadId,
          externalRef: contactId,
        });
      }

      const logged = await connector.logActivity(ctx, {
        contactId,
        body: renderActivityNote(event),
        occurredAt: event.occurredAt,
      });
      if (!logged.ok) {
        await deps.store.markConnectionError(conn.id, logged.error);
        outcome.errors++;
        break;
      }
      watermark = event.occurredAt;
      outcome.logged++;
    }

    if (watermark !== activity.watermark) {
      await deps.store.saveWatermark(conn.id, watermark);
    }
  }

  return outcome;
}
