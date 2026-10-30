// CI: decide a pull request's approval lane, label it, explain why in one
// comment (updated, never duplicated), and switch automatic merging on (green)
// or off (review).
//
// Env: PR_NUMBER, HEAD_SHA, CHECK_RESULTS ("typecheck=success,lint=failure,…"),
//      AI_VERDICT ("none" | "minor" | "serious" | ""), GH_TOKEN.

import { readFileSync } from "node:fs";
import { classifyLane, type AiVerdict, type LaneResult } from "./lane";
import { changedFiles, gh, prNumber, setOutput, summary, upsertComment } from "./github";

export const LANE_MARKER = "<!-- covenant:lane -->";
export const LABELS = { green: "lane: green", review: "lane: review" } as const;

type Approvers = { engineers: string[]; businessApprovers: string[] };
const approvers = (): Approvers => JSON.parse(readFileSync(".github/approvers.json", "utf8"));
const mention = (users: string[]) => users.map((u) => `@${u}`).join(", ");

export function parseChecks(raw: string): Record<string, string> {
  return Object.fromEntries(raw.split(",").filter(Boolean).map((p) => p.split("=").map((s) => s.trim()) as [string, string]));
}

const CHECK_NAMES: Record<string, string> = { typecheck: "Type check", lint: "Code rules (lint)", test: "Tests", build: "Build" };

export function renderLaneComment(result: LaneResult, checks: Record<string, string>, verdict: string, who: Approvers, autoMergeNote?: string) {
  const green = result.lane === "green";
  const lines = [
    green ? "### 🟢 Green lane: one business approver" : "### 🟠 Review lane: an engineer reviews this",
    "",
    ...(result.reasons.length === 1 ? result.reasons : result.reasons.map((r) => `- ${r}`)),
    "",
    green
      ? `**What happens next:** a business approver (${mention(who.businessApprovers)}) looks at it. Once they approve, it goes live automatically.`
      : `**What happens next:** an engineer (${mention(who.engineers)}) reviews it before it can go live.`,
  ];
  if (autoMergeNote) lines.push("", autoMergeNote);
  lines.push(
    "",
    "<details><summary>Automatic checks</summary>",
    "",
    ...Object.entries(checks).map(([k, v]) => `- ${v === "success" ? "✅" : "❌"} ${CHECK_NAMES[k] ?? k}: ${v}`),
    `- AI review: ${verdict || "didn't run"}`,
    "",
    "</details>",
  );
  return lines.join("\n");
}

function ensureLabels() {
  gh(["label", "create", LABELS.green, "--color", "2DA44E", "--description", "One business approver; goes live automatically", "--force"]);
  gh(["label", "create", LABELS.review, "--color", "D97757", "--description", "Needs an engineer's review", "--force"]);
}

if (process.argv[1]?.endsWith("classify-pr.ts")) {
  const pr = prNumber();
  const headSha = process.env.HEAD_SHA ?? "";
  if (!/^[0-9a-f]{40}$/.test(headSha)) throw new Error("HEAD_SHA is not set");
  const checks = parseChecks(process.env.CHECK_RESULTS ?? "");
  const verdict = (process.env.AI_VERDICT ?? "").trim();
  const result = classifyLane({
    files: changedFiles(pr),
    checksPassed: Object.values(checks).every((v) => v === "success"),
    aiVerdict: (["none", "minor", "serious"].includes(verdict) ? verdict : null) as AiVerdict | null,
    requireAiVerdict: true,
  });

  // The lane goes to engineer-approval as this job's output (same workflow run),
  // so it's set before anything that could fail.
  setOutput("lane", result.lane);
  const attempt = (what: string, fn: () => void) => {
    try { fn(); return true; } catch (e) { console.warn(`Couldn't ${what}: ${e instanceof Error ? e.message : e}`); return false; }
  };

  attempt("set the lane label", () => {
    ensureLabels();
    const add = LABELS[result.lane], remove = LABELS[result.lane === "green" ? "review" : "green"];
    gh(["pr", "edit", String(pr), "--add-label", add, "--remove-label", remove]);
  });

  // Automatic merging last, and pinned to the commit that was judged.
  let note: string | undefined;
  const merged = attempt("update automatic merging", () => {
    if (result.lane === "green") gh(["pr", "merge", String(pr), "--auto", "--squash", "--match-head-commit", headSha]);
    else gh(["pr", "merge", String(pr), "--disable-auto"]);
  });
  if (!merged && result.lane === "green") note = "_Automatic merging isn't switched on for this project yet, so after approval someone needs to press **Merge**._";

  const body = renderLaneComment(result, checks, verdict, approvers(), note);
  attempt("post the lane comment", () => upsertComment(pr, LANE_MARKER, body));
  summary(body);
  console.log(`Lane: ${result.lane}\n${result.reasons.join("\n")}`);
}
