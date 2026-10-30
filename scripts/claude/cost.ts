// Prints the estimated-cost line for an approval request:
//   npx tsx scripts/claude/cost.ts          → "Estimated Claude cost: ~$1.23 at API list prices — …"
//   npx tsx scripts/claude/cost.ts --json   → details per model
// Never fails: if the session can't be read, it prints "Estimated cost: unavailable".

import { estimateCost, findTranscript, readUsage } from "./session";

const UNAVAILABLE = "Estimated cost: unavailable";

export function costLine(projectDir = process.cwd()): string {
  try {
    const transcript = findTranscript(projectDir);
    const usage = transcript ? readUsage(transcript) : null;
    const cost = usage ? estimateCost(usage) : null;
    if (cost === null) return UNAVAILABLE;
    return `Estimated Claude cost: ~$${cost.toFixed(2)} at API list prices — estimate only; the Claude admin console is the source of truth`;
  } catch {
    return UNAVAILABLE;
  }
}

if (process.argv[1]?.endsWith("cost.ts")) {
  if (process.argv.includes("--json")) {
    const transcript = findTranscript();
    const usage = transcript ? readUsage(transcript) : null;
    console.log(JSON.stringify({ transcript, usage: usage?.byModel ?? null, estimateUsd: usage ? estimateCost(usage) : null }, null, 2));
  } else {
    console.log(costLine());
  }
}
