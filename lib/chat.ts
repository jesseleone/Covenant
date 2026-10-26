"use client";

// Chat threads and messages. These are personal working state, so they are
// written without audit events; saving an answer to a deal is a note (audited).

import type { ChatMessage, EntityType } from "@/lib/schema";
import type { ToolCallRecord } from "@/lib/llm/query-tools";
import { mutate, newId, nowIso, useSessionStore } from "@/lib/store";

export type Scope = { type: EntityType; id: string };

export function createThread(title: string, scope: Scope[] = []): string {
  const id = newId("th");
  const ownerId = useSessionStore.getState().userId ?? "u_jordan";
  mutate((db) => { db.chatThreads.push({ id, title: title.slice(0, 80), ownerId, createdAt: nowIso(), scope }); });
  return id;
}

export function addChatMessage(threadId: string, msg: { role: ChatMessage["role"]; content: string; toolCalls?: ToolCallRecord[]; mode?: ChatMessage["mode"] }) {
  mutate((db) => { db.chatMessages.push({ id: newId("cm"), threadId, createdAt: nowIso(), ...msg }); });
}

export function renameThread(threadId: string, title: string) {
  mutate((db) => { const t = db.chatThreads.find((x) => x.id === threadId); if (t && title.trim()) t.title = title.trim().slice(0, 80); });
}

export function deleteThread(threadId: string) {
  mutate((db) => {
    db.chatThreads = db.chatThreads.filter((t) => t.id !== threadId);
    db.chatMessages = db.chatMessages.filter((m) => m.threadId !== threadId);
  });
}
