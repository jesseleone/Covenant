"use client";

// The in-browser database. One Zustand store holds every record and is saved
// to localStorage; a second, smaller store holds the signed-in persona.
//
// Writes go through named actions (the ontology's actions). Each one checks
// permissions, applies the change and appends an AuditEvent; see `commit`.

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { nanoid } from "nanoid";
import type { AuditEvent, DB, User } from "@/lib/schema";
import { buildSeed, SEED_VERSION } from "@/lib/seed";
import { can, ACTION_DENIED, type Action } from "@/lib/permissions";

// ---------------------------------------------------------------------------
// Stores
// ---------------------------------------------------------------------------

type DBState = { db: DB };

export const useDBStore = create<DBState>()(
  persist(() => ({ db: buildSeed() }), {
    name: "covenant-db-v1",
    version: SEED_VERSION,
    storage: createJSONStorage(() => localStorage),
    skipHydration: true,
    // A browser holding an older seed starts again from the current one.
    migrate: () => ({ db: buildSeed() }),
  }),
);

type SessionState = { userId: string | null };

export const useSessionStore = create<SessionState>()(
  persist(() => ({ userId: null as string | null }), {
    name: "covenant-session",
    storage: createJSONStorage(() => localStorage),
    skipHydration: true,
  }),
);

export async function hydrateStores() {
  await Promise.all([useDBStore.persist.rehydrate(), useSessionStore.persist.rehydrate()]);
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/** The whole DB. It is small, so components derive what they need from it. */
export const useDB = () => useDBStore((s) => s.db);

export function useCurrentUser(): User | null {
  const db = useDB();
  const userId = useSessionStore((s) => s.userId);
  return db.users.find((u) => u.id === userId) ?? null;
}

// ---------------------------------------------------------------------------
// Session actions
// ---------------------------------------------------------------------------

export const signIn = (userId: string) => useSessionStore.setState({ userId });
export const signOut = () => useSessionStore.setState({ userId: null });

export function resetDemoData() {
  useDBStore.setState({ db: buildSeed() });
}

// ---------------------------------------------------------------------------
// Write helpers used by the domain actions added in later steps
// ---------------------------------------------------------------------------

export type ActionResult = { ok: true } | { ok: false; error: string };

export const nowIso = () => new Date().toISOString();
export const newId = (prefix: string) => `${prefix}_${nanoid(8)}`;

/**
 * Apply `recipe` to a copy of the DB as the current user, after checking
 * `action`. The recipe returns the audit entries to append.
 */
export function commit(
  action: Action,
  recipe: (draft: DB, actor: User) => Omit<AuditEvent, "id" | "actorId" | "at">[] | ActionResult,
): ActionResult {
  const { db } = useDBStore.getState();
  const actor = db.users.find((u) => u.id === useSessionStore.getState().userId);
  if (!actor) return { ok: false, error: "Not signed in." };
  if (!can(actor.role, action)) return { ok: false, error: ACTION_DENIED[action] };

  const draft = structuredClone(db);
  const result = recipe(draft, actor);
  if (!Array.isArray(result)) return result;
  const at = nowIso();
  for (const e of result) draft.auditEvents.push({ id: newId("ae"), actorId: actor.id, at, ...e });
  useDBStore.setState({ db: draft });
  return { ok: true };
}
