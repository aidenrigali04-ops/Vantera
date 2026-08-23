import { recordSecurityEvent, type SecuritySeverity } from "@/lib/security/audit";

/**
 * Backend-only funnel diagnostics for signup + onboarding. Owner-facing observability, NEVER
 * user-facing: it writes a row to the existing service-role-only audit sink (security_events,
 * 0027) so we can see WHERE a signup/onboarding attempt failed or stalled — the drop-offs that
 * were previously invisible (console.error only, no persisted trail).
 *
 * Purely additive: it changes no return value, redirect, validation, or UI, and — like
 * recordSecurityEvent — it never throws into the caller's path, so a logging hiccup can never
 * break or alter the flow it's observing.
 *
 * Read the trail (service role, e.g. the Supabase dashboard / SQL editor):
 *   select created_at, event_type, actor_user_id, account_id, metadata
 *   from security_events where event_type like 'funnel.%' order by created_at desc;
 *
 * NEVER pass secrets, tokens, passwords, or raw request bodies in `error`/`extra`.
 */
export interface FunnelContext {
  userId?: string | null;
  accountId?: string | null;
  /** Included only for pre-account stages (signup / step 0) where there's no account yet. */
  email?: string | null;
  /** An error message or Error — truncated; message only, never the object/stack. */
  error?: unknown;
  /** Small identifiers/flags only (e.g. { hasWebsite: true, reason: "plan limit" }). */
  extra?: Record<string, unknown>;
  /** Defaults to "warn" for failures; pass "info" for non-error breadcrumbs. */
  severity?: SecuritySeverity;
}

const MAX_ERR = 300;

/** Message-only, truncated — never leaks a stack or a non-serializable object. */
function errorText(e: unknown): string | undefined {
  if (e === undefined || e === null) return undefined;
  const raw = typeof e === "string" ? e : e instanceof Error ? e.message : safeString(e);
  return raw.length > MAX_ERR ? `${raw.slice(0, MAX_ERR)}…` : raw;
}

function safeString(e: unknown): string {
  try {
    return String(e);
  } catch {
    return "unstringifiable error";
  }
}

/**
 * Record one funnel breadcrumb. `event` is the sub-type after the "funnel." namespace, e.g.
 * "onboarding.connect_link_failed" → event_type "funnel.onboarding.connect_link_failed".
 * The `record` param is injectable so the shaping is unit-testable without a DB.
 */
export async function recordFunnelEvent(
  event: string,
  ctx: FunnelContext = {},
  record: typeof recordSecurityEvent = recordSecurityEvent
): Promise<void> {
  const error = errorText(ctx.error);
  try {
    await record({
      eventType: `funnel.${event}`,
      severity: ctx.severity ?? "warn",
      accountId: ctx.accountId ?? null,
      actorUserId: ctx.userId ?? null,
      metadata: {
        ...(ctx.email ? { email: ctx.email } : {}),
        ...(error !== undefined ? { error } : {}),
        ...(ctx.extra ?? {}),
      },
    });
  } catch {
    // Contract: observability can never break or alter the flow it watches. recordSecurityEvent
    // already swallows its own errors; this guards an injected/overridden recorder too.
  }
}
