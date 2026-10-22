import { createCalcomInfra } from "./calcom";
import { createCalendlyInfra } from "./calendly";
import type { FetchLike, MeetingProvider, MeetingsInfra } from "./types";

export * from "./types";
export { leadTag, parseLeadTag, tagBookingUrl, tagLinksInText, TAG_QUERY_KEYS } from "./tag";

/** The adapter for a provider. Vendor names never leave this package (white-label). */
export function getMeetingsInfra(provider: MeetingProvider, fetchFn?: FetchLike): MeetingsInfra {
  return provider === "calendly" ? createCalendlyInfra(fetchFn) : createCalcomInfra(fetchFn);
}

export function isMeetingProvider(value: string): value is MeetingProvider {
  return value === "calendly" || value === "calcom";
}
