import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use 'standalone' for Docker, 'export' for Capacitor mobile builds
  output: process.env.DOCKER_BUILD ? 'standalone' : 'export',

  // Disable image optimization for static export
  images: {
    unoptimized: true,
  },

  // Trailing slashes for proper mobile routing
  trailingSlash: true,

  // Disable server-side features for mobile
  experimental: {
    // Empty for now
  },
};

export default nextConfig;
