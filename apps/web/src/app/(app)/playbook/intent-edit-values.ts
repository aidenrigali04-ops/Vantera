import type { IntentFormValues } from "./validation";

/** The saved intent agent row, as the edit page reads it (config is untyped jsonb). */
export type IntentAgentRow = {
  name: string;
  config: unknown;
  run_at_time: string | null;
  cadence: "daily" | "weekly" | "intraday" | null;
  timezone: string | null;
};

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

const record = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/**
 * Saved agent → the wizard's edit values. A missing signal key means ON, matching the scanner's
 * INTENT_DEFAULTS (onboarding-created agents carry no `follows` key) — only an explicit false is off.
 */
export function intentEditValues(agent: IntentAgentRow): IntentFormValues {
  const config = record(agent.config);
  const watch = record(config.watch);
  const signals = record(config.signals);
  return {
    name: agent.name,
    watch: {
      creators: strings(watch.creators),
      competitors: strings(watch.competitors),
      keywords: strings(watch.keywords),
      hashtags: strings(watch.hashtags),
    },
    signals: {
      engagement: signals.engagement !== false,
      content: signals.content !== false,
      follows: signals.follows !== false,
    },
    // Postgres returns time as HH:MM:SS — the picker + validation expect HH:MM
    runAtTime: (agent.run_at_time ?? "08:00").slice(0, 5),
    cadence: agent.cadence ?? "daily",
    timezone: agent.timezone ?? "UTC",
  };
}
