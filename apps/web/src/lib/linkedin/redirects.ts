import type { HostedAuthRedirects } from "@vantera/linkedin-infra";

/** Loopback hosts are the only places the app legitimately runs over plain http. */
const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/**
 * The canonical origin to send a hosted-auth return to.
 *
 * Normalizes to an origin (no path, no trailing slash) and forces https for any real
 * host: the provider will not return a browser to an http URL, and an http hop on an
 * HSTS domain is an extra redirect that can drop the return query string.
 */
export function appBaseUrl(raw: string | undefined): string {
  const value = (raw ?? "").trim();
  if (!value) throw new Error("APP_URL is not set");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`APP_URL is not a valid absolute URL: ${value}`);
  }
  if (!LOOPBACK.has(url.hostname)) url.protocol = "https:";
  return url.origin;
}

/**
 * Build the hosted-auth return URLs for `path` (e.g. "/onboarding", "/settings/channels").
 *
 * Both connect surfaces go through here so they can never disagree about scheme or host —
 * they used to build these separately, and only one of them forced https.
 */
export function buildConnectRedirects(
  appUrl: string | undefined,
  path: string
): HostedAuthRedirects {
  const base = appBaseUrl(appUrl);

  // The user returns to APP_URL's host, but their session cookie was issued on the host
  // the app is served from. A www-vs-apex mismatch means they finish the hosted login and
  // come back signed out — the connect "silently failing" with no error anywhere.
  const browserUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (browserUrl) {
    try {
      const browserHost = new URL(browserUrl).host;
      if (browserHost !== new URL(base).host) {
        console.error(
          `APP_URL host (${new URL(base).host}) does not match NEXT_PUBLIC_APP_URL host (${browserHost}). ` +
            "The hosted-auth return will land on a different host than the session cookie, " +
            "so users will come back signed out. Set both to the same canonical host."
        );
      }
    } catch {
      /* an unparseable public url is its own problem — never block the connect on it */
    }
  }

  return {
    success: `${base}${path}?connected=1`,
    failure: `${base}${path}?connected=failed`,
  };
}
