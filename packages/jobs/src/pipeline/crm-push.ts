import type { ClosedDeal, ConnectorCtx, CrmConnector, CrmProvider } from "@vantera/crm-infra";

// Pure push-execution core (rule 13): deps injected via the interfaces below; the only
// real implementation (drizzle) lives in pg-store. No Trigger.dev / DB imports here.
// A won-customer push is NOT an outreach send — no suppression gate (rule 11, by design).

export interface CrmPushEventRow {
  id: string;
  accountId: string;
  connectionId: string | null;
  leadId: string | null;
  status: "pending" | "success" | "failed";
  attempts: number;
  payload: ClosedDeal | null;
}

export interface CrmConnectionRow {
  id: string;
  provider: CrmProvider;
  status: string;
  accessTokenEnc: string | null;
  refreshTokenEnc: string | null;
  tokenExpiresAt: string | null;
  externalAccountRef: string | null;
  config: { target?: Record<string, string>; mapping?: Record<string, string> } | null;
}

export interface CrmPushStore {
  loadEvent(id: string): Promise<CrmPushEventRow | null>;
  loadConnection(id: string): Promise<CrmConnectionRow | null>;
  saveRefreshedTokens(
    connectionId: string,
    t: { accessTokenEnc: string; refreshTokenEnc: string | null; tokenExpiresAt: string | null }
  ): Promise<void>;
  markSuccess(
    eventId: string,
    externalRef: string | undefined,
    connectionId: string | null,
    at: string
  ): Promise<void>;
  markFailure(args: {
    eventId: string;
    error: string;
    attempts: number;
    nextRetryAt: string | null;
    connectionId: string | null;
    connectionError?: string;
  }): Promise<void>;
  dueEventIds(now: Date, limit: number): Promise<string[]>;
}

export interface CrmPushDeps {
  store: CrmPushStore;
  getConnector: (provider: CrmProvider) => CrmConnector;
  decrypt: (enc: string) => string;
  encrypt: (plain: string) => string;
  now?: () => Date;
  maxAttempts?: number;
}

const DEFAULT_MAX_ATTEMPTS = 6;

// Exponential backoff: 1m, 2m, 4m, … capped at 1h.
function backoffMs(attempts: number): number {
  return Math.min(60_000 * 2 ** (attempts - 1), 3_600_000);
}

export type CrmPushOutcome =
  | { status: "success"; externalRef?: string }
  | { status: "retry"; nextRetryAt: string }
  | { status: "failed"; error: string }
  | { status: "skipped"; reason: string };

export async function runCrmPush(eventId: string, deps: CrmPushDeps): Promise<CrmPushOutcome> {
  const now = deps.now?.() ?? new Date();
  const maxAttempts = deps.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;

  const event = await deps.store.loadEvent(eventId);
  if (!event || event.status === "success") return { status: "skipped", reason: "no-op" };

  if (!event.connectionId || !event.payload) {
    await deps.store.markFailure({
      eventId,
      error: "Connection or payload missing.",
      attempts: event.attempts + 1,
      nextRetryAt: null,
      connectionId: event.connectionId,
    });
    return { status: "failed", error: "missing-connection-or-payload" };
  }

  const conn = await deps.store.loadConnection(event.connectionId);
  if (!conn || conn.status === "disconnected" || !conn.accessTokenEnc) {
    await deps.store.markFailure({
      eventId,
      error: "Destination disconnected — reconnect to resume.",
      attempts: event.attempts + 1,
      nextRetryAt: null,
      connectionId: event.connectionId,
      connectionError: "Disconnected — reconnect to resume CRM push.",
    });
    return { status: "failed", error: "disconnected" };
  }

  const connector = deps.getConnector(conn.provider);
  let accessToken = deps.decrypt(conn.accessTokenEnc);

  // Refresh an expired token inline; persist the new (encrypted) set.
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
      return fail(deps, {
        eventId,
        connId: conn.id,
        attempts: event.attempts + 1,
        maxAttempts,
        now,
        error: "Token refresh failed.",
        terminalConnError: "Authorization expired — reconnect.",
        retryable: true,
      });
    }
  }

  const config = { target: conn.config?.target, mapping: conn.config?.mapping };
  const ctx: ConnectorCtx = { accessToken, externalAccountRef: conn.externalAccountRef, config };
  const result = await connector.pushClosedDeal(ctx, { ...event.payload, config });

  if (result.ok) {
    await deps.store.markSuccess(eventId, result.data.externalRef, conn.id, now.toISOString());
    return { status: "success", externalRef: result.data.externalRef };
  }

  return fail(deps, {
    eventId,
    connId: conn.id,
    attempts: event.attempts + 1,
    maxAttempts,
    now,
    error: result.error,
    terminalConnError: result.error,
    retryable: result.retryable,
  });
}

async function fail(
  deps: CrmPushDeps,
  args: {
    eventId: string;
    connId: string;
    attempts: number;
    maxAttempts: number;
    now: Date;
    error: string;
    terminalConnError: string;
    retryable: boolean;
  }
): Promise<CrmPushOutcome> {
  const retry = args.retryable && args.attempts < args.maxAttempts;
  const nextRetryAt = retry
    ? new Date(args.now.getTime() + backoffMs(args.attempts)).toISOString()
    : null;
  await deps.store.markFailure({
    eventId: args.eventId,
    error: args.error,
    attempts: args.attempts,
    nextRetryAt,
    connectionId: args.connId,
    connectionError: retry ? undefined : args.terminalConnError,
  });
  return retry
    ? { status: "retry", nextRetryAt: nextRetryAt! }
    : { status: "failed", error: args.error };
}
