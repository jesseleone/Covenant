import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ESLint } from "eslint";
import { ManifestSchema, RESERVED_SLUGS, SLUG } from "@/lib/extensions/manifest";

const dir = path.join(process.cwd(), "extensions");
const folders = existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name) : [];

describe("every extension folder follows the rules", () => {
  it.each(folders)("%s", (slug) => {
    expect(SLUG.test(slug), "folder name: lowercase words joined by hyphens").toBe(true);
    expect(RESERVED_SLUGS, "folder name is already used by the app").not.toContain(slug);
    const files = readdirSync(path.join(dir, slug), { recursive: true }).map(String);
    expect(files, "needs manifest.json").toContain("manifest.json");
    const manifest = ManifestSchema.safeParse(JSON.parse(readFileSync(path.join(dir, slug, "manifest.json"), "utf8")));
    expect(manifest.error?.issues ?? [], "manifest.json is invalid").toEqual([]);
    expect(files, "needs index.tsx (the view)").toContain("index.tsx");
    expect(files.some((f) => /\.test\.tsx?$/.test(f)), "needs at least one test").toBe(true);
    expect(manifest.data!.updatedAt >= manifest.data!.createdAt, "updatedAt is before createdAt").toBe(true);
  });
});

describe("extension import rule", () => {
  const eslint = new ESLint();
  const lint = async (code: string, file = "extensions/example/index.tsx") =>
    (await eslint.lintText(code, { filePath: file }))[0].messages.filter((m) => m.severity === 2).map((m) => m.ruleId);

  it("allows the SDK, React and the extension's own files", async () => {
    expect(await lint(`import { useCovenant } from "@/lib/sdk";\nimport { useState } from "react";\nimport { helper } from "./helper";\nexport default function V() { useState(0); useCovenant(); return helper; }\n`)).toEqual([]);
  });

  it("blocks app internals, packages and other folders", async () => {
    expect(await lint(`import { useDB } from "@/lib/store";\nexport const x = useDB;\n`)).toContain("no-restricted-imports");
    expect(await lint(`import { moveStage } from "@/lib/actions";\nexport const x = moveStage;\n`)).toContain("no-restricted-imports");
    expect(await lint(`import _ from "lodash";\nexport const x = _;\n`)).toContain("no-restricted-imports");
    expect(await lint(`import x from "../other/index";\nexport const y = x;\n`)).toContain("no-restricted-imports");
  });

  it("blocks network calls, storage, secrets and raw HTML", async () => {
    expect(await lint(`export const x = () => fetch("/api/db");\n`)).toContain("no-restricted-globals");
    expect(await lint(`export const x = () => localStorage.getItem("k");\n`)).toContain("no-restricted-globals");
    expect(await lint(`export const x = process.env.ANTHROPIC_API_KEY;\n`)).toContain("no-restricted-properties");
    expect(await lint(`export const x = () => <div dangerouslySetInnerHTML={{ __html: "" }} />;\n`)).toContain("no-restricted-syntax");
  });

  it("lets tests use vitest and the SDK test helpers only", async () => {
    expect(await lint(`import { it } from "vitest";\nimport { renderExtension } from "@/lib/sdk/testing";\nit("x", () => { renderExtension(null as never); });\n`, "extensions/example/x.test.tsx")).toEqual([]);
    expect(await lint(`import { buildSeed } from "@/lib/seed";\nexport const x = buildSeed;\n`, "extensions/example/x.test.tsx")).toContain("no-restricted-imports");
  });
});
