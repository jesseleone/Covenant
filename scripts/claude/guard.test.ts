import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

// The Claude Code PreToolUse hook that keeps citizen edits inside extensions/.
const HOOK = path.join(process.cwd(), ".claude", "hooks", "guard-paths.mjs");
const project = "/work/covenant";

function run(tool: string, input: Record<string, string>, env: Record<string, string> = {}) {
  const base = { ...process.env };
  delete base.COVENANT_ENGINEER;
  const r = spawnSync("node", [HOOK], {
    input: JSON.stringify({ hook_event_name: "PreToolUse", cwd: project, tool_name: tool, tool_input: input }),
    env: { ...base, CLAUDE_PROJECT_DIR: project, ...env },
    encoding: "utf8",
  });
  return { code: r.status, message: r.stderr };
}

describe("guard: edits stay inside extensions/", () => {
  it("allows files in an extension folder (absolute or relative path)", () => {
    expect(run("Write", { file_path: `${project}/extensions/deal-one-pager/index.tsx` }).code).toBe(0);
    expect(run("Edit", { file_path: "extensions/deal-one-pager/SPEC.md" }).code).toBe(0);
  });

  it("blocks core files with a plain-English reason", () => {
    const r = run("Edit", { file_path: `${project}/lib/selectors.ts` });
    expect(r.code).toBe(2);
    expect(r.message).toContain("Blocked: lib/selectors.ts is outside the extensions folder.");
    expect(r.message).toContain("engineering request");
  });

  it("blocks escapes, guardrail files and notebooks", () => {
    expect(run("Write", { file_path: `${project}/extensions/x/../../package.json` }).code).toBe(2);
    expect(run("Write", { file_path: `${project}/.claude/settings.json` }).code).toBe(2);
    expect(run("NotebookEdit", { notebook_path: `${project}/analysis.ipynb` }).code).toBe(2);
  });

  it("lets Claude keep its own notes and scratch files", () => {
    expect(run("Write", { file_path: "/tmp/covenant-approval.md" }).code).toBe(0);
  });

  it("steps aside in engineer mode", () => {
    expect(run("Edit", { file_path: `${project}/lib/selectors.ts` }, { COVENANT_ENGINEER: "1" }).code).toBe(0);
  });
});
