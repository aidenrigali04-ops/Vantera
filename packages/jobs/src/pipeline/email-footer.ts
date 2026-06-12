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
  // city and "region postal" — region + postal join with space when both present,
  // city and postal join with space when region is absent
  const cityLine = [[a.city, a.region].filter(Boolean).join(", "), a.postal].filter(Boolean).join(" ");
  return [a.line1, a.line2, cityLine, a.country].filter(Boolean).join(", ");
}

export function appendComplianceFooter(body: string, unsubscribeUrl: string, address: SenderAddress): string {
  return `${body}\n\n--\n${formatSenderAddress(address)}\nDon't want these emails? Unsubscribe: ${unsubscribeUrl}`;
}
