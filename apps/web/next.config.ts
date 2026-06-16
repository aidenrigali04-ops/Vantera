import type { NextConfig } from "next";

// Security headers applied to every response (production-readiness, rule 10): HSTS, clickjacking
// + MIME-sniffing protection, a tight referrer policy, and a locked-down permissions policy.
// The Content-Security-Policy is set in proxy.ts (it needs a per-request nonce) and currently
// ships in Report-Only mode — flip it to enforcing after reviewing /api/csp-report output.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // Don't advertise the framework/version (production-readiness, rule 10).
  poweredByHeader: false,
  transpilePackages: [
    "@vantera/db",
    "@vantera/ai",
    "@vantera/email-infra",
    "@vantera/linkedin-infra",
  ],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
