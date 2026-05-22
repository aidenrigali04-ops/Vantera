import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@vantera/db", "@vantera/types", "@vantera/utils"],
};

export default nextConfig;
