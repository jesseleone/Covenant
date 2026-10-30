// Postgres connection (node-postgres). Server-only.

import pg from "pg";

// Return values in the shapes the app model uses: numbers, "YYYY-MM-DD" dates
// and ISO-8601 timestamps.
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (v) => parseFloat(v));
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => parseInt(v, 10));
pg.types.setTypeParser(pg.types.builtins.DATE, (v) => v);
pg.types.setTypeParser(pg.types.builtins.TIMESTAMPTZ, (v) => new Date(v).toISOString());

export const DEFAULT_DATABASE_URL = "postgres://postgres:postgres@localhost:5433/covenant";

const globalForPool = globalThis as unknown as { covenantPool?: pg.Pool };

/** One pool per server process (kept across dev hot reloads). */
export function pool(): pg.Pool {
  globalForPool.covenantPool ??= new pg.Pool({ connectionString: process.env.DATABASE_URL || DEFAULT_DATABASE_URL, max: 5 });
  return globalForPool.covenantPool;
}

export type Client = pg.PoolClient | pg.Client;

/** Run `fn` in a transaction; roll back if it throws. */
export async function withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>, p: pg.Pool = pool()): Promise<T> {
  const client = await p.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
