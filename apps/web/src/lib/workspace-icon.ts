/**
 * The little square in the workspace pill: the brand's own favicon rather than a generic
 * mark.
 *
 * The precise source is what the onboarding site scan actually found (`<link rel="icon">`,
 * stored on `accounts.website_scan.faviconUrl`). Without one we guess from the account's own
 * domain — and a single guess is not enough: `/favicon.ico` is the oldest convention but a
 * modern site often ships `/favicon.svg` and PNGs instead, and an SPA host will answer the
 * missing `.ico` with **200 and its index HTML** rather than a 404. So we hand the component
 * an ordered list and it walks it until an image actually decodes.
 *
 * Every candidate points at the customer's OWN domain — no third-party favicon service, so
 * no page in the app tells anyone else which sites our customers own. Always https: the CSP
 * allows `https:` images and http would be blocked as mixed content.
 */

/** Conventional icon paths, most universal first. */
const CANDIDATE_PATHS = ["/favicon.ico", "/favicon.svg", "/favicon-32.png", "/favicon.png", "/apple-touch-icon.png"];

/** The origin (https, host only) of a stored website URL, or null when it isn't usable. */
function originOf(websiteUrl: string | null | undefined): string | null {
  const site = (websiteUrl ?? "").trim();
  if (!site) return null;
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(site) ? site : `https://${site}`);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (!u.hostname.includes(".")) return null;
    return `https://${u.host}`;
  } catch {
    return null;
  }
}

/**
 * Icon URLs to try, in order. The scanned icon is authoritative and used alone; otherwise the
 * conventional paths on the account's domain.
 */
export function workspaceIconCandidates(
  scanFaviconUrl: string | null | undefined,
  websiteUrl: string | null | undefined
): string[] {
  const found = (scanFaviconUrl ?? "").trim();
  if (/^https?:\/\//i.test(found)) return [found.replace(/^http:\/\//i, "https://")];
  const origin = originOf(websiteUrl);
  if (!origin) return [];
  return CANDIDATE_PATHS.map((path) => `${origin}${path}`);
}

/** The first candidate — kept for callers that only need one URL. */
export function workspaceIconUrl(
  scanFaviconUrl: string | null | undefined,
  websiteUrl: string | null | undefined
): string | null {
  return workspaceIconCandidates(scanFaviconUrl, websiteUrl)[0] ?? null;
}
