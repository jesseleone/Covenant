// Shared setup for database tests (*.db.test.ts). They run against a real
// Postgres: TEST_DATABASE_URL, or the local `covenant_test` database from
// compose.yaml. Outside CI the tests are skipped, with a warning, when no
// database is reachable; in CI (CI=true) a missing database fails the run.

import pg from "pg";
import { dropAll, migrate } from "@/lib/server/migrate";
import { resetData } from "@/lib/server/seed";
import "@/lib/server/db"; // registers the type parsers

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || "postgres://postgres:postgres@localhost:5433/covenant_test";
// Server code that uses the shared pool (lib/server/db.ts) talks to the test database too.
process.env.DATABASE_URL = TEST_DATABASE_URL;

export async function databaseAvailable(): Promise<boolean> {
  const c = new pg.Client({ connectionString: TEST_DATABASE_URL, connectionTimeoutMillis: 2000 });
  try {
    await c.connect();
    await c.end();
    return true;
  } catch (e) {
    if (process.env.CI) throw new Error(`Test database not reachable at ${TEST_DATABASE_URL}: ${e instanceof Error ? e.message : e}`);
    console.warn(`\n⚠ Skipping database tests: no Postgres at ${TEST_DATABASE_URL}. Run \`docker compose up -d db\` to include them.\n`);
    return false;
  }
}

export const hasDB = await databaseAvailable();

export function testPool() {
  return new pg.Pool({ connectionString: TEST_DATABASE_URL, max: 3 });
}

/** Drop, migrate and seed the test database. */
export async function freshDatabase(p: pg.Pool) {
  const c = await p.connect();
  try {
    await dropAll(c);
    await migrate(c);
    await c.query("BEGIN");
    await resetData(c);
    await c.query("COMMIT");
  } finally {
    c.release();
  }
}

/** Re-seed between tests (faster than migrating again). */
export async function reseed(p: pg.Pool) {
  const c = await p.connect();
  try {
    await c.query("BEGIN");
    await resetData(c);
    await c.query("COMMIT");
  } finally {
    c.release();
  }
}
