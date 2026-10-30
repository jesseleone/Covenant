// Weekly metrics for the citizen-developer process, computed from pull request
// data and written to the body of one issue titled "Weekly metrics" (created
// if missing). Run by .github/workflows/metrics.yml; locally:
//   GH_TOKEN=… npx tsx scripts/ci/metrics.ts [--dry-run]

import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { gh, ghJSON, repo, summary } from "./github";

export type PR = {
  number: number; author: string; title: string; body: string; createdAt: string; mergedAt: string | null;
  labels: string[]; isBot: boolean;
  /** Did the automatic checks pass on the first version sent? null = unknown. */
  firstPass: boolean | null;
};

const CHECKS = ["typecheck", "lint", "test", "build"];
const DAY = 86_400_000;

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "—");
const duration = (ms: number) => (ms < DAY ? `${Math.max(1, Math.round(ms / 3_600_000))} h` : `${(ms / DAY).toFixed(1)} days`);
export const costOf = (body: string) => {
  const m = /Estimated Claude cost: ~\$([0-9]+(?:\.[0-9]+)?)/.exec(body);
  return m ? Number(m[1]) : null;
};
export const isRevert = (p: PR) => /^revert\b/i.test(p.title);

export function computeMetrics(prs: PR[], engineers: string[], now: Date): string {
  const people = prs.filter((p) => !p.isBot);
  const merged = people.filter((p) => p.mergedAt);
  const weekAgo = now.getTime() - 7 * DAY;
  const thisWeek = merged.filter((p) => Date.parse(p.mergedAt!) >= weekAgo);
  const isEngineer = (login: string) => engineers.some((e) => e.toLowerCase() === login.toLowerCase());

  // Time to first safe deployment, per citizen: first change sent → first change live.
  const citizens = [...new Set(people.map((p) => p.author))].filter((a) => !isEngineer(a)).sort();
  const firstLive = citizens.map((who) => {
    const mine = people.filter((p) => p.author === who);
    const opened = Math.min(...mine.map((p) => Date.parse(p.createdAt)));
    const live = mine.filter((p) => p.mergedAt).map((p) => Date.parse(p.mergedAt!));
    return { who, ms: live.length ? Math.min(...live) - opened : null, count: mine.length };
  });

  const lane = (list: PR[], l: string) => list.filter((p) => p.labels.includes(`lane: ${l}`)).length;
  const known = people.filter((p) => p.firstPass !== null);
  const costs = merged.map((p) => costOf(p.body)).filter((c): c is number => c !== null);
  const reverts = merged.filter(isRevert);

  const lines = [
    `_Updated ${now.toISOString().slice(0, 10)} from pull request data. Updates every Monday._`,
    "",
    "| Measure | All time | Last 7 days |",
    "|---|---|---|",
    `| Changes live (merged) | ${merged.length} | ${thisWeek.length} |`,
    `| Lane mix: green / review | ${lane(merged, "green")} / ${lane(merged, "review")} | ${lane(thisWeek, "green")} / ${lane(thisWeek, "review")} |`,
    `| Passed every check the first time | ${pct(known.filter((p) => p.firstPass).length, known.length)} (${known.length} sent) | ${pct(known.filter((p) => p.firstPass && Date.parse(p.createdAt) >= weekAgo).length, known.filter((p) => Date.parse(p.createdAt) >= weekAgo).length)} |`,
    `| Reverts (changes undone) | ${reverts.length} | ${reverts.filter((p) => Date.parse(p.mergedAt!) >= weekAgo).length} |`,
    `| Average estimated Claude cost per live change | ${costs.length ? `$${(costs.reduce((a, b) => a + b, 0) / costs.length).toFixed(2)} (${costs.length} with an estimate)` : "—"} | ${(() => { const c = thisWeek.map((p) => costOf(p.body)).filter((x): x is number => x !== null); return c.length ? `$${(c.reduce((a, b) => a + b, 0) / c.length).toFixed(2)}` : "—"; })()} |`,
    "",
    "### Time to first safe deployment, per citizen developer",
    "",
    "From their first change sent for approval to their first change going live. (First use of the workspace isn't recorded, so this starts at the first approval request.)",
    "",
  ];
  if (citizens.length) {
    lines.push("| Person | Changes sent | First change live after |", "|---|---|---|");
    for (const f of firstLive) lines.push(`| @${f.who} | ${f.count} | ${f.ms === null ? "not yet" : duration(f.ms)} |`);
    const med = median(firstLive.map((f) => f.ms).filter((x): x is number => x !== null));
    lines.push("", `Median: ${med === null ? "—" : duration(med)}.`);
  } else {
    lines.push("No citizen developers have sent a change yet.");
  }
  lines.push(
    "",
    "<sub>Lane mix counts changes with a `lane:` label. First-time check results look at the first version of each change (type check, lint, tests, build). Costs are the estimates written in each approval request at API list prices; the Claude admin console has actual spend.</sub>",
  );
  return lines.join("\n");
}

// ---------------------------------------------------------------------------

type ApiPR = { number: number; user: { login: string; type: string } | null; title: string; body: string | null; created_at: string; merged_at: string | null; labels: { name: string }[] };

function firstVersionPassed(pr: number): boolean | null {
  try {
    const commits = ghJSON<{ sha: string }[][]>(["api", "--paginate", "--slurp", `repos/${repo()}/pulls/${pr}/commits`]).flat();
    if (!commits.length) return null;
    const runs = ghJSON<{ check_runs: { name: string; conclusion: string | null }[] }>(["api", `repos/${repo()}/commits/${commits[0].sha}/check-runs?per_page=100`]).check_runs;
    const ours = runs.filter((r) => CHECKS.includes(r.name));
    if (ours.length < CHECKS.length) return null;
    return ours.every((r) => r.conclusion === "success");
  } catch {
    return null;
  }
}

if (process.argv[1]?.endsWith("metrics.ts")) {
  const now = new Date();
  const api = ghJSON<ApiPR[][]>(["api", "--paginate", "--slurp", `repos/${repo()}/pulls?state=all&per_page=100`]).flat();
  const prs: PR[] = api.map((p) => ({
    number: p.number, author: p.user?.login ?? "ghost", title: p.title, body: p.body ?? "", createdAt: p.created_at, mergedAt: p.merged_at,
    labels: p.labels.map((l) => l.name), isBot: p.user?.type === "Bot",
    // Only look up check history for the last 90 days, to keep the run short.
    firstPass: now.getTime() - Date.parse(p.created_at) < 90 * DAY ? firstVersionPassed(p.number) : null,
  }));
  const { engineers } = JSON.parse(readFileSync(".github/approvers.json", "utf8")) as { engineers: string[] };
  const body = computeMetrics(prs, engineers, now);
  summary(body);

  if (process.argv.includes("--dry-run")) {
    console.log(body);
  } else {
    const TITLE = "Weekly metrics";
    const issues = ghJSON<{ number: number; title: string; state: string }[]>(["issue", "list", "--state", "all", "--search", `"${TITLE}" in:title`, "--json", "number,title,state"]);
    const existing = issues.find((i) => i.title === TITLE);
    const file = path.join(tmpdir(), "weekly-metrics.md");
    writeFileSync(file, body);
    if (!existing) gh(["issue", "create", "--title", TITLE, "--body-file", file]);
    else {
      if (existing.state !== "OPEN") gh(["issue", "reopen", String(existing.number)]);
      gh(["issue", "edit", String(existing.number), "--body-file", file]);
    }
    console.log("Weekly metrics updated.");
  }
}
