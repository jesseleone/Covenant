// The write path every domain action goes through. Actions are plain,
// synchronous functions over a `DB` object; they run on the server, against a
// copy of the database loaded inside a transaction (see lib/server/run.ts).
// Tests run them against an in-memory copy instead (lib/__tests__/harness.ts).

import { nanoid } from "nanoid";
import type { AuditEvent, DB, User } from "@/lib/schema";
import { can, ACTION_DENIED, type Action } from "@/lib/permissions";

export type ActionResult = { ok: true } | { ok: false; error: string };

export const nowIso = () => new Date().toISOString();
export const newId = (prefix: string) => `${prefix}_${nanoid(8)}`;

/** The database an action reads and replaces, and who is acting. */
export type DataContext = { db: DB; actorId: string | null };

let current: DataContext | null = null;
let fallback: DataContext | null = null;

/** Run `fn` with `ctx` as the data context. Actions are synchronous, so this is safe. */
export function withContext<T>(ctx: DataContext, fn: () => T): T {
  const prev = current;
  current = ctx;
  try {
    return fn();
  } finally {
    current = prev;
  }
}

/** For tests: the context used when no `withContext` call is active. */
export function setFallbackContext(ctx: DataContext | null) {
  fallback = ctx;
}

function context(): DataContext {
  const ctx = current ?? fallback;
  if (!ctx) throw new Error("No data context: domain actions run on the server (POST /api/actions/<name>).");
  return ctx;
}

/**
 * Apply `recipe` to a copy of the DB as the current user, after checking
 * `action`. The recipe returns the audit entries to append.
 */
export function commit(
  action: Action,
  recipe: (draft: DB, actor: User) => Omit<AuditEvent, "id" | "actorId" | "at">[] | ActionResult,
): ActionResult {
  const ctx = context();
  const actor = ctx.db.users.find((u) => u.id === ctx.actorId);
  if (!actor) return { ok: false, error: "Not signed in." };
  if (!can(actor.role, action)) return { ok: false, error: ACTION_DENIED[action] };

  const draft = structuredClone(ctx.db);
  const result = recipe(draft, actor);
  if (!Array.isArray(result)) return result;
  const at = nowIso();
  for (const e of result) draft.auditEvents.push({ id: newId("ae"), actorId: actor.id, at, ...e });
  ctx.db = draft;
  return { ok: true };
}

/**
 * Personal, unaudited writes (chat threads and messages). Domain records go
 * through `commit` instead.
 */
export function mutate(recipe: (draft: DB, actorId: string | null) => void) {
  const ctx = context();
  const draft = structuredClone(ctx.db);
  recipe(draft, ctx.actorId);
  ctx.db = draft;
}
