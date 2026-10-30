// CI: the "engineer-approval" required check (an addition to the lane rules;
// see docs/decisions.md). It runs as a job in the same workflow run as the
// lane job and takes the lane from that job's output, so nothing outside the
// run can influence it: not labels, comments or check runs. Green-lane
// changes pass. Anything else (review lane, or no lane at all) passes only
// once an engineer listed in .github/approvers.json has approved the latest
// commit. CODEOWNERS alone can't guarantee this: an extension-only change in
// the review lane is owned by business approvers.
//
// Env: PR_NUMBER, LANE ("green" | "review" | ""), GH_TOKEN.
// Exit 0 = pass, 1 = waiting for an engineer.

import { readFileSync } from "node:fs";
import { ghJSON, prNumber, repo, summary } from "./github";

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

export function decide(input: { lane: string; reviews: Review[]; headSha: string; engineers: string[] }): { pass: boolean; message: string } {
  if (input.lane === "green") return { pass: true, message: "Green lane: no engineer approval needed." };
  const latest = latestReviews(input.reviews);
  const approver = input.engineers.find((e) => {
    const r = latest.get(e.toLowerCase());
    return r?.state === "APPROVED" && r.commit_id === input.headSha;
  });
  const what = input.lane === "review" ? "Review lane" : "The lane couldn't be decided, so this is treated as review lane";
  if (approver) return { pass: true, message: `${what}: approved by engineer @${approver} on the latest version.` };
  return { pass: false, message: `${what}: waiting for an engineer (${input.engineers.map((e) => `@${e}`).join(", ")}) to approve the latest version.` };
}

if (process.argv[1]?.endsWith("engineer-approval.ts")) {
  const pr = prNumber();
  const info = ghJSON<{ head: { sha: string } }>(["api", `repos/${repo()}/pulls/${pr}`]);
  const reviews = ghJSON<Review[][]>(["api", "--paginate", "--slurp", `repos/${repo()}/pulls/${pr}/reviews`]).flat();
  const { engineers } = JSON.parse(readFileSync(".github/approvers.json", "utf8")) as { engineers: string[] };
  const { pass, message } = decide({ lane: (process.env.LANE ?? "").trim(), reviews, headSha: info.head.sha, engineers });
  summary(`${pass ? "✅" : "⏳"} ${message}`);
  console.log(message);
  process.exit(pass ? 0 : 1);
}
