// The whole database, for the signed-in browser's read cache.

import { readDB } from "@/lib/server/run";
import { currentUserId, unauthorized } from "@/lib/server/session";

export async function GET() {
  if (!(await currentUserId())) return unauthorized();
  return Response.json({ db: await readDB() });
}
