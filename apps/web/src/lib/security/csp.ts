// Content-Security-Policy builder. Nonce-based with strict-dynamic so we never need
// 'unsafe-inline' for scripts. Shipped Report-Only first (see proxy.ts) — observe violations
// at /api/csp-report, fix sources, then flip to enforcing by sending it as the
// `Content-Security-Policy` response header instead of the Report-Only one.
export function buildCsp(nonce: string): string {
  return [
    `default-src 'self'`,
    // Nonce'd scripts may load further scripts (strict-dynamic); `https:` is a CSP2 fallback for
    // browsers that ignore strict-dynamic. No 'unsafe-inline' for scripts.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https:`,
    // Tailwind/Next inject inline styles; style injection is low-risk, so allow inline styles.
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: https:`,
    `font-src 'self' data:`,
    // Browser fetches: same-origin API (copilot stream, etc.) + Supabase + Google Analytics
    // (GA4 gtag.js loader + measurement beacons — without these the event sends are blocked once
    // the policy is enforced) + Microsoft Clarity (heatmap/session-recording uploads go to
    // *.clarity.ms and c.bing.com) + Meta Pixel (fbevents.js from connect.facebook.net,
    // conversion sends to facebook.com/tr). img-src already permits pixel fallbacks via `https:`.
    `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://www.googletagmanager.com https://*.google-analytics.com https://*.analytics.google.com https://*.clarity.ms https://c.bing.com https://connect.facebook.net https://www.facebook.com`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `object-src 'none'`,
    `report-uri /api/csp-report`,
  ].join("; ");
}
