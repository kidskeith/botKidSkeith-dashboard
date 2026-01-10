import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Explicitly set the root directory
  distDir: '.next',
  // Disable strict mode for hydration
  reactStrictMode: false,
};

export default nextConfig;
