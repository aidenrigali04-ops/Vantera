import type { NextConfig } from "next";

// Security headers applied to every response (production-readiness, rule 10): HSTS, clickjacking
// + MIME-sniffing protection, a tight referrer policy, and a locked-down permissions policy.
// The Content-Security-Policy is set in proxy.ts (it needs a per-request nonce) and currently
// ships in Report-Only mode — flip it to enforcing after reviewing /api/csp-report output.
// Security headers applied to every response. X-Frame-Options is handled separately
// below so the same-origin auth animation can be embedded as an iframe.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // Don't advertise the framework/version (production-readiness, rule 10).
  poweredByHeader: false,
  // Tree-shake the heavy client deps the landing leans on so unused exports never reach
  // the browser bundle — cuts JS execution / main-thread work on mobile (Lighthouse).
  experimental: {
    optimizePackageImports: ["framer-motion", "lucide-react"],
  },
  transpilePackages: [
    "@vantera/db",
    "@vantera/ai",
    "@vantera/linkedin-infra",
  ],
  // Dashboard blueprint §2.3 / D10 vocabulary + route migration (2026-08-21): the app surfaces
  // were renamed (review → approvals, leads → prospects, agents → playbook,
  // settings/channels → settings/senders). Old deep links live in sent emails, bookmarks, and
  // notification CTAs, so every old path 308s to its new home (query strings pass through).
  async redirects() {
    return [
      { source: "/review", destination: "/approvals", permanent: true },
      { source: "/review/:path*", destination: "/approvals/:path*", permanent: true },
      { source: "/leads", destination: "/prospects", permanent: true },
      { source: "/leads/:path*", destination: "/prospects/:path*", permanent: true },
      { source: "/agents", destination: "/playbook", permanent: true },
      { source: "/agents/:path*", destination: "/playbook/:path*", permanent: true },
      { source: "/settings/channels", destination: "/settings/senders", permanent: true },
    ];
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Clickjacking protection everywhere EXCEPT the auth animation, which is a
      // static, contentless decorative panel embedded as a same-origin iframe.
      {
        source: "/((?!auth-panel\\.html).*)",
        headers: [{ key: "X-Frame-Options", value: "DENY" }],
      },
      { source: "/auth-panel.html", headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }] },
    ];
  },
};

export default nextConfig;
