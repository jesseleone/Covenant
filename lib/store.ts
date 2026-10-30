"use client";

// The browser's read cache of the database. The source of truth is Postgres
// on the server: the cache is filled from GET /api/db and replaced with the
// server's copy after every write (lib/client/actions.ts). The signed-in
// persona lives in an http-only cookie; this store mirrors its id.

import { create } from "zustand";
import type { DB, User } from "@/lib/schema";

export type { ActionResult } from "@/lib/core/commit";

/** An empty database holding just the personas (before sign-in). */
export function emptyDB(users: User[] = []): DB {
  return {
    users, companies: [], people: [], affiliations: [], deals: [], stakeholders: [], stageEvents: [], notes: [], documents: [],
    extractedFields: [], financialPeriods: [], termSets: [], tranches: [], covenants: [], ddItems: [], memos: [], memoSections: [],
    icEvents: [], icConditions: [], devilsAdvocate: [], chatThreads: [], chatMessages: [], auditEvents: [],
    settings: { coverageCushionGuidelinePct: 25, today: new Date().toISOString().slice(0, 10) },
  };
}

type DBState = { db: DB };
export const useDBStore = create<DBState>()(() => ({ db: emptyDB() }));

type SessionState = { userId: string | null };
export const useSessionStore = create<SessionState>()(() => ({ userId: null }));

/** Replace the cache with the server's copy. */
export const setDB = (db: DB) => useDBStore.setState({ db });

async function getJSON(url: string, init?: RequestInit) {
  const res = await fetch(url, { cache: "no-store", ...init });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

/** Reload the cache from the server. A lost session signs the browser out. */
export async function refreshDB() {
  const r = await getJSON("/api/db");
  if (r.status === 401) {
    useSessionStore.setState({ userId: null });
    return;
  }
  if (r.ok) setDB(r.data.db);
}

/** Load the session and, when signed in, the database. */
export async function hydrateStores() {
  const r = await getJSON("/api/session");
  if (!r.ok) throw new Error(r.data?.message ?? "The server is not available.");
  useDBStore.setState({ db: emptyDB(r.data.users) });
  useSessionStore.setState({ userId: r.data.userId });
  if (r.data.userId) await refreshDB();
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

export async function signIn(userId: string) {
  const r = await getJSON("/api/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId }) });
  if (!r.ok) throw new Error(r.data?.message ?? "Sign-in failed.");
  await refreshDB();
  useSessionStore.setState({ userId });
}

export async function signOut() {
  await getJSON("/api/session", { method: "DELETE" });
  useSessionStore.setState({ userId: null });
  useDBStore.setState((s) => ({ db: emptyDB(s.db.users) }));
}

/** Restore the seed on the server ("Reset demo data"). */
export async function resetDemoData() {
  const r = await getJSON("/api/reset", { method: "POST" });
  if (!r.ok) throw new Error(r.data?.message ?? "Reset failed.");
  setDB(r.data.db);
}
