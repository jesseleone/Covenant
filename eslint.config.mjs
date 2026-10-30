import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Extensions (extensions/<name>/) may use only React, the extension SDK
// (@/lib/sdk) and files in their own folder. No other app code, packages,
// network calls, browser storage or raw HTML. CI runs this on every change.
const EXTENSION_IMPORTS =
  "Extensions can only import from \"@/lib/sdk\", \"react\" and files in their own folder. " +
  "If you need something else, it needs an engineer: ask for an engineering request.";
const extensionImportRule = (allowed) => ["error", {
  patterns: [
    { regex: `^(?!(?:${allowed.join("|")})$)(?!\\./).*`, message: EXTENSION_IMPORTS },
    { regex: "\\.\\.", message: "Extensions can't reach outside their own folder." },
  ],
}];
const NO_NETWORK = "Extensions can't make network calls or use browser storage; read data with useCovenant() from \"@/lib/sdk\".";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "dist/**",
  ]),
  {
    files: ["extensions/**/*.{ts,tsx,js,jsx,mjs,cjs}"],
    rules: {
      "no-restricted-imports": extensionImportRule(["react", "@/lib/sdk"]),
      "no-restricted-globals": ["error",
        ...["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "localStorage", "sessionStorage", "indexedDB", "eval"].map((name) => ({ name, message: NO_NETWORK })),
      ],
      "no-restricted-properties": ["error",
        { object: "window", message: NO_NETWORK },
        { object: "globalThis", message: NO_NETWORK },
        { object: "navigator", property: "sendBeacon", message: NO_NETWORK },
        { object: "document", property: "cookie", message: NO_NETWORK },
        { object: "process", property: "env", message: "Extensions can't read server settings or secrets." },
      ],
      "no-restricted-syntax": ["error",
        { selector: "ImportExpression", message: EXTENSION_IMPORTS },
        { selector: "CallExpression[callee.name='require']", message: EXTENSION_IMPORTS },
        { selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']", message: "Extensions can't insert raw HTML." },
      ],
    },
  },
  {
    // Tests may also use the test runner and the SDK's test helpers.
    files: ["extensions/**/*.test.{ts,tsx}"],
    rules: { "no-restricted-imports": extensionImportRule(["react", "@/lib/sdk", "@/lib/sdk/testing", "vitest"]) },
  },
]);

export default eslintConfig;
