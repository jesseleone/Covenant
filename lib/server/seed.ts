// Loads the demo data (the same `buildSeed()` the Task 1 prototype used) into
// Postgres. Server-only.

import { buildSeed } from "@/lib/seed";
import type { Client } from "@/lib/server/db";
import { insertAll, TABLES } from "@/lib/server/repo";

/** Empty every table and insert the seed. Run inside a transaction. */
export async function resetData(client: Client) {
  await client.query(`TRUNCATE ${TABLES.join(", ")} RESTART IDENTITY CASCADE`);
  await insertAll(client, buildSeed());
}

/** Seed only if the database is empty; returns whether it seeded. */
export async function seedIfEmpty(client: Client): Promise<boolean> {
  const { rows } = await client.query("SELECT count(*)::int AS n FROM deal");
  if (rows[0].n > 0) return false;
  await resetData(client);
  return true;
}
