// "Reset demo data": empty every table and load the seed again. Demo servers
// only (see resetAllowed); each reset is recorded in the audit trail.

import { withTransaction } from "@/lib/server/db";
import { readDBFor } from "@/lib/server/run";
import { auditReset, resetAllowed, resetData } from "@/lib/server/seed";
import { currentUserId, unauthorized } from "@/lib/server/session";

export async function POST() {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  if (!resetAllowed()) {
    return Response.json({ error: "reset_disabled", message: "Resetting the data is switched off on this server." }, { status: 403 });
  }
  await withTransaction(async (client) => {
    await resetData(client);
    await auditReset(client, userId);
  });
  return Response.json({ db: await readDBFor(userId) });
}
