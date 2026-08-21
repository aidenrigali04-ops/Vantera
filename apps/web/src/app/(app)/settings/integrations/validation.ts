import type { Valid, Invalid } from "@/lib/validation";
import { getConnectorMeta, isCrmProvider, type CrmProvider } from "@vantera/crm-infra";

export interface ConnectionConfig {
  autoPush: boolean;
  target: Record<string, string>;
  mapping: Record<string, string>;
}

/** A destination is connectable only if the registry knows it. */
export function validateProvider(input: unknown): Valid<CrmProvider> | Invalid {
  const provider = String(input ?? "").trim();
  if (!isCrmProvider(provider)) {
    return { ok: false, error: "That destination isn't supported." };
  }
  return { ok: true, values: provider };
}

/**
 * Validates the post-connect config a user saves: required targets present, target/mapping
 * keys belong to this provider (defends direct POSTs + stale tabs). Unknown keys are dropped
 * rather than rejected so a registry change never bricks a saved connection.
 */
export function validateConnectionConfig(
  provider: string,
  input: { autoPush?: unknown; target?: Record<string, unknown>; mapping?: Record<string, unknown> }
): Valid<ConnectionConfig> | Invalid {
  const meta = getConnectorMeta(provider);
  if (!meta) return { ok: false, error: "That destination isn't supported." };

  const target: Record<string, string> = {};
  for (const field of meta.targets) {
    const raw = String(input.target?.[field.key] ?? "").trim();
    if (field.required && !raw) {
      return { ok: false, error: `${field.label} is required for ${meta.label}.` };
    }
    if (raw) target[field.key] = raw;
  }

  const allowedSources = new Set(meta.fields.map((f) => f.source));
  const mapping: Record<string, string> = {};
  for (const [source, rawTarget] of Object.entries(input.mapping ?? {})) {
    if (!allowedSources.has(source)) continue; // drop unknown keys
    const locked = meta.fields.find((f) => f.source === source)?.locked;
    // locked fields always keep their default — ignore any client override
    const value = locked ? meta.defaultMapping[source] : String(rawTarget ?? "").trim();
    if (value) mapping[source] = value;
  }

  return {
    ok: true,
    values: { autoPush: input.autoPush === true || input.autoPush === "true", target, mapping },
  };
}

export interface ActivityConfig {
  enabled: boolean;
  events: { outreach: boolean; replies: boolean; meetings: boolean };
  watermark?: string;
}

/**
 * The next config.activity for a connection. The watermark is the no-history-dump guarantee:
 * a FRESH enable stamps it at now (sync starts from this moment); staying enabled keeps the
 * existing watermark; disabling drops it so a later re-enable starts fresh again — the gap
 * is never back-filled into the customer's CRM.
 */
export function nextActivityConfig(
  prev: Partial<ActivityConfig> | undefined,
  input: { enabled: boolean; outreach: boolean; replies: boolean; meetings: boolean },
  now: Date = new Date()
): ActivityConfig {
  const config: ActivityConfig = {
    enabled: input.enabled,
    events: { outreach: input.outreach, replies: input.replies, meetings: input.meetings },
  };
  if (input.enabled) {
    config.watermark = prev?.enabled ? prev.watermark : now.toISOString();
  }
  return config;
}
