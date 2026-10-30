"use client";

// The browser's handle on the domain actions. Each function has the same name
// and arguments as its server action (lib/actions.ts, lib/chat.ts), sends them
// to POST /api/actions/<name>, replaces the read cache with the server's copy
// of the database, and resolves to the action's result.

import type * as Actions from "@/lib/actions";
import type * as Chat from "@/lib/chat";
import type { ActionResult } from "@/lib/core/commit";
import type { ActionName } from "@/lib/server/run";
import { setDB } from "@/lib/store";

export { findQuote, nextIcMeeting } from "@/lib/actions";
export type { NewCompany, NewDDItem, NewDeal, NewPerson, Outcome } from "@/lib/actions";

type Fn = (...args: never[]) => unknown;

async function call<F extends Fn>(name: ActionName, args: Parameters<F>): Promise<ReturnType<F>> {
  try {
    const res = await fetch(`/api/actions/${name}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ args }),
    });
    const data = await res.json().catch(() => null);
    if (data?.db) setDB(data.db);
    if (data?.result) return data.result;
    return { ok: false, error: data?.message ?? `The server could not run ${name} (HTTP ${res.status}).` } as ReturnType<F>;
  } catch {
    return { ok: false, error: "Couldn't reach the server. Check your connection and try again." } as ReturnType<F>;
  }
}

const action = <K extends ActionName & keyof typeof Actions>(name: K) =>
  (...args: Parameters<(typeof Actions)[K]>) => call<(typeof Actions)[K]>(name, args);

export const moveStage = action("moveStage");
export const setDealOutcome = action("setDealOutcome");
export const reopenDeal = action("reopenDeal");
export const updateDealText = action("updateDealText");
export const confirmField = action("confirmField");
export const confirmAllAbove = action("confirmAllAbove");
export const correctField = action("correctField");
export const createTermSetVersion = action("createTermSetVersion");
export const saveTermSetDraft = action("saveTermSetDraft");
export const issueTermSet = action("issueTermSet");
export const discardTermSetDraft = action("discardTermSetDraft");
export const addDDItem = action("addDDItem");
export const updateDDItem = action("updateDDItem");
export const proposeIcCondition = action("proposeIcCondition");
export const updateSectionContent = action("updateSectionContent");
export const markSectionReviewed = action("markSectionReviewed");
export const markMemoReady = action("markMemoReady");
export const recordVote = action("recordVote");
export const askIcQuestion = action("askIcQuestion");
export const answerIcQuestion = action("answerIcQuestion");
export const addIcCondition = action("addIcCondition");
export const updateIcCondition = action("updateIcCondition");
export const removeIcCondition = action("removeIcCondition");
export const satisfyCondition = action("satisfyCondition");
export const decideIc = action("decideIc");
export const addNote = action("addNote");
export const createCompany = action("createCompany");
export const createPerson = action("createPerson");
export const createDeal = action("createDeal");
export const addStakeholder = action("addStakeholder");
export const removeStakeholder = action("removeStakeholder");
export const toggleNotePin = action("toggleNotePin");

export const renameThread = (...args: Parameters<typeof Chat.renameThread>) => call<typeof Chat.renameThread>("renameThread", args);
export const deleteThread = (...args: Parameters<typeof Chat.deleteThread>) => call<typeof Chat.deleteThread>("deleteThread", args);

/** Regenerate memo sections on the server (Claude when configured, offline otherwise). */
export async function regenerateMemoSections(sectionIds: string[]): Promise<{ result: ActionResult; liveCount: number; note?: string }> {
  try {
    const res = await fetch("/api/memo/regenerate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sectionIds }) });
    const data = await res.json().catch(() => null);
    if (data?.db) setDB(data.db);
    if (data?.result) return data;
    return { result: { ok: false, error: data?.message ?? `Regeneration failed (HTTP ${res.status}).` }, liveCount: 0 };
  } catch {
    return { result: { ok: false, error: "Couldn't reach the server. Check your connection and try again." }, liveCount: 0 };
  }
}

let liveStatus: Promise<{ configured: boolean; model: string }> | null = null;

/** Whether the server has an API key configured (cached per page load). */
export function getLiveStatus() {
  liveStatus ??= fetch("/api/llm").then((r) => r.json()).catch(() => ({ configured: false, model: "" }));
  return liveStatus;
}
