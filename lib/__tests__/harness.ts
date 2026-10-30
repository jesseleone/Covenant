// In-memory data context for unit-testing the domain actions without a
// database. The same actions run against Postgres in server.db.test.ts.

import { setFallbackContext, type DataContext } from "@/lib/core/commit";
import { buildSeed } from "@/lib/seed";
import type { DB } from "@/lib/schema";

const ctx: DataContext = { db: buildSeed(), actorId: null };
setFallbackContext(ctx);

export const resetDemoData = () => { ctx.db = buildSeed(); };
export const signIn = (userId: string) => { ctx.actorId = userId; };

/** Same shape as the old Zustand store, so tests read naturally. */
export const useDBStore = {
  getState: () => ({ db: ctx.db }),
  setState: ({ db }: { db: DB }) => { ctx.db = db; },
};
