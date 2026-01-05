import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  experimental: {
    turbopackFileSystemCacheForDev: true,
    // turbopackFileSystemCacheForBuild: true,
  },
};

export default nextConfig;
