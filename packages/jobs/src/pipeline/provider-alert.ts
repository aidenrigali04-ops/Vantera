// Provider billing/auth alerting (spec §11). On 2026-10-23 the AI account ran out of credits:
// every process-inbound run failed for three days and nobody was told. Pure — no Trigger, no DB.

export type ProviderErrorKind = "billing" | "auth";

const BILLING = /credit balance|insufficient (credits|funds|quota)|billing/i;
const AUTH = /invalid x-api-key|authentication|unauthorized|\b401\b/i;
export const PROVIDER_ALERT_COOLDOWN_MS = 24 * 60 * 60_000;

function messages(err: unknown, depth = 0): string[] {
  if (err == null || depth > 4) return [];
  if (typeof err === "string") return [err];
  if (typeof err === "object") {
    const e = err as { message?: unknown; cause?: unknown };
    return [...(typeof e.message === "string" ? [e.message] : []), ...messages(e.cause, depth + 1)];
  }
  return [];
}

export function classifyProviderError(err: unknown): ProviderErrorKind | null {
  const text = messages(err).join("\n");
  if (BILLING.test(text)) return "billing";
  if (AUTH.test(text)) return "auth";
  return null;
}

export interface ProviderAlertDeps {
  store: {
    getSetting(key: string): Promise<unknown>;
    setSetting(key: string, value: unknown): Promise<void>;
  };
  send: (alert: { subject: string; body: string }) => Promise<void>;
  now: () => Date;
  /** the platform admin recipient; null/empty = none configured (alert is logged, not sent) */
  recipient: string | null;
}

const COPY: Record<ProviderErrorKind, { subject: string; body: string }> = {
  billing: {
    subject: "Action needed: AI provider credits exhausted",
    body: "Background AI runs are failing because the AI provider account is out of credits. Add credits in the AI provider console. Inbound replies and drafts are retrying and will resume once billing is restored.",
  },
  auth: {
    subject: "Action needed: AI provider API key rejected",
    body: "Background AI runs are failing because the AI provider rejected the API key. Rotate the AI API key in Trigger.dev + Vercel. Inbound replies and drafts are retrying and will resume once the key is valid.",
  },
};

/** Sends at most one alert per kind per 24 h. Returns true when an alert was sent. */
export async function alertOnce(kind: ProviderErrorKind, deps: ProviderAlertDeps): Promise<boolean> {
  if (!deps.recipient) {
    console.error("provider alert: no admin recipient configured", { kind });
    return false;
  }
  const key = `provider_alert:${kind}`;
  const now = deps.now();
  const last = await deps.store.getSetting(key);
  const lastMs = typeof last === "string" ? Date.parse(last) : NaN;
  if (Number.isFinite(lastMs) && now.getTime() - lastMs < PROVIDER_ALERT_COOLDOWN_MS) return false;
  await deps.send(COPY[kind]);
  await deps.store.setSetting(key, now.toISOString());
  return true;
}

/** Runs `fn`; on a billing/auth provider error, alerts (best-effort) then re-throws unchanged. */
export async function withProviderAlert<T>(fn: () => Promise<T>, deps: ProviderAlertDeps): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const kind = classifyProviderError(err);
    if (kind) {
      try {
        await alertOnce(kind, deps);
      } catch {
        // alerting must never mask the real failure
      }
    }
    throw err;
  }
}
