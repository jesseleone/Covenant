// Predicts the approval lane for the work on this branch (committed or not),
// compared with main. Used by the ship-it skill before sending for approval.
//   npx tsx scripts/predict-lane.ts          → plain-English prediction
//   npx tsx scripts/predict-lane.ts --json   → { lane, extension, reasons, files }

import { execFileSync } from "node:child_process";
import { classifyLane } from "./ci/lane";

const git = (...args: string[]) => {
  try { return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { return ""; }
};

const base = git("merge-base", "HEAD", "origin/main") || git("merge-base", "HEAD", "main") || "HEAD";
const files = [
  ...git("diff", "--name-only", base).split("\n"),
  ...git("ls-files", "--others", "--exclude-standard").split("\n"),
].filter(Boolean);

const result = classifyLane({ files });
if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ ...result, files: [...new Set(files)] }, null, 2));
} else {
  const lane = result.lane === "green" ? "Green lane: one business approver" : "Review lane: an engineer reviews it";
  console.log(`${lane}. ${result.reasons.join(" ")}`);
}
