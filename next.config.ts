import type { NextConfig } from "next";

// The app is client-side: all data lives in a browser store (see lib/store.ts),
// so Cache Components / partial prefetching are not used.
const nextConfig: NextConfig = {
  devIndicators: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
