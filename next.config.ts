import type { NextConfig } from "next";

// Data lives in Postgres and is reached through the route handlers in app/api;
// the browser keeps a read cache (see lib/store.ts), so Cache Components /
// partial prefetching are not used. Tailwind runs through PostCSS
// (postcss.config.mjs). `standalone` output feeds the production Dockerfile.

// In GitHub Codespaces the preview is served from a forwarded address
// (…app.github.dev); the dev server must allow it, or it blocks its own
// development requests from that page.
const codespacesDomain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN || "app.github.dev";

const nextConfig: NextConfig = {
  devIndicators: false,
  output: "standalone",
  allowedDevOrigins: [`*.${codespacesDomain}`],
};

export default nextConfig;
