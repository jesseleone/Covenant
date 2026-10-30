// Chat answers and memo regeneration, on the server. Claude (or the offline
// engine, without an API key) answers from a snapshot of the database; the
// results are saved through the same write path as every other change.
// Server-only.

import { addChatMessage, createThread, scopeName, type Scope } from "@/lib/chat";
import { regenerateSections } from "@/lib/actions";
import type { ActionResult } from "@/lib/core/commit";
import { LiveUnavailable, liveConfigured, runAgent } from "@/lib/llm/agent";
import { answerOffline } from "@/lib/llm/offline";
import { chatSystemPrompt, memoSystemPrompt } from "@/lib/llm/prompts";
import { staleReasons, typedFigures } from "@/lib/memo";
import { can } from "@/lib/permissions";
import type { DB, MemoSection } from "@/lib/schema";
import { readDB, runWithDB } from "@/lib/server/run";

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

export type ChatEvent =
  | { type: "thread"; id: string }
  | { type: "step"; name: string }
  | { type: "fallback"; message: string; disableLive: boolean }
  | { type: "done"; mode: "live" | "offline" }
  | { type: "error"; message: string };

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Answer one chat turn, reporting progress through `emit`. A new thread is
 * created when `threadId` is missing. `live: false` (or no API key) answers
 * offline; live failures fall back to offline.
 */
export async function answerChat(
  req: { actorId: string; threadId?: string; title: string; prompt: string; scope: Scope[]; live: boolean },
  emit: (e: ChatEvent) => void,
) {
  const { actorId, prompt, scope } = req;
  let threadId = req.threadId;
  if (threadId) {
    const db = await readDB();
    if (!db.chatThreads.some((t) => t.id === threadId && t.ownerId === actorId)) return emit({ type: "error", message: "Chat not found." });
  } else {
    threadId = await runWithDB(actorId, () => createThread(req.title, scope));
  }
  const id = threadId;
  await runWithDB(actorId, () => addChatMessage(id, { role: "user", content: prompt }));
  emit({ type: "thread", id });

  const db = await readDB();
  const user = db.users.find((u) => u.id === actorId)!;
  // Earlier turns of this thread, without the question just added.
  const history = db.chatMessages.filter((m) => m.threadId === id).slice(0, -1).map((m) => ({ role: m.role, content: m.content }));

  const offline = async () => {
    const a = answerOffline(db, prompt, scope);
    // A short pause per query so the trace reads as work being done.
    for (const c of a.toolCalls) { emit({ type: "step", name: c.name }); await pause(140); }
    await runWithDB(actorId, () => addChatMessage(id, { role: "assistant", content: a.text, toolCalls: a.toolCalls, mode: "offline" }));
    emit({ type: "done", mode: "offline" });
  };

  if (!req.live || !liveConfigured()) return offline();
  try {
    const scopeNote = scope.length ? `\n\n(Scope: ${scope.map((s) => scopeName(db, s)).join(", ")})` : "";
    const r = await runAgent({
      db, system: chatSystemPrompt(db, user, scope), history, prompt: prompt + scopeNote,
      onStep: (s) => emit({ type: "step", name: s.name }),
    });
    await runWithDB(actorId, () => addChatMessage(id, { role: "assistant", content: r.text || "_No answer returned._", toolCalls: r.toolCalls, mode: "live" }));
    emit({ type: "done", mode: "live" });
  } catch (e) {
    if (!(e instanceof LiveUnavailable)) throw e;
    emit({
      type: "fallback",
      message: e.reason === "auth" ? "The API key was rejected; using offline mode." : `Live AI unavailable (${e.message}).`,
      disableLive: e.reason === "auth" || e.reason === "no_key",
    });
    await offline();
  }
}

// ---------------------------------------------------------------------------
// Memo regeneration
// ---------------------------------------------------------------------------

/**
 * Ask Claude to rewrite one section from current records. Typed figures are
 * sent back once for correction; a second failure raises so the offline
 * text is used instead.
 */
async function regenerateLive(db: DB, dealId: string, section: MemoSection): Promise<string> {
  const reasons = staleReasons(db, section).map((r) => `${r.label}: ${r.before} -> ${r.after}`);
  const prompt = `Current text of the section:\n\n${section.content}\n\n${reasons.length ? `These inputs changed since it was written: ${reasons.join("; ")}.` : "Refresh it against the current records."} Rewrite the section.`;
  const system = memoSystemPrompt(db, dealId, section);
  const first = await runAgent({ db, system, history: [], prompt });
  const bad = typedFigures(first.text);
  if (!bad.length && first.text) return first.text;
  const second = await runAgent({
    db, system, history: [{ role: "user", content: prompt }, { role: "assistant", content: first.text }],
    prompt: `These figures are typed as text: ${bad.join(", ")}. Replace each with the matching token and return the full section again.`,
  });
  if (typedFigures(second.text).length || !second.text) throw new Error(`${section.title}: the AI draft typed figures instead of tokens; used offline text.`);
  return second.text;
}

export type RegenerateResult = { result: ActionResult; liveCount: number; note?: string };

/** Regenerate memo sections: with Claude when configured, offline otherwise. */
export async function regenerateMemo(actorId: string, sectionIds: string[]): Promise<RegenerateResult> {
  const db = await readDB();
  const user = db.users.find((u) => u.id === actorId);
  // Check before spending any AI calls; the action checks again when it saves.
  if (!user || !can(user.role, "edit_memo")) return { result: await runWithDB(actorId, () => regenerateSections(sectionIds)), liveCount: 0 };

  const contentById: Record<string, string> = {};
  let note: string | undefined;
  if (liveConfigured()) {
    for (const id of sectionIds) {
      const section = db.memoSections.find((s) => s.id === id);
      const dealId = section && db.memos.find((m) => m.id === section.memoId)?.dealId;
      if (!section || !dealId) continue;
      try {
        contentById[id] = await regenerateLive(db, dealId, section);
      } catch (e) {
        note = e instanceof LiveUnavailable ? `Live AI unavailable (${e.message}); used offline text.` : e instanceof Error ? e.message : "Live regeneration failed.";
        if (e instanceof LiveUnavailable) break;
      }
    }
  }
  const live = Object.keys(contentById).length;
  const result = await runWithDB(actorId, () => regenerateSections(sectionIds, live ? contentById : undefined));
  return { result, liveCount: live, note };
}
