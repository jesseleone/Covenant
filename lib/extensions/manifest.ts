// The manifest.json every extension folder carries, and the rules an
// extension folder must follow. Used by the registry generator
// (scripts/gen-extensions.ts), the structure tests and the catalog page.

import { z } from "zod";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "use YYYY-MM-DD");

export const ManifestSchema = z.object({
  name: z.string().min(2).max(40),
  description: z.string().min(10).max(200),
  placement: z.enum(["nav", "deal-tab"]),
  owner: z.object({
    github: z.string().regex(/^[A-Za-z0-9-]+$/, "GitHub username, without @"),
    name: z.string().min(2),
  }),
  createdAt: day,
  updatedAt: day,
}).strict();

export type ExtensionManifest = z.infer<typeof ManifestSchema>;

/** Folder names: lowercase words joined by hyphens, e.g. "sector-exposure". */
export const SLUG = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/** Names that would collide with the app's own routes and deal tabs. */
export const RESERVED_SLUGS = [
  "overview", "financials", "securities", "diligence", "memo", "ic", "stakeholders", "documents", "notes", "history",
  "deals", "companies", "people", "chat", "extensions", "login", "api",
];

/** Days after which the catalog flags an extension as possibly stale. */
export const STALE_AFTER_DAYS = 90;
