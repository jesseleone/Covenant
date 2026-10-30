// npm run db:migrate | db:seed | db:reset | db:setup
//   migrate  apply new files in db/migrations
//   seed     load the demo data (replaces whatever data is there)
//   reset    drop everything, migrate, seed
//   setup    migrate, then seed only if the database is empty (container start)
// Uses DATABASE_URL (from the environment or .env.local).

import { loadEnvConfig } from "@next/env";
import pg from "pg";
import { DEFAULT_DATABASE_URL } from "@/lib/server/db";
import { dropAll, migrate } from "@/lib/server/migrate";
import { resetData, seedIfEmpty } from "@/lib/server/seed";

loadEnvConfig(process.cwd());

async function main() {
  const command = process.argv[2];
  if (!["migrate", "seed", "reset", "setup"].includes(command)) {
    console.error("Usage: tsx scripts/db.ts <migrate|seed|reset|setup>");
    process.exit(2);
  }
  const url = process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
  const client = new pg.Client({ connectionString: url });
  try {
    await client.connect();
  } catch (e) {
    console.error(`Could not connect to Postgres at ${url.replace(/:[^:@/]+@/, ":***@")}.`);
    console.error("Start it with `docker compose up -d db` (or open the dev container), then try again.");
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
  try {
    if (command === "reset") {
      await dropAll(client);
      console.log("Dropped all tables.");
    }
    if (command === "migrate" || command === "reset" || command === "setup") {
      const applied = await migrate(client);
      console.log(applied.length ? `Applied ${applied.join(", ")}` : "Migrations up to date.");
    }
    if (command === "setup") {
      await client.query("BEGIN");
      const seeded = await seedIfEmpty(client);
      await client.query("COMMIT");
      console.log(seeded ? "Seeded demo data." : "Data already present; not seeding.");
    }
    if (command === "seed" || command === "reset") {
      await client.query("BEGIN");
      await resetData(client);
      await client.query("COMMIT");
      const { rows } = await client.query("SELECT (SELECT count(*) FROM deal) AS deals, (SELECT count(*) FROM company) AS companies, (SELECT count(*) FROM person) AS people");
      console.log(`Seeded demo data: ${rows[0].deals} deals, ${rows[0].companies} companies, ${rows[0].people} people.`);
    }
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
