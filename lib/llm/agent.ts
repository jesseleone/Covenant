"use client";

// Client-side tool-use loop. The browser holds the data, so it runs every
// tool call itself; /api/llm only relays each turn to Claude.

import type Anthropic from "@anthropic-ai/sdk";
import type { DB } from "@/lib/schema";
import { runTool, type ToolCallRecord } from "./query-tools";
import { TOOLS } from "./tools";

type Msg = Anthropic.Beta.BetaMessageParam;
type Block = Anthropic.Beta.BetaContentBlock;

export class LiveUnavailable extends Error {
  constructor(public reason: "no_key" | "auth" | "network" | "upstream" | "rate_limited" | "refusal", message: string) {
    super(message);
  }
}

export type AgentResult = { text: string; toolCalls: ToolCallRecord[]; model?: string };

const MAX_ITERATIONS = 8;

/**
 * Run a conversation turn to completion. `history` is earlier turns as plain
 * text; the current turn's assistant content (including thinking blocks) is
 * appended unchanged on each iteration.
 */
export async function runAgent(opts: {
  db: () => DB;
  system: string;
  history: { role: "user" | "assistant"; content: string }[];
  prompt: string;
  effort?: "low" | "medium" | "high";
  onStep?: (step: { name: string; input: unknown }) => void;
  signal?: AbortSignal;
}): Promise<AgentResult> {
  const messages: Msg[] = [...opts.history.map((m) => ({ role: m.role, content: m.content })), { role: "user", content: opts.prompt }];
  const toolCalls: ToolCallRecord[] = [];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    let res: Response;
    try {
      res = await fetch("/api/llm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ system: opts.system, messages, tools: TOOLS, effort: opts.effort }),
        signal: opts.signal,
      });
    } catch (e) {
      throw new LiveUnavailable("network", e instanceof Error ? e.message : "Network error");
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const reason = data.error === "no_key" || data.error === "auth" || data.error === "rate_limited" ? data.error : "upstream";
      throw new LiveUnavailable(reason, data.message ?? `HTTP ${res.status}`);
    }

    const content = data.content as Block[];
    const stop = data.stop_reason as string;
    if (stop === "refusal") throw new LiveUnavailable("refusal", "The model declined this request.");

    const uses = content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (stop !== "tool_use" || uses.length === 0) {
      const text = content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text).join("\n\n").trim();
      return { text, toolCalls, model: data.model };
    }

    messages.push({ role: "assistant", content: content as Anthropic.Beta.BetaContentBlockParam[] });
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const u of uses) {
      opts.onStep?.({ name: u.name, input: u.input });
      const { result, record, isError } = runTool(opts.db(), u.name, u.input);
      toolCalls.push(record);
      results.push({ type: "tool_result", tool_use_id: u.id, content: JSON.stringify(result), ...(isError ? { is_error: true } : {}) });
    }
    // All results for one assistant turn go back in a single user message.
    messages.push({ role: "user", content: results });
  }
  throw new LiveUnavailable("upstream", "Stopped after too many tool calls.");
}

let liveStatus: Promise<{ configured: boolean; model: string }> | null = null;

/** Whether the server has an API key configured (cached per page load). */
export function getLiveStatus() {
  liveStatus ??= fetch("/api/llm").then((r) => r.json()).catch(() => ({ configured: false, model: "" }));
  return liveStatus;
}
