import './load-env.mjs'

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Next 14 key (bare `serverExternalPackages` is Next 15 and is silently ignored)
    serverComponentsExternalPackages: ['ws', '@trigger.dev/sdk', '@trigger.dev/sdk/v3'],
  },
  transpilePackages: ['@vantera/db', '@vantera/types', '@vantera/utils'],
  eslint: {
    // eslint-config-next is not yet compatible with ESLint 9 on Vercel
    ignoreDuringBuilds: true,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: https: blob:",
              [
                "connect-src 'self'",
                'https://*.supabase.co',
                'wss://*.supabase.co',
                'https://api.anthropic.com',
                'https://api.resend.com',
                'https://api.twilio.com',
                'https://api.trigger.dev',
              ].join(' '),
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

export default nextConfig
