// Whether live AI is available (the server has an API key). Chat and memo
// regeneration call Claude from the server (lib/server/ai.ts).

import { MODEL, liveConfigured } from "@/lib/llm/agent";

export function GET() {
  return Response.json({ configured: liveConfigured(), model: MODEL });
}
