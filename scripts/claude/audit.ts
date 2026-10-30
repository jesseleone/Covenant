// Prints the audit record for an AI-authored change:
//   npx tsx scripts/claude/audit.ts            → the block for the approval request
//   npx tsx scripts/claude/audit.ts --trailers → the same, as commit trailers
// "Directed by" is the person signed in to GitHub (falls back to git's user
// name); "Model" is the model that wrote most recently in this session.

import { execFileSync } from "node:child_process";
import { findTranscript, readUsage } from "./session";

function sh(cmd: string, args: string[]): string {
  try { return execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { return ""; }
}

export function directedBy(): string {
  const gh = sh("gh", ["api", "user", "--jq", '[.name // "", .login] | @tsv']);
  if (gh) {
    const [name, login] = gh.split("\t");
    return name ? `${name} (@${login})` : `@${login}`;
  }
  return sh("git", ["config", "user.name"]) || "unknown";
}

export function modelId(): string {
  try {
    const t = findTranscript();
    return (t && readUsage(t)?.lastModel) || "unknown";
  } catch {
    return "unknown";
  }
}

if (process.argv[1]?.endsWith("audit.ts")) {
  const who = directedBy();
  const model = modelId();
  if (process.argv.includes("--trailers")) {
    console.log(`AI-authored: yes\nDirected-by: ${who}\nModel: ${model}`);
  } else {
    console.log(`AI-authored: yes; Directed by: ${who}; Model: ${model}`);
  }
}
