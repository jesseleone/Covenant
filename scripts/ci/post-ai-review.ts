// Turns the AI review's structured output into one PR comment (updated in
// place) that ends with the machine-readable line the lane classifier reads:
//   AI-REVIEW-VERDICT: none | minor | serious
// Also reports the review's own cost when the action's execution file has it.
//
// Env: PR_NUMBER, STRUCTURED_OUTPUT (JSON), EXECUTION_FILE, REVIEW_MODEL.

import { existsSync, readFileSync } from "node:fs";
import { prNumber, setOutput, summary, upsertComment } from "./github";

export const AI_MARKER = "<!-- covenant:ai-review -->";
const VERDICTS = ["none", "minor", "serious"] as const;
type Verdict = (typeof VERDICTS)[number];
type Finding = { severity: "serious" | "minor"; file: string; line?: number; issue: string; suggestion?: string };
type Review = { verdict: Verdict; summary: string; findings: Finding[] };

export function parseReview(raw: string | undefined): Review | null {
  if (!raw?.trim()) return null;
  try {
    const r = JSON.parse(raw) as Partial<Review>;
    if (!r || !VERDICTS.includes(r.verdict as Verdict) || typeof r.summary !== "string") return null;
    return { verdict: r.verdict as Verdict, summary: r.summary, findings: Array.isArray(r.findings) ? r.findings : [] };
  } catch {
    return null;
  }
}

/** The action's execution file holds the Claude Code run; its result message reports total_cost_usd. */
export function reviewCost(file: string | undefined): number | null {
  if (!file || !existsSync(file)) return null;
  const text = readFileSync(file, "utf8");
  const costs = [...text.matchAll(/"total_cost_usd"\s*:\s*([0-9.]+)/g)].map((m) => Number(m[1]));
  return costs.length ? costs.at(-1)! : null;
}

const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");

export function renderReview(review: Review | null, cost: number | null, model: string): { body: string; verdict: Verdict | "" } {
  if (!review) {
    return {
      verdict: "",
      body: [
        "### AI review: didn't run",
        "",
        "The AI review didn't finish for this change. This happens if the project has no Anthropic API key set up, or if the change comes from outside the project. An engineer will review it instead.",
      ].join("\n"),
    };
  }
  const icon = review.verdict === "serious" ? "🔴" : review.verdict === "minor" ? "🟡" : "🟢";
  const label = review.verdict === "serious" ? "serious issues found" : review.verdict === "minor" ? "minor suggestions" : "nothing to flag";
  const lines = [`### AI review: ${icon} ${label}`, "", review.summary, ""];
  if (review.findings.length) {
    lines.push("| | Issue | Where | Suggestion |", "|---|---|---|---|");
    for (const f of review.findings) {
      lines.push(`| ${f.severity === "serious" ? "🔴" : "🟡"} | ${cell(f.issue)} | \`${cell(f.file)}${f.line ? `:${f.line}` : ""}\` | ${cell(f.suggestion ?? "")} |`);
    }
    lines.push("");
  }
  const costNote = cost === null ? "The action didn't report this review's cost." : `This review cost about $${cost.toFixed(2)} (reported by the action).`;
  lines.push(`<sub>Reviewed by Claude (${model}) against the project's rules, security and correctness. ${costNote}</sub>`, "", `AI-REVIEW-VERDICT: ${review.verdict}`);
  return { body: lines.join("\n"), verdict: review.verdict };
}

if (process.argv[1]?.endsWith("post-ai-review.ts")) {
  const review = parseReview(process.env.STRUCTURED_OUTPUT);
  const { body, verdict } = renderReview(review, reviewCost(process.env.EXECUTION_FILE), process.env.REVIEW_MODEL || "Opus");
  try {
    upsertComment(prNumber(), AI_MARKER, body);
  } catch (e) {
    console.warn(`Couldn't post the review comment: ${e instanceof Error ? e.message : e}`);
  }
  summary(body);
  setOutput("verdict", verdict);
  console.log(`AI review verdict: ${verdict || "(none — review didn't run)"}`);
}
