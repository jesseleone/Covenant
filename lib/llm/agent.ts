// Server-side tool-use loop. Claude is given the 14 query tools; each call
// runs against a snapshot of the database and the result goes back to Claude
// until it answers. Server-only (it holds the API key).

import Anthropic from "@anthropic-ai/sdk";
import type { DB } from "@/lib/schema";
import { runTool, type ToolCallRecord } from "./query-tools";
import { TOOLS } from "./tools";

type Msg = Anthropic.Beta.BetaMessageParam;

export const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
export const liveConfigured = () => !!process.env.ANTHROPIC_API_KEY;

export class LiveUnavailable extends Error {
  constructor(public reason: "no_key" | "auth" | "network" | "upstream" | "rate_limited" | "refusal", message: string) {
    super(message);
  }
}

export type AgentResult = { text: string; toolCalls: ToolCallRecord[]; model?: string };

const MAX_ITERATIONS = 8;

async function createMessage(system: string, messages: Msg[], effort: "low" | "medium" | "high") {
  if (!liveConfigured()) throw new LiveUnavailable("no_key", "No API key configured.");
  try {
    return await new Anthropic().beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system,
      messages,
      tools: TOOLS,
      output_config: { effort },
      // On a policy decline, the API retries on a suitable fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) throw new LiveUnavailable("auth", "The configured API key was rejected.");
    if (error instanceof Anthropic.RateLimitError) throw new LiveUnavailable("rate_limited", "Rate limited; try again shortly.");
    if (error instanceof Anthropic.APIConnectionError) throw new LiveUnavailable("network", error.message);
    if (error instanceof Anthropic.APIError) throw new LiveUnavailable("upstream", error.message);
    throw new LiveUnavailable("upstream", error instanceof Error ? error.message : "Unknown error");
  }
}

/**
 * Run a conversation turn to completion. `history` is earlier turns as plain
 * text; the current turn's assistant content (including thinking blocks) is
 * appended unchanged on each iteration.
 */
export async function runAgent(opts: {
  db: DB;
  system: string;
  history: { role: "user" | "assistant"; content: string }[];
  prompt: string;
  effort?: "low" | "medium" | "high";
  onStep?: (step: { name: string; input: unknown }) => void;
}): Promise<AgentResult> {
  const messages: Msg[] = [...opts.history.map((m) => ({ role: m.role, content: m.content })), { role: "user", content: opts.prompt }];
  const toolCalls: ToolCallRecord[] = [];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const res = await createMessage(opts.system, messages, opts.effort ?? "medium");
    if (res.stop_reason === "refusal") throw new LiveUnavailable("refusal", "The model declined this request.");

    const uses = res.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (res.stop_reason !== "tool_use" || uses.length === 0) {
      const text = res.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text).join("\n\n").trim();
      return { text, toolCalls, model: res.model };
    }

    messages.push({ role: "assistant", content: res.content as Anthropic.Beta.BetaContentBlockParam[] });
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const u of uses) {
      opts.onStep?.({ name: u.name, input: u.input });
      const { result, record, isError } = runTool(opts.db, u.name, u.input);
      toolCalls.push(record);
      results.push({ type: "tool_result", tool_use_id: u.id, content: JSON.stringify(result), ...(isError ? { is_error: true } : {}) });
    }
    // All results for one assistant turn go back in a single user message.
    messages.push({ role: "user", content: results });
  }
  throw new LiveUnavailable("upstream", "Stopped after too many tool calls.");
}
