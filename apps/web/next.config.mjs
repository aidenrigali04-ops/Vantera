import './load-env.mjs'

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['ws', '@trigger.dev/sdk', '@trigger.dev/sdk/v3'],
  transpilePackages: ['@vantera/db', '@vantera/types', '@vantera/utils'],
  eslint: {
    // eslint-config-next is not yet compatible with ESLint 9 on Vercel
    ignoreDuringBuilds: true,
  },
}

export default nextConfig
