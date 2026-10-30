// The whole database, for the signed-in browser's read cache.

import { readDBFor } from "@/lib/server/run";
import { currentUserId, unauthorized } from "@/lib/server/session";

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  return Response.json({ db: await readDBFor(userId) });
}
