// Small helpers for the CI scripts: call the GitHub CLI (`gh`, preinstalled on
// GitHub's runners, authenticated with GH_TOKEN) and keep one comment per
// purpose on a pull request, updated in place rather than duplicated.

import { execFileSync } from "node:child_process";
import { appendFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

export const repo = () => process.env.GITHUB_REPOSITORY ?? "jesseleone/Covenant";

export function gh(args: string[], input?: string): string {
  return execFileSync("gh", args, { encoding: "utf8", input, stdio: [input === undefined ? "ignore" : "pipe", "pipe", "inherit"], maxBuffer: 64 * 1024 * 1024 }).trim();
}

export function ghJSON<T>(args: string[]): T {
  return JSON.parse(gh(args) || "null") as T;
}

/** Changed file paths in a pull request. */
export function changedFiles(pr: number): string[] {
  const pages = ghJSON<{ filename: string }[][]>(["api", "--paginate", "--slurp", `repos/${repo()}/pulls/${pr}/files`]);
  return pages.flat().map((f) => f.filename);
}

/** Create or update the single comment that starts with `marker`. */
export function upsertComment(pr: number, marker: string, body: string) {
  const text = `${marker}\n${body}`;
  const pages = ghJSON<{ id: number; body: string }[][]>(["api", "--paginate", "--slurp", `repos/${repo()}/issues/${pr}/comments`]);
  const existing = pages.flat().find((c) => c.body.startsWith(marker));
  const file = path.join(tmpdir(), `comment-${Date.now()}.json`);
  writeFileSync(file, JSON.stringify({ body: text }));
  if (existing) gh(["api", "-X", "PATCH", `repos/${repo()}/issues/comments/${existing.id}`, "--input", file]);
  else gh(["api", "-X", "POST", `repos/${repo()}/issues/${pr}/comments`, "--input", file]);
}

/** Set a step output (for later jobs or steps). */
export function setOutput(name: string, value: string) {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${name}<<__EOF__\n${value}\n__EOF__\n`);
  else console.log(`${name}=${value}`);
}

/** Add a line to the job summary shown on the workflow run page. */
export function summary(markdown: string) {
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown + "\n");
}

export const prNumber = () => {
  const n = Number(process.env.PR_NUMBER);
  if (!n) throw new Error("PR_NUMBER is not set");
  return n;
};
