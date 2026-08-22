/**
 * The little square in the workspace pill: the brand's own favicon rather than a generic
 * mark.
 *
 * Two sources, in order of precision:
 *  1. what the onboarding site scan actually found (`<link rel="icon">`, stored on
 *     `accounts.website_scan.faviconUrl`), and
 *  2. the site's conventional `/favicon.ico`, derived from `accounts.website_url`.
 *
 * The second matters more than it looks: an account that onboarded before the scan worked
 * has no stored favicon at all, and without the fallback the pill would silently keep the
 * generic mark forever. The derived URL points at the customer's OWN domain — no third-party
 * favicon service, so no page in the app tells anyone else which sites our customers own.
 * Always https: the CSP allows `https:` images and http would be blocked as mixed content.
 * A miss is harmless — the pill falls back to the mark on the image's error event.
 */
export function workspaceIconUrl(
  scanFaviconUrl: string | null | undefined,
  websiteUrl: string | null | undefined
): string | null {
  const found = (scanFaviconUrl ?? "").trim();
  if (/^https?:\/\//i.test(found)) return found.replace(/^http:\/\//i, "https://");

  const site = (websiteUrl ?? "").trim();
  if (!site) return null;
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(site) ? site : `https://${site}`);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (!u.hostname.includes(".")) return null;
    return `https://${u.host}/favicon.ico`;
  } catch {
    return null;
  }
}
