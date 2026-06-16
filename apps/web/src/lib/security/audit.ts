import { createServiceClient } from "@/lib/supabase/service";
import { clientIp } from "@/lib/rate-limit";

export type SecuritySeverity = "info" | "warn" | "critical";

export interface SecurityEventInput {
  eventType: string;
  severity?: SecuritySeverity;
  accountId?: string | null;
  actorUserId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  /** Identifiers and small context only — NEVER secrets, tokens, or raw request bodies. */
  metadata?: Record<string, unknown>;
}

/**
 * Append a security-relevant event to the audit log (security_events, 0027). Best-effort:
 * it never throws into the caller's path — a logging failure must not break or block the
 * request it's observing. Writes go through the service client (the table is service-role
 * write-only). NEVER put secrets/tokens/bodies in metadata.
 */
export async function recordSecurityEvent(e: SecurityEventInput): Promise<void> {
  try {
    const db = createServiceClient();
    const { error } = await db.from("security_events").insert({
      account_id: e.accountId ?? null,
      actor_user_id: e.actorUserId ?? null,
      event_type: e.eventType,
      severity: e.severity ?? "info",
      ip: e.ip ?? null,
      user_agent: e.userAgent ?? null,
      metadata: e.metadata ?? {},
    });
    if (error) console.error("recordSecurityEvent insert failed", { eventType: e.eventType, code: error.code });
  } catch (err) {
    console.error("recordSecurityEvent threw", { eventType: e.eventType, err });
  }
}

/** Pull ip + user-agent from a request for event context (carries no secrets). */
export function eventRequestMeta(req: Request): { ip: string; userAgent: string } {
  return { ip: clientIp(req), userAgent: req.headers.get("user-agent") ?? "unknown" };
}
