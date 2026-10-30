// Applies db/migrations/*.sql in name order, once each. Server-only.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { Client } from "@/lib/server/db";

export const MIGRATIONS_DIR = path.join(process.cwd(), "db", "migrations");

/** Returns the names of the migrations it applied. */
export async function migrate(client: Client, dir = MIGRATIONS_DIR): Promise<string[]> {
  await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
  const { rows } = await client.query("SELECT name FROM schema_migrations");
  const done = new Set(rows.map((r) => r.name as string));
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  const applied: string[] = [];
  for (const f of files) {
    if (done.has(f)) continue;
    await client.query("BEGIN");
    try {
      await client.query(await readFile(path.join(dir, f), "utf8"));
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [f]);
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw new Error(`Migration ${f} failed: ${e instanceof Error ? e.message : e}`);
    }
    applied.push(f);
  }
  return applied;
}

/** Drop everything (used by db:reset before migrating again). */
export async function dropAll(client: Client) {
  await client.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
}
