/**
 * The per-lead tag we append to the seller's booking link, so a booking made from it attributes
 * to the exact lead (LinkedIn leads often have no email to match on). The id itself is not a
 * secret — attribution is always re-checked against the connection's account before it counts.
 */
const TAG_PREFIX = "vt-";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function leadTag(leadId: string): string {
  return `${TAG_PREFIX}${leadId}`;
}

export function parseLeadTag(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith(TAG_PREFIX)) return null;
  const id = value.slice(TAG_PREFIX.length);
  return UUID.test(id) ? id.toLowerCase() : null;
}

/** Query keys each scheduling tool echoes back in its booking webhook (verified 2026-10-21):
 *  Calendly returns utm_* in payload.tracking; Cal.com returns metadata[...] in payload.metadata
 *  (it does NOT echo utm_*). Each tool ignores the other's key, so the link carries both. */
export const TAG_QUERY_KEYS = { utm: "utm_content", metadata: "metadata[vt]" } as const;

/** The seller's booking link with this lead's tag — what the conversation brain offers. */
export function tagBookingUrl(url: string, leadId: string): string {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return url;
  }
  u.searchParams.set(TAG_QUERY_KEYS.utm, leadTag(leadId));
  u.searchParams.set(TAG_QUERY_KEYS.metadata, leadTag(leadId));
  return u.toString();
}

/**
 * Tag the seller's booking link wherever it appears in a drafted message. The brain is given the
 * clean link (asking it to reproduce a long tagged URL invites a mangled id); we tag the final
 * text deterministically. A link that already carries query params is left as written.
 */
export function tagLinksInText(text: string, bookingUrl: string | null | undefined, leadId: string): string {
  if (!bookingUrl) return text;
  const escaped = bookingUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // the exact link, not followed by more URL characters (so an already-tagged ?… link is skipped)
  return text.replace(new RegExp(`${escaped}(?![\\w/?=&%#-])`, "g"), () => tagBookingUrl(bookingUrl, leadId));
}
