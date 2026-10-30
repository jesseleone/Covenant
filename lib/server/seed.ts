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

/**
 * "Reset demo data" wipes every table, so it's only allowed on demo servers:
 * on by default in development (and Codespaces), off in production unless
 * COVENANT_ALLOW_RESET=1. COVENANT_ALLOW_RESET=0 switches it off anywhere.
 */
export function resetAllowed(env: Record<string, string | undefined> = process.env): boolean {
  if (env.COVENANT_ALLOW_RESET === "1") return true;
  if (env.COVENANT_ALLOW_RESET === "0") return false;
  return env.NODE_ENV !== "production";
}

/** Record who reset the data, after the seed is loaded. */
export async function auditReset(client: Client, actorId: string) {
  await client.query(
    "INSERT INTO audit_event (id, actor_id, action, entity_type, entity_id, at, summary) VALUES ($1, $2, 'demo.reset', 'database', 'all', now(), 'Reset all data to the demo seed')",
    [`ae_reset_${Date.now().toString(36)}`, actorId],
  );
}
