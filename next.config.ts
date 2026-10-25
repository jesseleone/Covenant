import type { NextConfig } from "next";

// The app is client-side: all data lives in a browser store (see lib/store.ts),
// so Cache Components / partial prefetching are not used. Tailwind runs through
// PostCSS (postcss.config.mjs).
const nextConfig: NextConfig = {
  devIndicators: false,
};

export default nextConfig;
