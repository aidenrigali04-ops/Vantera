/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@vantera/db', '@vantera/types', '@vantera/utils'],
  eslint: {
    // eslint-config-next is not yet compatible with ESLint 9 on Vercel
    ignoreDuringBuilds: true,
  },
}

export default nextConfig
