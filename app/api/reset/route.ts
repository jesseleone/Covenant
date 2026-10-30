// "Reset demo data": empty every table and load the seed again.

import { withTransaction } from "@/lib/server/db";
import { readDB } from "@/lib/server/run";
import { resetData } from "@/lib/server/seed";
import { currentUserId, unauthorized } from "@/lib/server/session";

export async function POST() {
  if (!(await currentUserId())) return unauthorized();
  await withTransaction((client) => resetData(client));
  return Response.json({ db: await readDB() });
}
