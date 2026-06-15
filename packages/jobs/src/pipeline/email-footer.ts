/** rule 11: every cold email carries an unsubscribe link + the customer's physical address. */

export interface SenderAddress {
  line1: string;
  line2?: string | null;
  city: string;
  region?: string | null;
  postal: string;
  country: string;
}

export function parseSenderAddress(value: unknown): SenderAddress | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  if (
    typeof v.line1 !== "string" || typeof v.city !== "string" ||
    typeof v.postal !== "string" || typeof v.country !== "string"
  ) {
    return null;
  }
  return {
    line1: v.line1,
    line2: typeof v.line2 === "string" ? v.line2 : null,
    city: v.city,
    region: typeof v.region === "string" ? v.region : null,
    postal: v.postal,
    country: v.country,
  };
}

export function formatSenderAddress(a: SenderAddress): string {
  // postal-style segment: "Austin, TX 78701" (or "Austin 78701" without a region)
  const cityLine = [[a.city, a.region].filter(Boolean).join(", "), a.postal].filter(Boolean).join(" ");
  return [a.line1, a.line2, cityLine, a.country].filter(Boolean).join(", ");
}

const UNSUBSCRIBE_LABEL = "Don't want these emails? Unsubscribe:";

export function appendComplianceFooter(body: string, unsubscribeUrl: string, address: SenderAddress): string {
  return `${body}\n\n--\n${formatSenderAddress(address)}\n${UNSUBSCRIBE_LABEL} ${unsubscribeUrl}`;
}

/**
 * Resolve the {{sender_name}} sign-off placeholder the email copy brain emits
 * (it can't know the per-account sender). Substituted at the send boundary so
 * the prospect never receives the raw token.
 */
export function applySenderName(body: string, senderName: string): string {
  return body.replace(/\{\{sender_name\}\}/g, senderName);
}
