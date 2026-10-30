// CI: the "engineer-approval" required check (an addition to the lane rules;
// see docs/decisions.md). A PR counts as green only when the lane decided for
// its *latest* commit was green, its label says green, and its changed files
// still classify as green; otherwise it passes only once an engineer listed in
// .github/approvers.json has approved the latest commit. CODEOWNERS alone
// can't guarantee this: an extension-only change in the review lane is owned
// by business approvers.
//
// Env: PR_NUMBER, GH_TOKEN. Exit 0 = pass, 1 = waiting for an engineer.

import { readFileSync } from "node:fs";
import { changedFiles, ghJSON, prNumber, repo, summary } from "./github";
import { LABELS, LANE_MARKER, parseLaneRecord } from "./classify-pr";
import { classifyLane } from "./lane";

type Review = { user: { login: string } | null; state: string; commit_id: string; submitted_at: string };

/** The latest decisive review per person (approve / request changes / dismissed), on any commit. */
export function latestReviews(reviews: Review[]) {
  const latest = new Map<string, Review>();
  for (const r of [...reviews].sort((a, b) => a.submitted_at.localeCompare(b.submitted_at))) {
    if (!r.user || r.state === "COMMENTED" || r.state === "PENDING") continue;
    latest.set(r.user.login.toLowerCase(), r);
  }
  return latest;
}

export function decide(input: {
  labels: string[]; reviews: Review[]; headSha: string; engineers: string[];
  /** The lane recorded by the lane job, and the commit it was decided for. */
  record: { sha: string; lane: "green" | "review" } | null;
  files: string[];
}): { pass: boolean; message: string } {
  if (!input.record || input.record.sha !== input.headSha) {
    return { pass: false, message: "The lane hasn't been decided for the latest version yet; wait for the lane check to finish." };
  }
  const green = input.record.lane === "green" && input.labels.includes(LABELS.green) && classifyLane({ files: input.files }).lane === "green";
  if (green) return { pass: true, message: "Green lane: no engineer approval needed." };
  const latest = latestReviews(input.reviews);
  const approver = input.engineers.find((e) => {
    const r = latest.get(e.toLowerCase());
    return r?.state === "APPROVED" && r.commit_id === input.headSha;
  });
  if (approver) return { pass: true, message: `Review lane: approved by engineer @${approver} on the latest version.` };
  return { pass: false, message: `Review lane: waiting for an engineer (${input.engineers.map((e) => `@${e}`).join(", ")}) to approve the latest version.` };
}

if (process.argv[1]?.endsWith("engineer-approval.ts")) {
  const pr = prNumber();
  const info = ghJSON<{ head: { sha: string }; labels: { name: string }[] }>(["api", `repos/${repo()}/pulls/${pr}`]);
  const reviews = ghJSON<Review[][]>(["api", "--paginate", "--slurp", `repos/${repo()}/pulls/${pr}/reviews`]).flat();
  const { engineers } = JSON.parse(readFileSync(".github/approvers.json", "utf8")) as { engineers: string[] };
  const comments = ghJSON<{ body: string }[][]>(["api", "--paginate", "--slurp", `repos/${repo()}/issues/${pr}/comments`]).flat();
  const laneComment = comments.find((c) => c.body.startsWith(LANE_MARKER));
  const { pass, message } = decide({
    labels: info.labels.map((l) => l.name), reviews, headSha: info.head.sha, engineers,
    record: laneComment ? parseLaneRecord(laneComment.body) : null, files: changedFiles(pr),
  });
  summary(`${pass ? "✅" : "⏳"} ${message}`);
  console.log(message);
  process.exit(pass ? 0 : 1);
}
