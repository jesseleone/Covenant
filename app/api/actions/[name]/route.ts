// Runs one named domain action as the signed-in user, in a transaction, and
// returns its result with the updated database.

import type { NextRequest } from "next/server";
import { isActionName, readDBFor, runAction } from "@/lib/server/run";
import { currentUserId, unauthorized } from "@/lib/server/session";

export async function POST(req: NextRequest, ctx: RouteContext<"/api/actions/[name]">) {
  const { name } = await ctx.params;
  const actorId = await currentUserId();
  if (!actorId) return unauthorized();
  if (!isActionName(name)) return Response.json({ error: "unknown_action", message: `No action named ${name}.` }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.args)) return Response.json({ error: "bad_request", message: "Expected { args: [...] }." }, { status: 400 });

  try {
    const result = await runAction(name, body.args, actorId);
    return Response.json({ result, db: await readDBFor(actorId) });
  } catch (e) {
    // Database constraints are the last line of defence (e.g. a locked term set).
    const message = e instanceof Error ? e.message : String(e);
    console.error(`Action ${name} failed:`, message);
    return Response.json({ result: { ok: false, error: `The change was not saved: ${message}` }, db: await readDBFor(actorId) }, { status: 500 });
  }
}
