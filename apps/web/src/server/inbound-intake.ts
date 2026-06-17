import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Inbound intake — the Responder agent's front door (Phase 12, rule 13 piece 2). Distinct from
 * the reply-classification handler (inbound-webhooks.ts): this accepts inbound LEAD events from
 * the customer's own form / site / signal source, verifies a per-agent HMAC signature, dedupes
 * via webhook_events, and enqueues the responder pipeline. Speed is the product, so the handler
 * does only auth + dedup + enqueue; qualification and drafting happen in the background task.
 */

export type InboundSource = "form_fill" | "website_visitor" | "signal";
const SOURCES: ReadonlySet<string> = new Set(["form_fill", "website_visitor", "signal"]);

export interface NormalizedInboundLead {
  source: InboundSource;
  email: string | null;
  firstName: string | null;
  companyName: string | null;
}

/** Sign a raw body the way an inbound source must: `sha256=<hex hmac>`. */
export function signIntake(rawBody: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
}

/** Timing-safe HMAC-SHA256 verification of the `sha256=<hex>` signature header. */
export function verifyIntakeSignature(
  rawBody: string,
  secret: string,
  signatureHeader: string | null | undefined
): boolean {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;
  const provided = signatureHeader.slice("sha256=".length);
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  if (provided.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(provided, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** Normalize a flexible inbound payload into our lead shape. Tolerant of common form schemas. */
export function parseInboundLead(payload: unknown): NormalizedInboundLead {
  const p = (payload ?? {}) as Record<string, unknown>;
  const fields = (p.fields ?? {}) as Record<string, unknown>;
  const pick = (...keys: string[]): string | null => {
    for (const k of keys) {
      const v = str(p[k]) ?? str(fields[k]);
      if (v) return v;
    }
    return null;
  };

  const rawSource = str(p.source);
  const source: InboundSource = rawSource && SOURCES.has(rawSource) ? (rawSource as InboundSource) : "form_fill";

  const email = pick("email", "emailAddress", "email_address")?.toLowerCase() ?? null;
  let firstName = pick("firstName", "first_name", "fname");
  if (!firstName) {
    const fullName = pick("name", "fullName", "full_name");
    if (fullName) firstName = fullName.split(/\s+/)[0] ?? null;
  }
  const companyName = pick("company", "companyName", "company_name", "organization");

  return { source, email, firstName, companyName };
}

export interface ResolvedIntake {
  accountId: string;
  agentId: string;
  secret: string;
}

export interface IntakeEnqueuePayload {
  source: "inbound";
  payload: {
    accountId: string;
    agentId: string;
    source: InboundSource;
    email: string | null;
    firstName: string | null;
    companyName: string | null;
    raw: unknown;
  };
}

export interface InboundIntakeDeps {
  /** intakeId → tenant + agent + decrypted signing secret; null if the intake id is unknown */
  resolveIntake: (intakeId: string) => Promise<ResolvedIntake | null>;
  /** insert into webhook_events (source 'inbound'); false = duplicate provider_event_id */
  recordEvent: (providerEventId: string, payload: unknown) => Promise<boolean>;
  enqueue: (payload: IntakeEnqueuePayload) => Promise<void>;
  /** invoked when signature verification fails (security auditing); best-effort */
  onUnverified?: () => Promise<void> | void;
}

export async function handleInboundIntake(
  intakeId: string,
  headers: Record<string, string>,
  rawBody: string,
  deps: InboundIntakeDeps
): Promise<{ status: number; body: string }> {
  const resolved = await deps.resolveIntake(intakeId);
  if (!resolved) return { status: 404, body: "unknown intake" };

  const signature = headers["x-vantera-signature"];
  if (!verifyIntakeSignature(rawBody, resolved.secret, signature)) {
    if (deps.onUnverified) await deps.onUnverified();
    return { status: 401, body: "invalid signature" };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return { status: 400, body: "invalid json" };
  }

  // Idempotency: prefer a provider-supplied event id; otherwise a body hash so identical
  // retries collapse to one processing.
  const p = (payload ?? {}) as Record<string, unknown>;
  const providerEventId =
    str(p.event_id) ?? str(p.id) ?? createHash("sha256").update(rawBody).digest("hex");

  if (!(await deps.recordEvent(providerEventId, payload))) {
    return { status: 200, body: "duplicate" };
  }

  const normalized = parseInboundLead(payload);
  await deps.enqueue({
    source: "inbound",
    payload: {
      accountId: resolved.accountId,
      agentId: resolved.agentId,
      source: normalized.source,
      email: normalized.email,
      firstName: normalized.firstName,
      companyName: normalized.companyName,
      raw: payload,
    },
  });

  return { status: 200, body: "ok" };
}
