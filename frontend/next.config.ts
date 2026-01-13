import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable static export for Capacitor
  output: 'export',

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
