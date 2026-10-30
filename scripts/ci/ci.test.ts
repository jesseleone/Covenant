import { describe, expect, it } from "vitest";
import { classifyLane } from "./lane";
import { decide } from "./engineer-approval";
import { parseChecks, renderLaneComment } from "./classify-pr";
import { parseReview, renderReview, reviewCost } from "./post-ai-review";

const who = { engineers: ["jesseleone"], businessApprovers: ["jesse-leone"] };
const review = (login: string, state: string, commit_id = "head", submitted_at = "2026-10-30T10:00:00Z") => ({ user: { login }, state, commit_id, submitted_at });

describe("engineer-approval check", () => {
  it("passes green-lane changes without an engineer", () => {
    expect(decide({ labels: ["lane: green"], reviews: [], headSha: "head", engineers: who.engineers }).pass).toBe(true);
  });

  it("waits for an engineer on review-lane changes; a business approval isn't enough", () => {
    const r = decide({ labels: ["lane: review"], reviews: [review("jesse-leone", "APPROVED")], headSha: "head", engineers: who.engineers });
    expect(r).toEqual({ pass: false, message: "Review lane: waiting for an engineer (@jesseleone) to approve the latest version." });
  });

  it("passes once an engineer approves the latest commit, not an older one", () => {
    expect(decide({ labels: ["lane: review"], reviews: [review("JesseLeone", "APPROVED")], headSha: "head", engineers: who.engineers }).pass).toBe(true);
    expect(decide({ labels: ["lane: review"], reviews: [review("jesseleone", "APPROVED", "old")], headSha: "head", engineers: who.engineers }).pass).toBe(false);
  });

  it("uses the engineer's latest decision", () => {
    const reviews = [review("jesseleone", "APPROVED", "head", "2026-10-30T10:00:00Z"), review("jesseleone", "CHANGES_REQUESTED", "head", "2026-10-30T11:00:00Z")];
    expect(decide({ labels: ["lane: review"], reviews, headSha: "head", engineers: who.engineers }).pass).toBe(false);
  });

  it("fails safe before the lane is known", () => {
    expect(decide({ labels: [], reviews: [], headSha: "head", engineers: who.engineers }).pass).toBe(false);
  });
});

describe("lane comment", () => {
  it("explains the review lane in plain English, with check results", () => {
    const result = classifyLane({ files: ["lib/selectors.ts"], checksPassed: true, aiVerdict: "none", requireAiVerdict: true });
    const text = renderLaneComment(result, parseChecks("typecheck=success,lint=success,test=success,build=success"), "none", who);
    expect(text).toContain("### 🟠 Review lane: an engineer reviews this");
    expect(text).toContain("This change edits the deal calculations");
    expect(text).toContain("an engineer (@jesseleone) reviews it");
    expect(text).toContain("✅ Tests: success");
  });

  it("names the business approver on the green lane", () => {
    const result = classifyLane({ files: ["extensions/a/index.tsx"], checksPassed: true, aiVerdict: "minor", requireAiVerdict: true });
    expect(renderLaneComment(result, {}, "minor", who)).toContain("a business approver (@jesse-leone) looks at it");
  });
});

describe("AI review comment", () => {
  it("ends with the machine-readable verdict line", () => {
    const r = parseReview(JSON.stringify({ verdict: "minor", summary: "Adds a one-page summary tab. Safe.", findings: [{ severity: "minor", file: "extensions/a/index.tsx", line: 12, issue: "Label says $M for a percentage", suggestion: "Use formatPercent" }] }));
    const { body, verdict } = renderReview(r, 0.1234, "opus");
    expect(verdict).toBe("minor");
    expect(body.trim().split("\n").at(-1)).toBe("AI-REVIEW-VERDICT: minor");
    expect(body).toContain("about $0.12");
    expect(body).toContain("`extensions/a/index.tsx:12`");
  });

  it("says plainly when the review didn't run, with no verdict line", () => {
    const { body, verdict } = renderReview(parseReview(""), null, "opus");
    expect(verdict).toBe("");
    expect(body).not.toContain("AI-REVIEW-VERDICT");
  });

  it("rejects malformed output", () => {
    expect(parseReview('{"verdict":"fine","summary":"x"}')).toBeNull();
    expect(parseReview("not json")).toBeNull();
  });

  it("reads the review's cost when reported, and copes when it isn't", () => {
    expect(reviewCost("/nonexistent")).toBeNull();
  });
});

import { computeMetrics, costOf, type PR } from "./metrics";
import { codespacesUrl, renderPreview } from "./preview-comment";

describe("weekly metrics", () => {
  const base: Omit<PR, "number" | "author" | "createdAt" | "mergedAt"> = { title: "Deal one-pager", body: "", labels: ["lane: green"], isBot: false, firstPass: true };
  const prs: PR[] = [
    { ...base, number: 1, author: "ana", createdAt: "2026-10-20T09:00:00Z", mergedAt: "2026-10-21T09:00:00Z", body: "Estimated Claude cost: ~$1.50 at API list prices" },
    { ...base, number: 2, author: "ana", createdAt: "2026-10-27T09:00:00Z", mergedAt: "2026-10-28T09:00:00Z", firstPass: false, body: "Estimated Claude cost: ~$2.50 at API list prices" },
    { ...base, number: 3, author: "ben", createdAt: "2026-10-28T09:00:00Z", mergedAt: null, labels: ["lane: review"] },
    { ...base, number: 4, author: "jesseleone", createdAt: "2026-10-28T09:00:00Z", mergedAt: "2026-10-29T09:00:00Z", labels: ["lane: review"], title: "Revert \"Deal one-pager\"", body: "Estimated cost: unavailable" },
    { ...base, number: 5, author: "dependabot[bot]", createdAt: "2026-10-28T09:00:00Z", mergedAt: "2026-10-29T09:00:00Z", isBot: true },
  ];
  const text = computeMetrics(prs, ["jesseleone"], new Date("2026-10-30T07:00:00Z"));

  it("counts live changes, lane mix, reverts and first-time passes (bots excluded)", () => {
    expect(text).toContain("| Changes live (merged) | 3 | 2 |");
    expect(text).toContain("| Lane mix: green / review | 2 / 1 | 1 / 1 |");
    expect(text).toContain("| Reverts (changes undone) | 1 | 1 |");
    expect(text).toContain("| Passed every check the first time | 75% (4 sent)");
  });

  it("averages the estimated cost over changes that have one", () => {
    expect(text).toContain("$2.00 (2 with an estimate)");
    expect(costOf("Estimated cost: unavailable")).toBeNull();
  });

  it("measures time to first safe deployment per citizen, not engineers", () => {
    expect(text).toContain("| @ana | 2 | 1.0 days |");
    expect(text).toContain("| @ben | 1 | not yet |");
    expect(text).not.toContain("| @jesseleone |");
  });
});

describe("preview comment", () => {
  it("links a Codespace on the PR's branch, in GitHub's documented format", () => {
    expect(codespacesUrl("jesseleone/Covenant", "ext/deal-one-pager-20261030")).toBe("https://codespaces.new/jesseleone/Covenant/tree/ext/deal-one-pager-20261030?quickstart=1");
  });

  it("names changed extensions and links screenshots", () => {
    const text = renderPreview("jesseleone/Covenant", "b", ["sector-exposure"], { url: "https://example.com/a" });
    expect(text).toContain("**Sector exposure** (page `/x/sector-exposure`)");
    expect(text).toContain("[Download the screenshots](https://example.com/a)");
  });
});
