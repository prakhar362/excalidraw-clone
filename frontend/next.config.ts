import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    domains: ["www.launchuicomponents.com", "vibeus-cdn.vibe.pub"],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
