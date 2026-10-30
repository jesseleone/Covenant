// Reads Claude Code's local session transcript (one JSON object per line in
// ~/.claude/projects/<project>/<session>.jsonl) and adds up token usage per
// model. Used for the estimated-cost line and the audit block in approval
// requests. The transcript format isn't a public contract, so every caller
// must cope with `null` ("unavailable").

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

export type ModelUsage = { input: number; output: number; cacheWrite5m: number; cacheWrite1h: number; cacheRead: number; messages: number };
export type SessionUsage = { transcript: string; byModel: Record<string, ModelUsage>; lastModel: string | null };

/** Claude Code names a project's transcript folder after its path, with every other character turned into "-". */
export const projectFolderName = (dir: string) => dir.replace(/[^A-Za-z0-9]/g, "-");

/** The transcript of the current (most recently active) session for this project. */
export function findTranscript(projectDir = process.cwd()): string | null {
  if (process.env.CLAUDE_TRANSCRIPT && existsSync(process.env.CLAUDE_TRANSCRIPT)) return process.env.CLAUDE_TRANSCRIPT;
  const root = path.join(process.env.CLAUDE_CONFIG_DIR || path.join(homedir(), ".claude"), "projects", projectFolderName(path.resolve(projectDir)));
  if (!existsSync(root)) return null;
  const files = readdirSync(root).filter((f) => f.endsWith(".jsonl")).map((f) => path.join(root, f));
  if (files.length === 0) return null;
  return files.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
}

type Usage = {
  input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number;
  cache_creation?: { ephemeral_5m_input_tokens?: number; ephemeral_1h_input_tokens?: number };
};

/** Usage files for a session: the main transcript plus any subagent transcripts beside it. */
function sessionFiles(transcript: string): string[] {
  const sub = path.join(transcript.replace(/\.jsonl$/, ""), "subagents");
  const extra = existsSync(sub) ? readdirSync(sub).filter((f) => f.endsWith(".jsonl")).map((f) => path.join(sub, f)) : [];
  return [transcript, ...extra];
}

export function readUsage(transcript: string): SessionUsage | null {
  // One API response can appear on several lines (one per content block), each
  // carrying the same usage; count each message id once, using its last line.
  const byId = new Map<string, { model: string; usage: Usage }>();
  let lastModel: string | null = null;
  for (const file of sessionFiles(transcript)) {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      if (!line.includes('"usage"')) continue;
      let entry: { type?: string; message?: { id?: string; model?: string; usage?: Usage } };
      try { entry = JSON.parse(line); } catch { continue; }
      const m = entry.message;
      if (entry.type !== "assistant" || !m?.usage || !m.model || m.model === "<synthetic>") continue;
      byId.set(m.id ?? `${file}:${byId.size}`, { model: m.model, usage: m.usage });
      if (file === transcript) lastModel = m.model;
    }
  }
  if (byId.size === 0) return null;

  const byModel: Record<string, ModelUsage> = {};
  for (const { model, usage: u } of byId.values()) {
    const t = (byModel[model] ??= { input: 0, output: 0, cacheWrite5m: 0, cacheWrite1h: 0, cacheRead: 0, messages: 0 });
    t.input += u.input_tokens ?? 0;
    t.output += u.output_tokens ?? 0;
    t.cacheRead += u.cache_read_input_tokens ?? 0;
    const w5 = u.cache_creation?.ephemeral_5m_input_tokens, w1 = u.cache_creation?.ephemeral_1h_input_tokens;
    if (w5 === undefined && w1 === undefined) t.cacheWrite5m += u.cache_creation_input_tokens ?? 0;
    else { t.cacheWrite5m += w5 ?? 0; t.cacheWrite1h += w1 ?? 0; }
    t.messages++;
  }
  return { transcript, byModel, lastModel };
}

// List prices in US$ per million tokens (input, output, cache read). Cache
// writes cost 1.25x input (5-minute) or 2x input (1-hour). Update when
// Anthropic's prices change; unknown models make the estimate "unavailable".
export const PRICES: { prefix: string; input: number; output: number; cacheRead: number }[] = [
  { prefix: "claude-fable-5-1", input: 10, output: 50, cacheRead: 0.25 },
  { prefix: "claude-fable-5", input: 10, output: 50, cacheRead: 1 },
  { prefix: "claude-mythos-5", input: 10, output: 50, cacheRead: 1 },
  { prefix: "claude-opus-5-5", input: 4, output: 20, cacheRead: 0.2 },
  { prefix: "claude-opus-5", input: 5, output: 25, cacheRead: 0.5 },
  { prefix: "claude-opus-4", input: 5, output: 25, cacheRead: 0.5 },
  { prefix: "claude-sonnet-5", input: 2, output: 10, cacheRead: 0.2 },
  { prefix: "claude-sonnet-4", input: 3, output: 15, cacheRead: 0.3 },
  { prefix: "claude-haiku-5-5", input: 0.1, output: 0.5, cacheRead: 0.01 },
  { prefix: "claude-haiku-4-5", input: 1, output: 5, cacheRead: 0.1 },
];

export const priceFor = (model: string) => PRICES.find((p) => model.startsWith(p.prefix));

/** Estimated cost in US$, or null when any model's price is unknown. */
export function estimateCost(usage: SessionUsage): number | null {
  let total = 0;
  for (const [model, u] of Object.entries(usage.byModel)) {
    const p = priceFor(model);
    if (!p) return null;
    total += (u.input * p.input + u.output * p.output + u.cacheRead * p.cacheRead + u.cacheWrite5m * p.input * 1.25 + u.cacheWrite1h * p.input * 2) / 1e6;
  }
  return total;
}
