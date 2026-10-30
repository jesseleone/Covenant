// Regenerates memo sections (Claude when configured, offline otherwise) and
// returns the result with the updated database.

import { regenerateMemo } from "@/lib/server/ai";
import { readDB } from "@/lib/server/run";
import { currentUserId, unauthorized } from "@/lib/server/session";

export async function POST(req: Request) {
  const actorId = await currentUserId();
  if (!actorId) return unauthorized();
  const body = await req.json().catch(() => null);
  const ids: unknown = body?.sectionIds;
  if (!Array.isArray(ids) || !ids.every((x) => typeof x === "string")) {
    return Response.json({ error: "bad_request", message: "Expected { sectionIds: string[] }." }, { status: 400 });
  }
  const r = await regenerateMemo(actorId, ids);
  return Response.json({ ...r, db: await readDB() });
}
