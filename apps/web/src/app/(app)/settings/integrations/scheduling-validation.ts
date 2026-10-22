import { isMeetingProvider, type MeetingProvider } from "@vantera/meetings-infra";

export const SCHEDULING_TOOLS: { provider: MeetingProvider; label: string; howTo: string }[] = [
  {
    provider: "calendly",
    label: "Calendly",
    howTo:
      "In Calendly: Integrations → API & Webhooks → create a personal access token with the users:read, webhooks:write and scheduled_events:read scopes. Needs a paid Calendly plan (Standard or higher).",
  },
  {
    provider: "calcom",
    label: "Cal.com",
    howTo: "In Cal.com: Settings → Security → API keys → create a key.",
  },
];

type Result<T> = { ok: true; values: T } | { ok: false; error: string };

export function parseSchedulingForm(form: FormData): Result<{ provider: MeetingProvider; apiKey: string }> {
  const provider = String(form.get("provider") ?? "");
  if (!isMeetingProvider(provider)) return { ok: false, error: "Pick a scheduling tool." };
  const apiKey = String(form.get("apiKey") ?? "").trim();
  if (apiKey.length < 10 || apiKey.length > 4000) return { ok: false, error: "Paste the full API key." };
  return { ok: true, values: { provider, apiKey } };
}

/** User-facing message for an adapter failure reason. */
export function schedulingError(provider: MeetingProvider, reason: "invalid" | "plan" | "scope" | "unavailable"): string {
  const label = SCHEDULING_TOOLS.find((t) => t.provider === provider)!.label;
  switch (reason) {
    case "invalid":
      return `${label} didn't accept that key — check you copied all of it.`;
    case "plan":
      return "Booking notifications need a paid Calendly plan (Standard or higher).";
    case "scope":
      return "That token is missing a permission — create one with users:read, webhooks:write and scheduled_events:read.";
    default:
      return `Couldn't reach ${label} right now. Try again in a minute.`;
  }
}
