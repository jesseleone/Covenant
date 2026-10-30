import { describe, expect, it } from "vitest";
import { classifyLane } from "./lane";

describe("approval lanes", () => {
  it("green: files in one extension folder, checks pass, AI review not serious", () => {
    const r = classifyLane({ files: ["extensions/deal-one-pager/index.tsx", "extensions/deal-one-pager/manifest.json"], checksPassed: true, aiVerdict: "minor", requireAiVerdict: true });
    expect(r).toMatchObject({ lane: "green", extension: "deal-one-pager" });
  });

  it("review: a core calculation changed, explained in plain English", () => {
    const r = classifyLane({ files: ["lib/selectors.ts"], checksPassed: true, aiVerdict: "none" });
    expect(r.lane).toBe("review");
    expect(r.reasons[0]).toBe("This change edits the deal calculations (leverage, cushion, stage rules or the memo) (lib/selectors.ts), so an engineer needs to review it.");
  });

  it("review: an extension plus a new package", () => {
    const r = classifyLane({ files: ["extensions/x/index.tsx", "package.json", "package-lock.json"] });
    expect(r.lane).toBe("review");
    expect(r.reasons[0]).toMatch(/list of software packages/);
  });

  it("review: two extensions at once", () => {
    expect(classifyLane({ files: ["extensions/a/index.tsx", "extensions/b/index.tsx"] }).reasons).toEqual([
      "This change touches 2 extensions (a and b). Each extension should be sent for approval on its own.",
    ]);
  });

  it("review: a file directly in extensions/ is not inside an extension folder", () => {
    expect(classifyLane({ files: ["extensions/README.md"] }).lane).toBe("review");
  });

  it("review: failed checks, a serious AI finding, or no AI verdict in CI", () => {
    const files = ["extensions/a/index.tsx"];
    expect(classifyLane({ files, checksPassed: false }).lane).toBe("review");
    expect(classifyLane({ files, aiVerdict: "serious" }).lane).toBe("review");
    expect(classifyLane({ files, aiVerdict: null, requireAiVerdict: true }).reasons).toContain("The AI review didn't finish, so an engineer needs to review it to be safe.");
    expect(classifyLane({ files }).lane).toBe("green"); // prediction before CI: unknowns don't count
  });

  it("review: database changes and guardrail changes", () => {
    expect(classifyLane({ files: ["db/migrations/002_x.sql"] }).reasons[0]).toMatch(/database structure/);
    expect(classifyLane({ files: [".claude/hooks/guard-paths.mjs"] }).reasons[0]).toMatch(/Claude's own guardrails/);
  });
});
