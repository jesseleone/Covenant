// Answers a chat turn on the server and streams progress as newline-delimited
// JSON events (see ChatEvent in lib/server/ai.ts).

import { answerChat, type ChatEvent } from "@/lib/server/ai";
import { currentUserId, unauthorized } from "@/lib/server/session";
import type { Scope } from "@/lib/chat";

export async function POST(req: Request) {
  const actorId = await currentUserId();
  if (!actorId) return unauthorized();
  const body = await req.json().catch(() => null);
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) return Response.json({ error: "bad_request", message: "Expected { prompt }." }, { status: 400 });
  const scope: Scope[] = Array.isArray(body.scope)
    ? body.scope.filter((s: Scope) => ["deal", "company", "person"].includes(s?.type) && typeof s.id === "string")
    : [];

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: ChatEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      try {
        await answerChat({
          actorId, prompt, scope, live: body.live !== false,
          threadId: typeof body.threadId === "string" ? body.threadId : undefined,
          title: typeof body.title === "string" && body.title.trim() ? body.title : prompt,
        }, emit);
      } catch (e) {
        emit({ type: "error", message: e instanceof Error ? e.message : "Something went wrong." });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}
