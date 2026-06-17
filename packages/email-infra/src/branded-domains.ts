/**
 * Branded sending-domain candidates for an account.
 *
 * Cold outreach must NEVER go out from the customer's primary domain — a spam hit there torches
 * their real corporate email (sales, support, exec inboxes). The standard, deliverability-safe
 * practice is dedicated, recognizable *look-alike* domains derived from the brand
 * (e.g. acme.com → getacme.com, acme-hq.com). This module turns an account's company name /
 * website into an ordered list of such candidates; the provider registers the first available
 * ones (domains can be taken, so we always offer more than needed). Pure + framework-free.
 */

// Common legal/filler suffixes dropped so the brand token reads clean ("Acme Inc" → "acme").
const LEGAL_SUFFIXES = new Set([
  "inc", "llc", "ltd", "co", "corp", "gmbh", "plc", "group", "labs", "holdings", "company",
]);

// Second-level public suffixes so "acme.co.uk" resolves the brand to "acme", not "co".
const SECOND_LEVEL = new Set(["co", "com", "org", "net", "gov", "edu", "ac"]);

/** The registrable host of a website URL, e.g. "https://www.acme.com/x" → "acme.com". */
export function primaryHost(websiteUrl?: string | null): string | null {
  if (!websiteUrl) return null;
  const host = websiteUrl
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]!
    .split(":")[0]!;
  return host.includes(".") ? host : null;
}

/** The second-level label of a host (the brand part): "acme.com"/"acme.co.uk" → "acme". */
function sldFromHost(host: string | null): string | null {
  if (!host) return null;
  const parts = host.split(".").filter(Boolean);
  if (parts.length < 2) return null;
  const penult = parts[parts.length - 2]!;
  if (SECOND_LEVEL.has(penult) && parts.length >= 3) return parts[parts.length - 3]!;
  return penult;
}

/** A clean brand token from the website root (preferred) or the company name. */
export function brandToken(companyName?: string | null, websiteUrl?: string | null): string | null {
  const fromUrl = sldFromHost(primaryHost(websiteUrl));
  const raw = fromUrl ?? companyName ?? "";
  const words = raw
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .filter(Boolean)
    .filter((w) => !LEGAL_SUFFIXES.has(w));
  const slug = words.join("");
  return slug.length >= 2 ? slug : null;
}

const PATTERNS = (b: string): string[] => [
  `get${b}.com`,
  `try${b}.com`,
  `${b}hq.com`,
  `${b}-hq.com`,
  `${b}mail.com`,
  `mail${b}.com`,
  `go${b}.com`,
  `${b}team.com`,
  `${b}-team.com`,
  `join${b}.com`,
  `${b}app.com`,
  `${b}hq.co`,
  `${b}.io`,
  `${b}.co`,
];

/** RFC-ish label validation: each dot-label 1–63 chars, alphanumeric with internal hyphens. */
function isValidDomain(d: string): boolean {
  const labels = d.split(".");
  if (labels.length < 2) return false;
  return labels.every((l) => /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(l));
}

/**
 * Ordered look-alike sending-domain candidates for the brand. Always excludes the primary
 * corporate domain. Returns [] when no brand can be derived — the caller then falls back to a
 * neutral provider-owned subdomain so provisioning never hard-fails.
 */
export function brandedSendingDomains(
  companyName: string | null | undefined,
  websiteUrl: string | null | undefined,
  _count: number
): string[] {
  const brand = brandToken(companyName, websiteUrl);
  if (!brand) return [];
  const primary = primaryHost(websiteUrl);
  const seen = new Set<string>();
  return PATTERNS(brand).filter((d) => {
    if (!isValidDomain(d)) return false;
    if (d === primary) return false; // never the customer's real domain
    if (seen.has(d)) return false;
    seen.add(d);
    return true;
  });
}
