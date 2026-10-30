import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    // Database tests (*.db.test.ts) share one test database, so files run one at a time.
    fileParallelism: false,
    projects: [
      { extends: true, test: { name: "core", environment: "node", include: ["lib/**/*.test.ts", "components/**/*.test.tsx", "scripts/**/*.test.ts"] } },
      // Extension views render in a simulated browser.
      { extends: true, test: { name: "extensions", environment: "jsdom", include: ["extensions/**/*.test.tsx", "lib/sdk/**/*.test.tsx"] } },
    ],
  },
});
