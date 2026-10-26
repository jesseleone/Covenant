// Thin proxy to the Claude Messages API. It holds no data: the browser sends
// the conversation and tool definitions, runs the tools against its own
// store, and calls back with the results (see lib/llm/agent.ts).

import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";

type Body = {
  system: string;
  messages: Anthropic.Beta.BetaMessageParam[];
  tools: Anthropic.Beta.BetaTool[];
  effort?: "low" | "medium" | "high";
};

/** Lets the UI show whether live mode is available. */
export function GET() {
  return Response.json({ configured: !!process.env.ANTHROPIC_API_KEY, model: MODEL });
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: "no_key" }, { status: 503 });

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request", message: "Body must be JSON." }, { status: 400 });
  }
  if (typeof body.system !== "string" || !Array.isArray(body.messages) || !Array.isArray(body.tools) || body.messages.length === 0) {
    return Response.json({ error: "bad_request", message: "Expected { system, messages, tools }." }, { status: 400 });
  }

  const client = new Anthropic();
  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: body.system,
      messages: body.messages,
      tools: body.tools,
      output_config: { effort: body.effort ?? "medium" },
      // On a policy decline, the API retries on a suitable fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });
    return Response.json({ content: response.content, stop_reason: response.stop_reason, model: response.model, usage: response.usage });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
      return Response.json({ error: "auth", message: "The configured API key was rejected." }, { status: 401 });
    }
    if (error instanceof Anthropic.RateLimitError) {
      return Response.json({ error: "rate_limited", message: "Rate limited; try again shortly." }, { status: 429 });
    }
    if (error instanceof Anthropic.BadRequestError) {
      return Response.json({ error: "bad_request", message: error.message }, { status: 400 });
    }
    if (error instanceof Anthropic.APIError) {
      return Response.json({ error: "upstream", message: error.message }, { status: 502 });
    }
    return Response.json({ error: "upstream", message: error instanceof Error ? error.message : "Unknown error" }, { status: 502 });
  }
}
