import type { NextConfig } from "next";

// Data lives in Postgres and is reached through the route handlers in app/api;
// the browser keeps a read cache (see lib/store.ts), so Cache Components /
// partial prefetching are not used. Tailwind runs through PostCSS
// (postcss.config.mjs). `standalone` output feeds the production Dockerfile.
const nextConfig: NextConfig = {
  devIndicators: false,
  output: "standalone",
};

export default nextConfig;
