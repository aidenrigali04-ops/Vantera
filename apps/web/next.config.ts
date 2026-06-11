import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@vantera/db",
    "@vantera/ai",
    "@vantera/email-infra",
    "@vantera/linkedin-infra",
  ],
};

export default nextConfig;
