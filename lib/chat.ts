// Chat threads and messages. These are personal working state, so they are
// written without audit events; saving an answer to a deal is a note (audited).
// Like the domain actions, they run on the server.

import type { ChatMessage, DB, EntityType } from "@/lib/schema";
import type { ToolCallRecord } from "@/lib/llm/query-tools";
import { mutate, newId, nowIso, type ActionResult } from "@/lib/core/commit";

export type Scope = { type: EntityType; id: string };

export function createThread(title: string, scope: Scope[] = []): string {
  const id = newId("th");
  mutate((db, actorId) => { db.chatThreads.push({ id, title: title.slice(0, 80), ownerId: actorId ?? "u_jordan", createdAt: nowIso(), scope }); });
  return id;
}

export function addChatMessage(threadId: string, msg: { role: ChatMessage["role"]; content: string; toolCalls?: ToolCallRecord[]; mode?: ChatMessage["mode"] }) {
  mutate((db) => { db.chatMessages.push({ id: newId("cm"), threadId, createdAt: nowIso(), ...msg }); });
}

/** Only the thread's owner can rename or delete it. */
export function renameThread(threadId: string, title: string): ActionResult {
  let result: ActionResult = { ok: true };
  mutate((db, actorId) => {
    const t = db.chatThreads.find((x) => x.id === threadId);
    if (!t || t.ownerId !== actorId) { result = { ok: false, error: "Chat not found." }; return; }
    if (title.trim()) t.title = title.trim().slice(0, 80);
  });
  return result;
}

export function deleteThread(threadId: string): ActionResult {
  let result: ActionResult = { ok: true };
  mutate((db, actorId) => {
    if (!db.chatThreads.some((t) => t.id === threadId && t.ownerId === actorId)) { result = { ok: false, error: "Chat not found." }; return; }
    db.chatThreads = db.chatThreads.filter((t) => t.id !== threadId);
    db.chatMessages = db.chatMessages.filter((m) => m.threadId !== threadId);
  });
  return result;
}

export function scopeName(db: Pick<DB, "deals" | "companies" | "people">, s: Scope) {
  if (s.type === "deal") return db.deals.find((d) => d.id === s.id)?.name ?? s.id;
  if (s.type === "company") return db.companies.find((c) => c.id === s.id)?.name ?? s.id;
  return db.people.find((p) => p.id === s.id)?.fullName ?? s.id;
}
