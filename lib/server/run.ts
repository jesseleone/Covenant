// Runs the named domain actions on the server. Each call is one transaction:
// lock, load the database, run the action (which checks the actor's
// permission and appends audit events), write the rows that changed, commit.
// Server-only.

import * as actions from "@/lib/actions";
import { renameThread, deleteThread } from "@/lib/chat";
import { withContext, type DataContext } from "@/lib/core/commit";
import type { DB } from "@/lib/schema";
import { pool, withTransaction, type Client } from "@/lib/server/db";
import { loadDB, saveDiff } from "@/lib/server/repo";
import type pg from "pg";

/**
 * The actions the browser may call by name. Everything here goes through
 * `commit` (permission check + audit) or, for chat, an ownership check.
 */
export const ACTIONS = {
  moveStage: actions.moveStage,
  setDealOutcome: actions.setDealOutcome,
  reopenDeal: actions.reopenDeal,
  updateDealText: actions.updateDealText,
  confirmField: actions.confirmField,
  confirmAllAbove: actions.confirmAllAbove,
  correctField: actions.correctField,
  createTermSetVersion: actions.createTermSetVersion,
  saveTermSetDraft: actions.saveTermSetDraft,
  issueTermSet: actions.issueTermSet,
  discardTermSetDraft: actions.discardTermSetDraft,
  addDDItem: actions.addDDItem,
  updateDDItem: actions.updateDDItem,
  proposeIcCondition: actions.proposeIcCondition,
  regenerateSections: actions.regenerateSections,
  updateSectionContent: actions.updateSectionContent,
  markSectionReviewed: actions.markSectionReviewed,
  markMemoReady: actions.markMemoReady,
  recordVote: actions.recordVote,
  askIcQuestion: actions.askIcQuestion,
  answerIcQuestion: actions.answerIcQuestion,
  addIcCondition: actions.addIcCondition,
  updateIcCondition: actions.updateIcCondition,
  removeIcCondition: actions.removeIcCondition,
  satisfyCondition: actions.satisfyCondition,
  decideIc: actions.decideIc,
  addNote: actions.addNote,
  createCompany: actions.createCompany,
  createPerson: actions.createPerson,
  createDeal: actions.createDeal,
  addStakeholder: actions.addStakeholder,
  removeStakeholder: actions.removeStakeholder,
  toggleNotePin: actions.toggleNotePin,
  renameThread,
  deleteThread,
} as const;

export type ActionName = keyof typeof ACTIONS;

export const isActionName = (name: string): name is ActionName => Object.hasOwn(ACTIONS, name);

// Writes are serialized: the demo database is small, so one lock is simplest.
const WRITE_LOCK = 72_771;

/**
 * Run `fn` against the current database as `actorId`, inside one transaction,
 * and save what it changed. `fn` must be synchronous (actions are).
 */
export async function runWithDB<T>(actorId: string | null, fn: () => T, p: pg.Pool = pool()): Promise<T> {
  return withTransaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock($1)", [WRITE_LOCK]);
    const before = await loadDB(client);
    const ctx: DataContext = { db: before, actorId };
    const result = withContext(ctx, fn);
    if (ctx.db !== before) await saveDiff(client, before, ctx.db);
    return result;
  }, p);
}

/** Run a named action with JSON arguments. */
export function runAction(name: ActionName, args: unknown[], actorId: string, p?: pg.Pool) {
  const fn = ACTIONS[name] as (...a: unknown[]) => unknown;
  return runWithDB(actorId, () => fn(...args), p);
}

/** A read-only snapshot of the database. */
export async function readDB(client?: Client): Promise<DB> {
  if (client) return loadDB(client);
  const c = await pool().connect();
  try {
    await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const db = await loadDB(c);
    await c.query("COMMIT");
    return db;
  } finally {
    c.release();
  }
}
